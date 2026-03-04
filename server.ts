import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import ViteExpress from "vite-express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SCRIPT_LIBRARY } from "./src/data/scripts";
import type {
  CharacterAttributeBlock,
  PlayerCharacterProfile,
  ScriptDefinition,
  ScriptOpeningConfig,
  ScriptRoleTemplate
} from "./src/types/Script";
import {
  buildAuthHeaders,
  getActivePlayers,
  getModelsUrl,
  PROVIDER_DEFAULT_ENDPOINTS,
  readPromptFile,
  runActionCollector,
  runMemorySummary,
  runMainStory,
  runStateProcessor,
  validateStartCondition
} from "./backend/ai/service";
import { applyStateChanges as applyStateChangesBase } from "./backend/turn/stateSettlement";
import { createTurnProcessor } from "./backend/turn/processTurn";
import {
  buildMemoryTask,
  createDefaultRoomMemoryConfig,
  createEmptyRoomMemorySystem,
  normalizeRoomMemoryConfig,
  normalizeRoomMemorySystem
} from "./backend/turn/memory";
import { registerAdminUserRoutes } from "./backend/routes/adminUserRoutes";
import { registerAdminContentRoutes } from "./backend/routes/adminContentRoutes";
import { registerPlayerAssetRoutes } from "./backend/routes/playerAssetRoutes";
import { registerCoreRoutes } from "./backend/routes/coreRoutes";
import { registerSocketHandlers } from "./backend/socket/registerSocketHandlers";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = (() => {
  const raw = Number(process.env.PORT || "3000");
  if (!Number.isFinite(raw) || raw <= 0) return 3000;
  return Math.floor(raw);
})();
const EMPTY_ROOM_TIMEOUT_MS = 2 * 60 * 1000;
const ROOM_SWEEP_INTERVAL_MS = 30 * 1000;

app.use(cors());
app.use(express.json());

type AIFunctionType = "actionCollector" | "mainStory" | "stateProcessor";
type PromptRole = "system" | "user" | "model";
type AIProviderType = "openai" | "gemini" | "deepseek" | "claude" | "openaiCompatible";
type RoomStatus = "waiting" | "playing" | "processing" | "story_generation" | "settlement";

interface AIConnectionConfig {
  provider: AIProviderType | "";
  endpoint: string;
  apiKey: string;
  model: string;
}

interface AIPromptConfig {
  systemPrompt: string;
  userPrompt?: string;
  modelPrompt?: string;
  temperature: number;
}

interface PlayerAISettings {
  defaultProvider: AIProviderType;
  defaultEndpoint: string;
  defaultApiKey: string;
  actionCollector: { connection: AIConnectionConfig; prompt: AIPromptConfig };
  mainStory: { connection: AIConnectionConfig; prompt: AIPromptConfig };
  stateProcessor: { connection: AIConnectionConfig; prompt: AIPromptConfig };
}

interface SavedCharacter {
  id: string;
  name: string;
  roleTemplateId: string;
  slotIndex: number;
  preferredAccountUsername: string | null;
  profile: PlayerCharacterProfile;
  claimedBy: string | null;
}

interface Player {
  id: string;
  name: string;
  accountUsername?: string;
  playerSlot: number;
  isReady: boolean;
  action: string;
  location: string;
  avatar?: string;
  role?: string;
  isOnline: boolean;
  lastSeenAt: number | null;
  selectedSavedCharacterId: string | null;
  canCreateCustomCharacter: boolean;
  apiFunctions: Record<AIFunctionType, boolean>;
  aiSettings: PlayerAISettings;
  selectedRoleTemplateId: string | null;
  characterProfile: PlayerCharacterProfile;
  currentHP: number;
  currentMP: number;
  statusEffects: string[];
}

interface SharedAssetEnvelope<T = unknown> {
  assetType: "script" | "save";
  id: string;
  name: string;
  hash: string;
  updatedAt: number;
  ownerId: string;
  payload: T;
}

interface Room {
  id: string;
  hostId: string;
  name: string;
  scriptId: string;
  password?: string;
  intro?: string;
  players: Player[];
  status: RoomStatus;
  streamingMode: "off" | "provider";
  hasStarted: boolean;
  gameSetupMode: "new_game" | "load_save";
  savedCharacters: SavedCharacter[];
  currentRound: number;
  logs: any[];
  maxPlayers: number;
  functionRotationIndex: Record<AIFunctionType, number>;
  emptySince: number | null;
  script: ScriptDefinition;
  accountSlotMap: Record<string, number>;
  memoryConfig: ReturnType<typeof createDefaultRoomMemoryConfig>;
  memorySystem: ReturnType<typeof createEmptyRoomMemorySystem>;
  memoryPendingTask: ReturnType<typeof buildMemoryTask> | null;
  aiThinkingHistory: Array<{
    round: number;
    thinking: string;
    source: "mainStory" | "reroll";
    time: string;
  }>;
  lastTurnSnapshot: {
    round: number;
    groupedActions: any;
  } | null;
  rerollVote: {
    id: string;
    round: number;
    prompt: string;
    requesterId: string;
    approvals: string[];
    rejections: string[];
  } | null;
  sharedAssets: {
    script?: SharedAssetEnvelope<ScriptDefinition>;
    save?: SharedAssetEnvelope<any>;
  };
}

const FUNCTION_TYPES: AIFunctionType[] = ["actionCollector", "mainStory", "stateProcessor"];

const defaultAISettings: PlayerAISettings = {
  defaultProvider: "openaiCompatible",
  defaultEndpoint: "",
  defaultApiKey: "",
  actionCollector: {
    connection: { provider: "", endpoint: "", apiKey: "", model: "gpt-4o-mini" },
    prompt: { temperature: 0.3, systemPrompt: "", userPrompt: "", modelPrompt: "" }
  },
  mainStory: {
    connection: { provider: "", endpoint: "", apiKey: "", model: "gpt-4o" },
    prompt: { temperature: 0.7, systemPrompt: "", userPrompt: "", modelPrompt: "" }
  },
  stateProcessor: {
    connection: { provider: "", endpoint: "", apiKey: "", model: "gpt-4o-mini" },
    prompt: { temperature: 0.1, systemPrompt: "", userPrompt: "", modelPrompt: "" }
  }
};

const rooms: Record<string, Room> = {};
const socketRoomIndex: Record<string, string> = {};

type AdminUserStatus = "active" | "disabled";
type AdminUserRole = "player" | "moderator";

interface ManagedUser {
  uid: string;
  username: string;
  password: string;
  createdAt: number;
  status: AdminUserStatus;
  role: AdminUserRole;
  lastLoginAt: number | null;
}

interface ManagedScript extends ScriptDefinition {
  source: "builtin" | "admin";
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

interface WorkshopScriptRecord extends ScriptDefinition {
  ownerUid: string;
  ownerUsername: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  downloads: number;
}

interface CloudSaveRecord {
  id: string;
  name: string;
  data: unknown;
  ownerUid: string;
  ownerUsername: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminLogEntry {
  id: string;
  timestamp: number;
  operator: string;
  action: string;
  targetType: "user" | "script" | "room" | "system";
  targetId: string;
  details?: Record<string, unknown>;
}

interface AdminDataStore {
  users: ManagedUser[];
  scripts: ManagedScript[];
  workshopScripts: WorkshopScriptRecord[];
  cloudSaves: CloudSaveRecord[];
  logs: AdminLogEntry[];
}

interface AuthPayload {
  username: string;
  uid?: string;
  role: "admin" | "player";
  exp: number;
}

const ADMIN_DATA_DIR = path.resolve(process.cwd(), "data");
const ADMIN_DATA_FILE = path.resolve(ADMIN_DATA_DIR, "admin-data.json");
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || randomBytes(32).toString("hex");
const ADMIN_DEFAULT_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";
const PLAYER_TOKEN_SECRET = process.env.PLAYER_TOKEN_SECRET || randomBytes(32).toString("hex");
const PLAYER_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_TOKEN_TTL_SECONDS = 24 * 60 * 60;

const formatNumericUid = (num: number) => String(num).padStart(5, "0");

const normalizeUidValue = (uid: string) => {
  if (!/^\d+$/.test(uid || "")) return "";
  const value = Number(uid);
  if (!Number.isFinite(value) || value <= 0) return "";
  return formatNumericUid(value);
};

const getMaxUidNumber = () => {
  return adminState.users.reduce((max, user) => {
    const normalizedUid = normalizeUidValue(user.uid || "");
    if (!normalizedUid) return max;
    const current = Number(normalizedUid);
    return Number.isFinite(current) ? Math.max(max, current) : max;
  }, 0);
};

const generateUserUid = () => formatNumericUid(getMaxUidNumber() + 1);

const createBuiltinManagedScripts = (): ManagedScript[] => {
  const now = Date.now();
  return SCRIPT_LIBRARY.map((script) => ({
    ...script,
    source: "builtin",
    isPublished: true,
    createdAt: now,
    updatedAt: now
  }));
};

const adminState: AdminDataStore = {
  users: [],
  scripts: createBuiltinManagedScripts(),
  workshopScripts: [],
  cloudSaves: [],
  logs: []
};

const addAdminLog = (
  operator: string,
  action: string,
  targetType: AdminLogEntry["targetType"],
  targetId: string,
  details?: Record<string, unknown>
) => {
  adminState.logs.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    operator,
    action,
    targetType,
    targetId,
    details
  });
  if (adminState.logs.length > 2000) {
    adminState.logs = adminState.logs.slice(0, 2000);
  }
};

const sha256 = (text: string) => createHmac("sha256", "trpg-password-hash").update(text).digest("hex");

const ensureUserUid = () => {
  const used = new Set<string>();
  let next = getMaxUidNumber() + 1;

  adminState.users.forEach((user) => {
    const normalizedUid = normalizeUidValue(user.uid || "");
    const unique = normalizedUid && !used.has(normalizedUid);
    if (unique) {
      user.uid = normalizedUid;
      used.add(normalizedUid);
      return;
    }

    let nextUid = formatNumericUid(next);
    while (used.has(nextUid)) {
      next += 1;
      nextUid = formatNumericUid(next);
    }
    user.uid = nextUid;
    used.add(nextUid);
    next += 1;
  });
};

const signToken = (payload: AuthPayload, secret: string) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sign = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sign}`;
};

const verifyToken = (token: string, secret: string): AuthPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sign] = parts;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sign), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AuthPayload;
    if (!payload?.username || !payload?.role || !payload?.exp) return null;
    if (Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const getBearerToken = (authHeader: string | undefined) => {
  if (!authHeader) return "";
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
};

const persistAdminState = async () => {
  await fs.mkdir(ADMIN_DATA_DIR, { recursive: true });
  await fs.writeFile(ADMIN_DATA_FILE, JSON.stringify(adminState, null, 2), "utf8");
};

const ensureDefaultAdminUser = () => {
  const hasAdmin = adminState.users.some((user) => user.role === "moderator" && user.username === ADMIN_DEFAULT_USERNAME);
  if (hasAdmin) return;
  adminState.users.push({
    uid: generateUserUid(),
    username: ADMIN_DEFAULT_USERNAME,
    password: sha256(ADMIN_DEFAULT_PASSWORD),
    createdAt: Date.now(),
    status: "active",
    role: "moderator",
    lastLoginAt: null
  });
};

const normalizeManagedScripts = (scripts: ManagedScript[]) => {
  const byId = new Map<string, ManagedScript>();
  createBuiltinManagedScripts().forEach((script) => byId.set(script.id, script));
  scripts.forEach((script) => {
    if (!script?.id) return;
    const builtin = byId.get(script.id);
    byId.set(script.id, {
      ...script,
      opening: script.opening ?? builtin?.opening,
      isPublished: script.isPublished ?? true,
      source: script.source ?? "admin",
      createdAt: Number.isFinite(script.createdAt) ? script.createdAt : Date.now(),
      updatedAt: Number.isFinite(script.updatedAt) ? script.updatedAt : Date.now()
    });
  });
  adminState.scripts = Array.from(byId.values());
};

const findRuntimeScript = (scriptId: string) => {
  return adminState.scripts.find((script) => script.id === scriptId && script.isPublished);
};

const sanitizeScriptStoryLine = (value: unknown) => {
  const speaker = String((value as any)?.speaker || "").trim();
  const text = String((value as any)?.text || "").trim();
  if (!speaker || !text) return null;
  return { speaker, text };
};

const sanitizeScriptStorySegment = (value: unknown) => {
  const groupId = String((value as any)?.groupId || "").trim();
  const title = String((value as any)?.title || "").trim();
  const visibleToPlayerIds = Array.isArray((value as any)?.visibleToPlayerIds)
    ? (value as any).visibleToPlayerIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
    : undefined;
  const lines = Array.isArray((value as any)?.lines)
    ? (value as any).lines.map(sanitizeScriptStoryLine).filter((line): line is { speaker: string; text: string } => Boolean(line))
    : [];
  if (!groupId || !title || lines.length === 0) return null;
  return { groupId, title, lines, visibleToPlayerIds };
};

const buildDefaultOpeningConfig = (input: { title: string; description: string; finalGoal: string }): ScriptOpeningConfig => {
  const safeTitle = String(input.title || "未命名剧本").trim() || "未命名剧本";
  const safeDescription = String(input.description || "").trim();
  const safeFinalGoal = String(input.finalGoal || "").trim();
  return {
    enabled: true,
    initialState: {
      环境: {
        年: 1,
        月: 1,
        日: 1,
        时: 8,
        分: 0,
        星期: "",
        游戏天数: 1,
        当前回合: 1,
        大地点: "",
        中地点: "",
        小地点: "",
        具体地点: ""
      },
      剧情: {
        当前章节: {
          章节ID: "chapter-001",
          序号: 1,
          标题: `${safeTitle}·开局`,
          背景: safeDescription,
          当前阶段: "开局导入",
          目标: safeFinalGoal ? [safeFinalGoal] : [],
          失败条件: []
        },
        主线目标: {
          最终目标: safeFinalGoal,
          当前进度: "开局",
          阶段目标: []
        }
      },
      任务列表: []
    },
    openingStory: {
      round: 1,
      publicLines: [
        { speaker: "公共旁白", text: `故事开始：《${safeTitle}》` },
        ...(safeDescription ? [{ speaker: "公共旁白", text: safeDescription }] : [])
      ],
      segments: []
    }
  };
};

const sanitizeScriptOpeningInput = (
  openingInput: unknown,
  fallback: { title: string; description: string; finalGoal: string }
): ScriptOpeningConfig => {
  const fallbackOpening = buildDefaultOpeningConfig(fallback);
  if (!openingInput || typeof openingInput !== "object") return fallbackOpening;

  const enabled = (openingInput as any).enabled !== false;
  const initialStateRaw = (openingInput as any).initialState;
  const initialState = initialStateRaw && typeof initialStateRaw === "object"
    ? initialStateRaw as ScriptOpeningConfig["initialState"]
    : fallbackOpening.initialState;

  const openingStoryRaw = (openingInput as any).openingStory;
  const round = Number((openingStoryRaw as any)?.round);
  const publicLinesRaw = Array.isArray((openingStoryRaw as any)?.publicLines) ? (openingStoryRaw as any).publicLines : [];
  const segmentsRaw = Array.isArray((openingStoryRaw as any)?.segments) ? (openingStoryRaw as any).segments : [];
  const publicLines = publicLinesRaw
    .map(sanitizeScriptStoryLine)
    .filter((line): line is { speaker: string; text: string } => Boolean(line));
  const segments = segmentsRaw
    .map(sanitizeScriptStorySegment)
    .filter((segment): segment is { groupId: string; title: string; lines: { speaker: string; text: string }[]; visibleToPlayerIds?: string[] } => Boolean(segment));

  return {
    enabled,
    initialState,
    openingStory: {
      round: Number.isFinite(round) && round > 0 ? Math.floor(round) : fallbackOpening.openingStory.round,
      publicLines: publicLines.length > 0 ? publicLines : fallbackOpening.openingStory.publicLines,
      segments
    }
  };
};

const sanitizeScriptInput = (input: Partial<ScriptDefinition>): ScriptDefinition => {
  const now = Date.now();
  const toList = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  const id = String(input.id || "script-" + now);
  const title = String(input.title || "未命名剧本");
  const description = String(input.description || "");
  const content = String(input.content || "");
  const settingPrompt = String(input.settingPrompt || "");
  const finalGoal = String(input.finalGoal || "");
  return {
    id,
    title,
    description,
    tags: toList(input.tags),
    content,
    settingPrompt,
    finalGoal,
    opening: sanitizeScriptOpeningInput((input as any).opening, { title, description, finalGoal }),
    roleTemplates: Array.isArray(input.roleTemplates) ? input.roleTemplates : []
  };
};

const initializeAdminState = async () => {
  try {
    if (existsSync(ADMIN_DATA_FILE)) {
      const raw = await fs.readFile(ADMIN_DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<AdminDataStore>;

      if (Array.isArray(parsed.users)) {
        adminState.users = parsed.users
          .filter((user): user is ManagedUser => Boolean(user?.username && user?.password && user?.role))
          .map((user) => ({
            uid: typeof (user as Partial<ManagedUser>).uid === "string" ? (user as Partial<ManagedUser>).uid!.trim() : "",
            username: String(user.username).trim(),
            password: String(user.password),
            createdAt: Number.isFinite(user.createdAt) ? user.createdAt : Date.now(),
            status: user.status === "disabled" ? "disabled" : "active",
            role: user.role === "moderator" ? "moderator" : "player",
            lastLoginAt: Number.isFinite(user.lastLoginAt) ? Number(user.lastLoginAt) : null
          }));
      }

      if (Array.isArray(parsed.scripts)) {
        normalizeManagedScripts(parsed.scripts as ManagedScript[]);
      }

      if (Array.isArray(parsed.workshopScripts)) {
        adminState.workshopScripts = parsed.workshopScripts
          .filter((script): script is WorkshopScriptRecord => Boolean(script?.id && script?.title && script?.ownerUid))
          .map((script) => ({
            ...sanitizeScriptInput(script),
            ownerUid: String(script.ownerUid),
            ownerUsername: String(script.ownerUsername || ""),
            isPublic: script.isPublic !== false,
            createdAt: Number.isFinite(script.createdAt) ? Number(script.createdAt) : Date.now(),
            updatedAt: Number.isFinite(script.updatedAt) ? Number(script.updatedAt) : Date.now(),
            downloads: Number.isFinite(script.downloads) ? Math.max(0, Number(script.downloads)) : 0
          }));
      }

      if (Array.isArray(parsed.cloudSaves)) {
        adminState.cloudSaves = parsed.cloudSaves
          .filter((save): save is CloudSaveRecord => Boolean(save?.id && save?.name && save?.ownerUid))
          .map((save) => ({
            id: String(save.id),
            name: String(save.name),
            data: save.data,
            ownerUid: String(save.ownerUid),
            ownerUsername: String(save.ownerUsername || ""),
            createdAt: Number.isFinite(save.createdAt) ? Number(save.createdAt) : Date.now(),
            updatedAt: Number.isFinite(save.updatedAt) ? Number(save.updatedAt) : Date.now()
          }));
      }

      if (Array.isArray(parsed.logs)) {
        adminState.logs = parsed.logs
          .filter((log): log is AdminLogEntry => Boolean(log?.id && log?.action && log?.operator && log?.targetType && log?.targetId))
          .slice(0, 2000);
      }
    }
  } catch (error) {
    console.error("加载管理端数据失败，使用默认数据:", error);
  }

  ensureDefaultAdminUser();
  ensureUserUid();
  await persistAdminState();
};

const adminStateReady = initializeAdminState();

const buildAuthUserResponse = (user: ManagedUser) => ({
  uid: user.uid,
  username: user.username,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt
});

const issueAdminToken = (username: string) => signToken({
  username,
  role: "admin",
  exp: Date.now() + ADMIN_TOKEN_TTL_SECONDS * 1000
}, ADMIN_TOKEN_SECRET);

const issuePlayerToken = (user: ManagedUser) => signToken({
  uid: user.uid,
  username: user.username,
  role: "player",
  exp: Date.now() + PLAYER_TOKEN_TTL_SECONDS * 1000
}, PLAYER_TOKEN_SECRET);

const requirePlayer = async (req: Request, res: Response, next: NextFunction) => {
  await adminStateReady;
  const token = getBearerToken(req.headers.authorization);
  const payload = verifyToken(token, PLAYER_TOKEN_SECRET);
  if (!payload || payload.role !== "player") {
    res.status(401).json({ error: "用户身份无效或已过期" });
    return;
  }

  const user = adminState.users.find((item) => item.username === payload.username);
  if (!user || user.status === "disabled") {
    res.status(403).json({ error: "账号不可用" });
    return;
  }

  (req as Request & { playerUser?: ManagedUser }).playerUser = user;
  next();
};

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  await adminStateReady;
  const token = getBearerToken(req.headers.authorization);
  const payload = verifyToken(token, ADMIN_TOKEN_SECRET);
  if (!payload || payload.role !== "admin") {
    res.status(401).json({ error: "管理员身份无效或已过期" });
    return;
  }

  const user = adminState.users.find((item) => item.username === payload.username && item.role === "moderator");
  if (!user || user.status === "disabled") {
    res.status(403).json({ error: "管理员账户不可用" });
    return;
  }

  (req as Request & { adminUser?: ManagedUser }).adminUser = user;
  next();
};

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const computeHash = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash));
};

const cloneDefaultAISettings = (): PlayerAISettings => {
  return JSON.parse(JSON.stringify(defaultAISettings)) as PlayerAISettings;
};

const createEmptyAttributes = (): CharacterAttributeBlock => ({
  力量: 0,
  敏捷: 0,
  体质: 0,
  智力: 0,
  感知: 0,
  魅力: 0
});

const createDefaultCharacterProfile = (template: ScriptRoleTemplate): PlayerCharacterProfile => ({
  characterName: "",
  selectedClassId: template.classOptions[0]?.id || null,
  selectedGenderId: template.genderOptions[0]?.id || null,
  selectedRaceId: template.raceOptions[0]?.id || null,
  selectedBackgroundId: template.backgroundOptions[0]?.id || null,
  selectedStarterItemIds: [],
  allocatedPoints: createEmptyAttributes(),
  calculatedAttributes: { ...template.baseAttributes }
});

const getMaxHPByAttributes = (attrs: CharacterAttributeBlock) => Math.max(1, 60 + (attrs.体质 ?? 0) * 4);
const getMaxMPByAttributes = (attrs: CharacterAttributeBlock) => Math.max(0, 20 + (attrs.智力 ?? 0) * 4);

const syncPlayerCombatStats = (player: Player) => {
  const attrs = player.characterProfile?.calculatedAttributes || createEmptyAttributes();
  const maxHP = getMaxHPByAttributes(attrs);
  const maxMP = getMaxMPByAttributes(attrs);

  if (!Number.isFinite(player.currentHP) || player.currentHP <= 0) {
    player.currentHP = maxHP;
  } else {
    player.currentHP = Math.max(0, Math.min(maxHP, Math.floor(player.currentHP)));
  }

  if (!Number.isFinite(player.currentMP) || player.currentMP < 0) {
    player.currentMP = maxMP;
  } else {
    player.currentMP = Math.max(0, Math.min(maxMP, Math.floor(player.currentMP)));
  }

  if (!Array.isArray(player.statusEffects)) {
    player.statusEffects = [];
  }
};

const clampInt = (value: unknown, min: number, max: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.floor(num)));
};

const normalizeAccountUsernameKey = (value: unknown) => String(value || "").trim().toLowerCase();

const normalizePlayerSlot = (slot: unknown, maxPlayers = 4) => {
  const num = Number(slot);
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.min(maxPlayers, Math.floor(num)));
};

const sumAttributes = (attrs: CharacterAttributeBlock) => {
  return attrs.力量 + attrs.敏捷 + attrs.体质 + attrs.智力 + attrs.感知 + attrs.魅力;
};

const findRoleTemplate = (room: Room, player: Player) => {
  if (player.selectedRoleTemplateId) {
    const selected = room.script.roleTemplates.find((role) => role.id === player.selectedRoleTemplateId);
    if (selected) return selected;
  }
  return room.script.roleTemplates[0];
};

const addAttributeBlocks = (...blocks: Array<Partial<CharacterAttributeBlock> | undefined>): CharacterAttributeBlock => {
  const result: CharacterAttributeBlock = createEmptyAttributes();
  for (const block of blocks) {
    if (!block) continue;
    result.力量 += block.力量 ?? 0;
    result.敏捷 += block.敏捷 ?? 0;
    result.体质 += block.体质 ?? 0;
    result.智力 += block.智力 ?? 0;
    result.感知 += block.感知 ?? 0;
    result.魅力 += block.魅力 ?? 0;
  }
  return result;
};

const applyCharacterProfilePatch = (room: Room, player: Player, patch: Partial<PlayerCharacterProfile>) => {
  const template = findRoleTemplate(room, player);
  if (!template) return;

  const profile = { ...player.characterProfile };

  if (typeof patch.characterName === "string") {
    profile.characterName = patch.characterName.slice(0, 30);
  }

  const normalizeOption = (value: unknown, options: Array<{ id: string }>, fallback: string | null) => {
    if (typeof value !== "string") return fallback;
    return options.some((opt) => opt.id === value) ? value : fallback;
  };

  profile.selectedClassId = normalizeOption(patch.selectedClassId, template.classOptions, profile.selectedClassId);
  profile.selectedGenderId = normalizeOption(patch.selectedGenderId, template.genderOptions, profile.selectedGenderId);
  profile.selectedRaceId = normalizeOption(patch.selectedRaceId, template.raceOptions, profile.selectedRaceId);
  profile.selectedBackgroundId = normalizeOption(patch.selectedBackgroundId, template.backgroundOptions, profile.selectedBackgroundId);

  if (Array.isArray(patch.selectedStarterItemIds)) {
    const allowed = new Set(template.starterItemOptions.map((item) => item.id));
    profile.selectedStarterItemIds = patch.selectedStarterItemIds
      .filter((id): id is string => typeof id === "string" && allowed.has(id))
      .slice(0, template.maxStarterItems);
  }

  const totalAllocationPoints = sumAttributes({
    力量: template.allocationPointsByAttribute.力量 ?? 0,
    敏捷: template.allocationPointsByAttribute.敏捷 ?? 0,
    体质: template.allocationPointsByAttribute.体质 ?? 0,
    智力: template.allocationPointsByAttribute.智力 ?? 0,
    感知: template.allocationPointsByAttribute.感知 ?? 0,
    魅力: template.allocationPointsByAttribute.魅力 ?? 0
  });

  if (patch.allocatedPoints && typeof patch.allocatedPoints === "object") {
    profile.allocatedPoints = {
      力量: clampInt((patch.allocatedPoints as CharacterAttributeBlock).力量 ?? profile.allocatedPoints.力量, 0, 10),
      敏捷: clampInt((patch.allocatedPoints as CharacterAttributeBlock).敏捷 ?? profile.allocatedPoints.敏捷, 0, 10),
      体质: clampInt((patch.allocatedPoints as CharacterAttributeBlock).体质 ?? profile.allocatedPoints.体质, 0, 10),
      智力: clampInt((patch.allocatedPoints as CharacterAttributeBlock).智力 ?? profile.allocatedPoints.智力, 0, 10),
      感知: clampInt((patch.allocatedPoints as CharacterAttributeBlock).感知 ?? profile.allocatedPoints.感知, 0, 10),
      魅力: clampInt((patch.allocatedPoints as CharacterAttributeBlock).魅力 ?? profile.allocatedPoints.魅力, 0, 10)
    };
  }

  const classOpt = template.classOptions.find((opt) => opt.id === profile.selectedClassId);
  const genderOpt = template.genderOptions.find((opt) => opt.id === profile.selectedGenderId);
  const raceOpt = template.raceOptions.find((opt) => opt.id === profile.selectedRaceId);
  const backgroundOpt = template.backgroundOptions.find((opt) => opt.id === profile.selectedBackgroundId);
  const usedPoints = sumAttributes(profile.allocatedPoints);
  const totalPoints = totalAllocationPoints;

  if (usedPoints > totalPoints) {
    const ratio = totalPoints / Math.max(1, usedPoints);
    profile.allocatedPoints = {
      力量: Math.floor(profile.allocatedPoints.力量 * ratio),
      敏捷: Math.floor(profile.allocatedPoints.敏捷 * ratio),
      体质: Math.floor(profile.allocatedPoints.体质 * ratio),
      智力: Math.floor(profile.allocatedPoints.智力 * ratio),
      感知: Math.floor(profile.allocatedPoints.感知 * ratio),
      魅力: Math.floor(profile.allocatedPoints.魅力 * ratio)
    };
  }

  profile.calculatedAttributes = addAttributeBlocks(
    template.baseAttributes,
    profile.allocatedPoints,
    classOpt?.attributeBonuses,
    genderOpt?.attributeBonuses,
    raceOpt?.attributeBonuses,
    backgroundOpt?.attributeBonuses
  );

  player.characterProfile = profile;
  player.role = [classOpt?.name, raceOpt?.name].filter(Boolean).join("/") || "未分配";
  syncPlayerCombatStats(player);
};

const applyStateChanges = (room: Room, changesInput: unknown) => {
  applyStateChangesBase(room, changesInput, {
    getMaxHPByAttributes,
    getMaxMPByAttributes,
    createEmptyAttributes,
    syncPlayerCombatStats
  });
};

const syncHostIfNeeded = (room: Room) => {
  const activePlayers = getActivePlayers(room);
  const hostStillOnline = activePlayers.some((p) => p.id === room.hostId);
  if (!hostStillOnline && activePlayers.length > 0) {
    room.hostId = activePlayers[0].id;
  }
};

const ensureSavedCharactersForLoadMode = (room: Room) => {
  const slotPreferredAccountMap = new Map<number, string>();
  Object.entries(room.accountSlotMap || {}).forEach(([accountKey, slot]) => {
    const normalizedSlot = normalizePlayerSlot(slot, room.maxPlayers);
    if (!slotPreferredAccountMap.has(normalizedSlot)) {
      slotPreferredAccountMap.set(normalizedSlot, accountKey);
    }
  });

  if (room.savedCharacters.length > 0) {
    room.savedCharacters = room.savedCharacters.map((saved, index) => ({
      ...saved,
      slotIndex: normalizePlayerSlot((saved as any).slotIndex ?? index + 1, room.maxPlayers),
      preferredAccountUsername: typeof (saved as any).preferredAccountUsername === "string"
        ? (saved as any).preferredAccountUsername
        : slotPreferredAccountMap.get(normalizePlayerSlot((saved as any).slotIndex ?? index + 1, room.maxPlayers)) || null
    }));
    return;
  }

  const now = Date.now();
  room.savedCharacters = Array.from({ length: room.maxPlayers }).map((_, index) => {
    const slotIndex = index + 1;
    const template = room.script.roleTemplates[index] || room.script.roleTemplates[0];
    if (!template) {
      throw new Error("该剧本未配置角色模板");
    }
    const profile = createDefaultCharacterProfile(template);
    profile.characterName = `玩家${slotIndex}号角色`;

    return {
      id: `saved-${now}-${slotIndex}`,
      name: `玩家${slotIndex}号位`,
      roleTemplateId: template.id,
      slotIndex,
      preferredAccountUsername: slotPreferredAccountMap.get(slotIndex) || null,
      profile,
      claimedBy: null
    };
  });
};

const switchGameSetupMode = (room: Room, mode: "new_game" | "load_save") => {
  room.gameSetupMode = mode;

  if (mode === "new_game") {
    room.savedCharacters.forEach((saved) => {
      saved.claimedBy = null;
    });

    room.players.forEach((player) => {
      player.selectedSavedCharacterId = null;
      player.canCreateCustomCharacter = true;
    });
    return;
  }

  ensureSavedCharactersForLoadMode(room);

  room.savedCharacters.forEach((saved) => {
    saved.claimedBy = null;
  });

  room.players.forEach((player) => {
    player.selectedSavedCharacterId = null;
    player.canCreateCustomCharacter = false;

    const playerSlot = normalizePlayerSlot(player.playerSlot, room.maxPlayers);
    const slotSavedCharacter = room.savedCharacters.find((saved) => normalizePlayerSlot(saved.slotIndex, room.maxPlayers) === playerSlot);
    if (!slotSavedCharacter) return;

    const playerAccount = normalizeAccountUsernameKey(player.accountUsername);
    const preferredAccount = normalizeAccountUsernameKey(slotSavedCharacter.preferredAccountUsername);
    const shouldAutoClaim = Boolean(playerAccount && preferredAccount && playerAccount === preferredAccount);
    if (!shouldAutoClaim) return;
    if (slotSavedCharacter.claimedBy && slotSavedCharacter.claimedBy !== player.id) return;

    slotSavedCharacter.claimedBy = player.id;
    player.selectedSavedCharacterId = slotSavedCharacter.id;
    player.selectedRoleTemplateId = slotSavedCharacter.roleTemplateId;
    player.characterProfile = JSON.parse(JSON.stringify(slotSavedCharacter.profile)) as PlayerCharacterProfile;
    player.canCreateCustomCharacter = false;
    applyCharacterProfilePatch(room, player, {});
  });
};

const claimSavedCharacterForPlayer = (room: Room, player: Player, characterId: string) => {
  const savedCharacter = room.savedCharacters.find((saved) => saved.id === characterId);
  if (!savedCharacter) {
    throw new Error("存档角色不存在");
  }

  if (savedCharacter.claimedBy && savedCharacter.claimedBy !== player.id) {
    throw new Error("该角色已被其他玩家选择");
  }

  const playerSlot = normalizePlayerSlot(player.playerSlot, room.maxPlayers);
  const savedSlot = normalizePlayerSlot(savedCharacter.slotIndex, room.maxPlayers);
  if (savedSlot !== playerSlot) {
    throw new Error(`你只能选择与你玩家序号一致的角色槽位（当前为玩家${playerSlot}）`);
  }

  room.savedCharacters.forEach((saved) => {
    if (saved.claimedBy === player.id) {
      saved.claimedBy = null;
    }
  });

  savedCharacter.claimedBy = player.id;
  player.selectedSavedCharacterId = savedCharacter.id;
  player.selectedRoleTemplateId = savedCharacter.roleTemplateId;
  player.characterProfile = JSON.parse(JSON.stringify(savedCharacter.profile)) as PlayerCharacterProfile;
  player.canCreateCustomCharacter = false;
  savedCharacter.preferredAccountUsername = player.accountUsername ? String(player.accountUsername) : null;
  applyCharacterProfilePatch(room, player, {});
};

const setPlayerCustomCharacterMode = (room: Room, player: Player, enabled: boolean) => {
  if (enabled) {
    room.savedCharacters.forEach((saved) => {
      if (saved.claimedBy === player.id) {
        saved.claimedBy = null;
      }
    });
    player.selectedSavedCharacterId = null;
    player.canCreateCustomCharacter = true;
    return;
  }

  player.canCreateCustomCharacter = false;
};

const removePlayerFromRoom = (socketId: string) => {
  const roomId = socketRoomIndex[socketId];
  if (!roomId) return;

  const room = rooms[roomId];
  delete socketRoomIndex[socketId];
  if (!room) return;

  const targetPlayer = room.players.find((p) => p.id === socketId);
  if (!targetPlayer) return;

  if (room.hasStarted) {
    targetPlayer.isOnline = false;
    targetPlayer.lastSeenAt = Date.now();
    targetPlayer.isReady = false;
    targetPlayer.action = "";
  } else {
    room.savedCharacters.forEach((saved) => {
      if (saved.claimedBy === socketId) {
        saved.claimedBy = null;
      }
    });
    room.players = room.players.filter((p) => p.id !== socketId);
  }

  if (room.players.length === 0 || getActivePlayers(room).length === 0) {
    room.emptySince = Date.now();
  } else {
    room.emptySince = null;
    syncHostIfNeeded(room);
  }

  io.to(roomId).emit("room_updated", room);
  io.emit("rooms_list_updated");
};

const sweepEmptyRooms = () => {
  const now = Date.now();
  let changed = false;

  Object.entries(rooms).forEach(([roomId, room]) => {
    if (getActivePlayers(room).length > 0) {
      room.emptySince = null;
      return;
    }

    if (room.emptySince === null) {
      room.emptySince = now;
      return;
    }

    if (now - room.emptySince >= EMPTY_ROOM_TIMEOUT_MS) {
      delete rooms[roomId];
      changed = true;
      console.log(`Room ${roomId} closed due to inactivity`);
    }
  });

  if (changed) io.emit("rooms_list_updated");
};

setInterval(sweepEmptyRooms, ROOM_SWEEP_INTERVAL_MS);

const processTurn = createTurnProcessor({
  rooms,
  io,
  getActivePlayers,
  runActionCollector,
  runMainStory,
  runStateProcessor,
  applyStateChanges
});

registerSocketHandlers({
  io,
  rooms,
  socketRoomIndex,
  processTurn,
  removePlayerFromRoom,
  getActivePlayers,
  findRuntimeScript,
  generateRoomId,
  cloneDefaultAISettings,
  createDefaultCharacterProfile,
  getMaxHPByAttributes,
  getMaxMPByAttributes,
  computeHash,
  syncHostIfNeeded,
  FUNCTION_TYPES,
  applyCharacterProfilePatch,
  switchGameSetupMode,
  claimSavedCharacterForPlayer,
  setPlayerCustomCharacterMode,
  validateStartCondition,
  runMainStory,
  runMemorySummary,
  normalizeRoomMemoryConfig,
  normalizeRoomMemorySystem,
  buildMemoryTask
});

registerCoreRoutes({
  app,
  adminStateReady,
  adminState,
  generateUserUid,
  sha256,
  addAdminLog,
  persistAdminState,
  issuePlayerToken,
  PLAYER_TOKEN_TTL_SECONDS,
  buildAuthUserResponse,
  requirePlayer,
  readPromptFile,
  FUNCTION_TYPES,
  getModelsUrl,
  PROVIDER_DEFAULT_ENDPOINTS,
  buildAuthHeaders
});

registerAdminUserRoutes({
  app,
  requireAdmin,
  adminStateReady,
  adminState,
  rooms,
  getActivePlayers,
  sha256,
  addAdminLog,
  persistAdminState,
  issueAdminToken,
  ADMIN_TOKEN_TTL_SECONDS,
  buildAuthUserResponse
});

registerAdminContentRoutes({
  app,
  requireAdmin,
  adminStateReady,
  adminState,
  rooms,
  socketRoomIndex,
  io,
  getActivePlayers,
  sanitizeScriptInput,
  addAdminLog,
  persistAdminState
});

registerPlayerAssetRoutes({
  app,
  requirePlayer,
  adminStateReady,
  adminState,
  sanitizeScriptInput,
  addAdminLog,
  persistAdminState
});

const startServer = (port: number, retries = 20) => {
  httpServer.once("error", (error: any) => {
    if (error?.code === "EADDRINUSE" && retries > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use, retrying on ${nextPort}...`);
      startServer(nextPort, retries - 1);
      return;
    }
    console.error("Server startup failed:", error);
    process.exit(1);
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

startServer(PORT);
ViteExpress.bind(app, httpServer);






