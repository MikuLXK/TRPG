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
  ScriptRoleTemplate
} from "./src/types/Script";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;
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
  profile: PlayerCharacterProfile;
  claimedBy: string | null;
}

interface Player {
  id: string;
  name: string;
  accountUsername?: string;
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
  hasStarted: boolean;
  gameSetupMode: "new_game" | "load_save";
  savedCharacters: SavedCharacter[];
  currentRound: number;
  logs: any[];
  maxPlayers: number;
  functionRotationIndex: Record<AIFunctionType, number>;
  emptySince: number | null;
  script: ScriptDefinition;
  sharedAssets: {
    script?: SharedAssetEnvelope<ScriptDefinition>;
    save?: SharedAssetEnvelope<any>;
  };
}

const FUNCTION_TYPES: AIFunctionType[] = ["actionCollector", "mainStory", "stateProcessor"];

const PROVIDER_DEFAULT_ENDPOINTS: Record<AIProviderType, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com/v1",
  claude: "https://api.anthropic.com/v1",
  openaiCompatible: ""
};

const defaultAISettings: PlayerAISettings = {
  defaultProvider: "openaiCompatible",
  defaultEndpoint: "",
  defaultApiKey: "",
  actionCollector: {
    connection: { provider: "", endpoint: "", apiKey: "", model: "gpt-4o-mini" },
    prompt: { temperature: 0.3, systemPrompt: "" }
  },
  mainStory: {
    connection: { provider: "", endpoint: "", apiKey: "", model: "gpt-4o" },
    prompt: { temperature: 0.7, systemPrompt: "" }
  },
  stateProcessor: {
    connection: { provider: "", endpoint: "", apiKey: "", model: "gpt-4o-mini" },
    prompt: { temperature: 0.1, systemPrompt: "" }
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
    byId.set(script.id, {
      ...script,
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

const sanitizeScriptInput = (input: Partial<ScriptDefinition>): ScriptDefinition => {
  const now = Date.now();
  const toList = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  return {
    id: String(input.id || "script-" + now),
    title: String(input.title || "未命名剧本"),
    description: String(input.description || ""),
    tags: toList(input.tags),
    content: String(input.content || ""),
    settingPrompt: String(input.settingPrompt || ""),
    finalGoal: String(input.finalGoal || ""),
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

const getPromptPath = (functionType: AIFunctionType, role: PromptRole) => {
  return path.resolve(process.cwd(), "src", "prompts", functionType, `${role}.txt`);
};

const readPromptFile = async (functionType: AIFunctionType, role: PromptRole): Promise<string> => {
  const promptPath = getPromptPath(functionType, role);
  try {
    const content = await fs.readFile(promptPath, "utf-8");
    return content.trim();
  } catch {
    return "";
  }
};

const fillTemplate = (template: string, values: Record<string, string>) => {
  let text = template;
  Object.entries(values).forEach(([key, value]) => {
    text = text.replaceAll(`{{${key}}}`, value);
  });
  return text;
};

const safeJsonParse = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const normalizeEndpoint = (endpoint: string) => endpoint.replace(/\/+$/, "");

const getProviderForConnection = (settings: PlayerAISettings, conn: AIConnectionConfig): AIProviderType => {
  return (conn.provider || settings.defaultProvider || "openaiCompatible") as AIProviderType;
};

const getEndpointForConnection = (provider: AIProviderType, settings: PlayerAISettings, conn: AIConnectionConfig): string => {
  return conn.endpoint || settings.defaultEndpoint || PROVIDER_DEFAULT_ENDPOINTS[provider] || "";
};

const getApiKeyForConnection = (settings: PlayerAISettings, conn: AIConnectionConfig): string => {
  return conn.apiKey || settings.defaultApiKey;
};

const getEffectiveConnection = (player: Player, functionType: AIFunctionType) => {
  const conn = player.aiSettings[functionType].connection;
  const provider = getProviderForConnection(player.aiSettings, conn);
  const endpoint = getEndpointForConnection(provider, player.aiSettings, conn);
  const apiKey = getApiKeyForConnection(player.aiSettings, conn);
  return {
    provider,
    endpoint,
    apiKey,
    model: conn.model
  };
};

const getChatCompletionsUrl = (provider: AIProviderType, endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  if (provider === "claude") return `${normalized}/messages`;
  return `${normalized}/chat/completions`;
};

const getModelsUrl = (provider: AIProviderType, endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  if (provider === "gemini") return `${normalized}/models`;
  return `${normalized}/models`;
};

const buildAuthHeaders = (provider: AIProviderType, apiKey: string): Record<string, string> => {
  if (!apiKey) return {};
  if (provider === "claude") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }
  if (provider === "gemini") {
    return {
      "x-goog-api-key": apiKey
    };
  }
  return {
    Authorization: `Bearer ${apiKey}`
  };
};

const extractTextFromResponse = (provider: AIProviderType, payload: any): string => {
  if (provider === "claude") {
    if (Array.isArray(payload?.content)) {
      return payload.content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n");
    }
    return "";
  }

  if (provider === "gemini") {
    const textByCandidates = Array.isArray(payload?.candidates)
      ? payload.candidates
          .map((c: any) => c?.content?.parts?.map((p: any) => p?.text ?? "").join("\n") ?? "")
          .join("\n")
      : "";
    if (textByCandidates) return textByCandidates;
  }

  const choice = payload?.choices?.[0];
  if (typeof choice?.message?.content === "string") {
    return choice.message.content;
  }
  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content.map((part: any) => part?.text ?? "").join("\n");
  }
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }
  if (Array.isArray(payload?.content)) {
    return payload.content.map((part: any) => part?.text ?? "").join("\n");
  }
  return "";
};

const callChatCompletion = async (args: {
  provider: AIProviderType;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  modelPrompt: string;
}) => {
  if (!args.endpoint) {
    throw new Error("Endpoint 不能为空");
  }

  if (args.provider === "gemini") {
    const geminiUrl = `${normalizeEndpoint(args.endpoint)}/models/${args.model}:generateContent`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders("gemini", args.apiKey)
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: args.systemPrompt }]
        },
        generationConfig: {
          temperature: args.temperature
        },
        contents: [
          {
            role: "user",
            parts: [{ text: args.userPrompt }]
          },
          {
            role: "model",
            parts: [{ text: args.modelPrompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini 请求失败(${response.status}): ${errText}`);
    }

    const payload = await response.json();
    return extractTextFromResponse("gemini", payload);
  }

  const url = getChatCompletionsUrl(args.provider, args.endpoint);

  const openAIMessages = [
    { role: "system", content: args.systemPrompt },
    { role: "user", content: args.userPrompt },
    { role: "assistant", content: args.modelPrompt }
  ];

  const claudeMessages = [
    { role: "user", content: args.userPrompt },
    { role: "assistant", content: args.modelPrompt }
  ];

  const body = args.provider === "claude"
    ? {
        model: args.model,
        temperature: args.temperature,
        max_tokens: 2048,
        system: args.systemPrompt,
        messages: claudeMessages
      }
    : {
        model: args.model,
        temperature: args.temperature,
        messages: openAIMessages
      };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(args.provider, args.apiKey)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI请求失败(${response.status}): ${errText}`);
  }

  const payload = await response.json();
  return extractTextFromResponse(args.provider, payload);
};

const getFunctionProviders = (room: Room, functionType: AIFunctionType) => {
  return getActivePlayers(room).filter((player) => player.apiFunctions[functionType]);
};

const pickProviderByRoundRobin = (room: Room, functionType: AIFunctionType) => {
  const providers = getFunctionProviders(room, functionType);
  if (providers.length === 0) {
    throw new Error(`功能 ${functionType} 没有玩家提供API`);
  }

  const index = room.functionRotationIndex[functionType] % providers.length;
  const selected = providers[index];
  room.functionRotationIndex[functionType] += 1;
  return selected;
};

const validateStartCondition = (room: Room) => {
  return FUNCTION_TYPES.every((fn) => getFunctionProviders(room, fn).length > 0);
};

const getPromptSystemOverride = async (player: Player, functionType: AIFunctionType) => {
  const override = player.aiSettings[functionType].prompt.systemPrompt?.trim();
  if (override) return override;
  return readPromptFile(functionType, "system");
};

const runActionCollector = async (room: Room) => {
  const providerPlayer = pickProviderByRoundRobin(room, "actionCollector");
  const connection = getEffectiveConnection(providerPlayer, "actionCollector");
  const userTemplate = await readPromptFile("actionCollector", "user");
  const modelTemplate = await readPromptFile("actionCollector", "model");
  const systemPrompt = await getPromptSystemOverride(providerPlayer, "actionCollector");

  const actions = getActivePlayers(room).map((p) => ({
    playerId: p.id,
    playerName: p.name,
    location: p.location,
    action: p.action
  }));

  const userPrompt = fillTemplate(userTemplate, {
    actionsJson: JSON.stringify(actions, null, 2)
  });

  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.actionCollector.prompt.temperature,
    systemPrompt,
    userPrompt,
    modelPrompt: modelTemplate
  });

  const parsed = safeJsonParse<{ groups?: any[]; rawActions?: any[] }>(output);
  if (!parsed || !Array.isArray(parsed.groups)) {
    throw new Error("actionCollector 输出JSON无效");
  }

  return {
    groups: parsed.groups,
    rawActions: Array.isArray(parsed.rawActions) ? parsed.rawActions : actions
  };
};

const runMainStory = async (room: Room, groupedActions: unknown) => {
  const providerPlayer = pickProviderByRoundRobin(room, "mainStory");
  const connection = getEffectiveConnection(providerPlayer, "mainStory");
  const userTemplate = await readPromptFile("mainStory", "user");
  const modelTemplate = await readPromptFile("mainStory", "model");
  const systemPromptBase = await getPromptSystemOverride(providerPlayer, "mainStory");
  const settingPrompt = room.script?.settingPrompt?.trim();
  const systemPrompt = settingPrompt ? `${settingPrompt}\n\n${systemPromptBase}` : systemPromptBase;

  const userPrompt = fillTemplate(userTemplate, {
    groupedActionsJson: JSON.stringify(groupedActions, null, 2)
  });

  return callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.mainStory.prompt.temperature,
    systemPrompt,
    userPrompt,
    modelPrompt: modelTemplate
  });
};

const runStateProcessor = async (room: Room, storyText: string) => {
  const providerPlayer = pickProviderByRoundRobin(room, "stateProcessor");
  const connection = getEffectiveConnection(providerPlayer, "stateProcessor");
  const userTemplate = await readPromptFile("stateProcessor", "user");
  const modelTemplate = await readPromptFile("stateProcessor", "model");
  const systemPrompt = await getPromptSystemOverride(providerPlayer, "stateProcessor");

  const currentState = room.players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    location: p.location,
    currentHP: p.currentHP,
    currentMP: p.currentMP,
    statusEffects: p.statusEffects
  }));

  const userPrompt = fillTemplate(userTemplate, {
    storyText,
    currentStateJson: JSON.stringify(currentState, null, 2)
  });

  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.stateProcessor.prompt.temperature,
    systemPrompt,
    userPrompt,
    modelPrompt: modelTemplate
  });

  return safeJsonParse<{ changes?: any[] }>(output) ?? { changes: [] };
};

interface MainStorySegment {
  groupId: string;
  visibleToPlayerIds: string[];
  title: string;
  content: string;
}

interface MainStoryHint {
  playerId: string;
  hint: string;
}

interface MainStoryPayload {
  globalSummary?: string;
  segments?: MainStorySegment[];
  nextHints?: MainStoryHint[];
}

const getActivePlayers = (room: Room) => room.players.filter((p) => p.isOnline !== false);

const buildStateStoryText = (payload: MainStoryPayload) => {
  const parts: string[] = [];
  if (typeof payload.globalSummary === "string" && payload.globalSummary.trim()) {
    parts.push(payload.globalSummary.trim());
  }

  for (const seg of payload.segments || []) {
    const title = (seg.title || "").trim();
    const content = (seg.content || "").trim();
    if (title || content) {
      parts.push([title, content].filter(Boolean).join("\n"));
    }
  }

  return parts.join("\n\n");
};

const applyStateChanges = (room: Room, changesInput: unknown) => {
  const changes = Array.isArray((changesInput as any)?.changes) ? (changesInput as any).changes : [];

  for (const change of changes) {
    const playerId = typeof change?.playerId === "string" ? change.playerId : "";
    if (!playerId) continue;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) continue;

    const fields = (change?.fields && typeof change.fields === "object") ? change.fields as Record<string, unknown> : {};

    if (typeof fields.位置 === "string" && fields.位置.trim()) {
      player.location = fields.位置.trim();
    }

    const hpDelta = Number(fields.生命值 ?? fields.hpDelta ?? 0);
    if (Number.isFinite(hpDelta) && hpDelta !== 0) {
      const maxHP = getMaxHPByAttributes(player.characterProfile?.calculatedAttributes || createEmptyAttributes());
      player.currentHP = Math.max(0, Math.min(maxHP, Math.floor(player.currentHP + hpDelta)));
    }

    const mpDelta = Number(fields.法力值 ?? fields.mpDelta ?? 0);
    if (Number.isFinite(mpDelta) && mpDelta !== 0) {
      const maxMP = getMaxMPByAttributes(player.characterProfile?.calculatedAttributes || createEmptyAttributes());
      player.currentMP = Math.max(0, Math.min(maxMP, Math.floor(player.currentMP + mpDelta)));
    }

    const nextHP = Number(fields.当前生命值);
    if (Number.isFinite(nextHP)) {
      const maxHP = getMaxHPByAttributes(player.characterProfile?.calculatedAttributes || createEmptyAttributes());
      player.currentHP = Math.max(0, Math.min(maxHP, Math.floor(nextHP)));
    }

    const nextMP = Number(fields.当前法力值);
    if (Number.isFinite(nextMP)) {
      const maxMP = getMaxMPByAttributes(player.characterProfile?.calculatedAttributes || createEmptyAttributes());
      player.currentMP = Math.max(0, Math.min(maxMP, Math.floor(nextMP)));
    }

    const addStatus = Array.isArray(fields.状态_add)
      ? fields.状态_add.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [];
    if (addStatus.length) {
      const merged = new Set([...(player.statusEffects || []), ...addStatus]);
      player.statusEffects = Array.from(merged);
    }

    const removeStatus = Array.isArray(fields.状态_remove)
      ? fields.状态_remove.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [];
    if (removeStatus.length) {
      const removeSet = new Set(removeStatus);
      player.statusEffects = (player.statusEffects || []).filter((s) => !removeSet.has(s));
    }

    syncPlayerCombatStats(player);
  }
};

const syncHostIfNeeded = (room: Room) => {
  const activePlayers = getActivePlayers(room);
  const hostStillOnline = activePlayers.some((p) => p.id === room.hostId);
  if (!hostStillOnline && activePlayers.length > 0) {
    room.hostId = activePlayers[0].id;
  }
};

const ensureSavedCharactersForLoadMode = (room: Room) => {
  if (room.savedCharacters.length > 0) return;

  const now = Date.now();
  room.savedCharacters = room.script.roleTemplates.slice(0, room.maxPlayers).map((template, index) => {
    const profile = createDefaultCharacterProfile(template);
    profile.characterName = template.name;

    return {
      id: `saved-${now}-${index + 1}`,
      name: template.name,
      roleTemplateId: template.id,
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

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("get_rooms", (data?: { accountUsername?: string; playerName?: string }) => {
    const accountUsername = typeof data?.accountUsername === "string" ? data.accountUsername.trim() : "";
    const playerName = typeof data?.playerName === "string" ? data.playerName.trim() : "";

    const roomList = Object.values(rooms).map((r) => {
      const activePlayers = getActivePlayers(r);
      const reconnectCandidate = accountUsername
        ? r.players.find((p) => p.accountUsername === accountUsername)
        : playerName
          ? r.players.find((p) => p.name === playerName)
          : undefined;

      const reconnectable = Boolean(r.hasStarted && reconnectCandidate && !reconnectCandidate.isOnline);

      return {
        id: r.id,
        name: r.name,
        script: r.script.title,
        players: activePlayers.length,
        maxPlayers: r.maxPlayers,
        locked: !!r.password,
        status: r.status,
        inGame: r.hasStarted,
        reconnectable
      };
    });
    socket.emit("rooms_list", roomList);
  });

  socket.on("create_room", (data: {
    roomName: string;
    scriptId: string;
    password?: string;
    intro?: string;
    playerName: string;
    accountUsername?: string;
    scriptPayload?: ScriptDefinition;
  }) => {
    const scriptFromPayload = data.scriptPayload && data.scriptPayload.id === data.scriptId
      ? data.scriptPayload
      : undefined;
    const script = scriptFromPayload || findRuntimeScript(data.scriptId);
    if (!script) {
      socket.emit("error", "无效剧本");
      return;
    }

    if (!script.roleTemplates.length) {
      socket.emit("error", "该剧本未配置角色模板");
      return;
    }

    const roomId = generateRoomId();

    const newRoom: Room = {
      id: roomId,
      hostId: socket.id,
      name: data.roomName,
      scriptId: data.scriptId,
      password: (data.password || "").trim() || undefined,
      intro: data.intro,
      players: [{
        id: socket.id,
        name: data.playerName || "房主",
        accountUsername: data.accountUsername,
        isReady: false,
        action: "",
        location: "初始地点",
        role: "未分配",
        avatar: "bg-amber-500",
        isOnline: true,
        lastSeenAt: null,
        selectedSavedCharacterId: null,
        canCreateCustomCharacter: true,
        apiFunctions: {
          actionCollector: false,
          mainStory: false,
          stateProcessor: false
        },
        aiSettings: cloneDefaultAISettings(),
        selectedRoleTemplateId: script.roleTemplates[0]?.id || null,
        characterProfile: createDefaultCharacterProfile(script.roleTemplates[0]),
        currentHP: getMaxHPByAttributes(script.roleTemplates[0].baseAttributes),
        currentMP: getMaxMPByAttributes(script.roleTemplates[0].baseAttributes),
        statusEffects: []
      }],
      status: "waiting",
      hasStarted: false,
      gameSetupMode: "new_game",
      savedCharacters: [],
      currentRound: 1,
      logs: [],
      maxPlayers: 4,
      functionRotationIndex: {
        actionCollector: 0,
        mainStory: 0,
        stateProcessor: 0
      },
      emptySince: null,
      script,
      sharedAssets: {
        script: {
          assetType: "script",
          id: script.id,
          name: script.title,
          hash: computeHash(script),
          updatedAt: Date.now(),
          ownerId: socket.id,
          payload: script
        }
      }
    };

    rooms[roomId] = newRoom;
    socketRoomIndex[socket.id] = roomId;

    socket.join(roomId);
    socket.emit("room_created", { roomId, roomState: newRoom });
    io.to(roomId).emit("room_updated", newRoom);
    io.emit("rooms_list_updated");
    console.log(`Room created: ${roomId} (${data.roomName}) by ${data.playerName}`);
  });

  socket.on("join_room", ({ roomId, playerName, accountUsername, password }: { roomId: string; playerName: string; accountUsername?: string; password?: string }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "房间不存在");
      return;
    }

    const activePlayers = getActivePlayers(room);
    const identityKey = typeof accountUsername === "string" && accountUsername.trim()
      ? { type: "account" as const, value: accountUsername.trim() }
      : { type: "name" as const, value: playerName };

    const existingPlayer = room.players.find((p) => (
      identityKey.type === "account"
        ? p.accountUsername === identityKey.value
        : p.name === identityKey.value
    ));

    const isReconnectAttempt = Boolean(existingPlayer && !existingPlayer.isOnline);

    if (!isReconnectAttempt && room.password && room.password !== (password ?? "")) {
      socket.emit("error", "房间密码错误");
      return;
    }

    if (room.hasStarted) {
      if (!existingPlayer) {
        socket.emit("error", "游戏已开始，仅支持断线重连");
        return;
      }

      if (existingPlayer.isOnline) {
        socket.emit("error", "该玩家已在线");
        return;
      }

      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.name = playerName;
      existingPlayer.accountUsername = accountUsername ?? existingPlayer.accountUsername;
      existingPlayer.isOnline = true;
      existingPlayer.lastSeenAt = null;

      if (oldId && oldId !== socket.id) {
        delete socketRoomIndex[oldId];
      }

      socketRoomIndex[socket.id] = roomId;
      room.emptySince = null;
      socket.join(roomId);
      if (getActivePlayers(room).length === 1) {
        room.hostId = socket.id;
      } else {
        syncHostIfNeeded(room);
      }
      io.to(roomId).emit("room_updated", room);
      io.emit("rooms_list_updated");
      console.log(`${playerName} reconnected to room ${roomId}`);
      return;
    }

    if (room.status !== "waiting") {
      socket.emit("error", "房间暂不可加入");
      return;
    }

    if (activePlayers.length >= room.maxPlayers) {
      socket.emit("error", "房间人数已满");
      return;
    }

    if (existingPlayer) {
      if (existingPlayer.isOnline) {
        socket.emit("error", "玩家名已存在");
        return;
      }

      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.name = playerName;
      existingPlayer.accountUsername = accountUsername ?? existingPlayer.accountUsername;
      existingPlayer.isOnline = true;
      existingPlayer.lastSeenAt = null;
      existingPlayer.isReady = false;
      existingPlayer.action = "";

      if (oldId && oldId !== socket.id) {
        delete socketRoomIndex[oldId];
      }

      socketRoomIndex[socket.id] = roomId;
      room.emptySince = null;
      socket.join(roomId);

      if (getActivePlayers(room).length === 1) {
        room.hostId = socket.id;
      } else {
        syncHostIfNeeded(room);
      }

      io.to(roomId).emit("room_updated", room);
      io.emit("rooms_list_updated");
      console.log(`${playerName} rejoined room ${roomId}`);
      return;
    }

    const firstTemplate = room.script.roleTemplates[0];
    if (!firstTemplate) {
      socket.emit("error", "该剧本未配置角色模板");
      return;
    }

    const newPlayer: Player = {
      id: socket.id,
      name: playerName,
      accountUsername,
      isReady: false,
      action: "",
      location: "初始地点",
      isOnline: true,
      lastSeenAt: null,
      selectedSavedCharacterId: null,
      canCreateCustomCharacter: room.gameSetupMode === "new_game",
      apiFunctions: {
        actionCollector: false,
        mainStory: false,
        stateProcessor: false
      },
      aiSettings: cloneDefaultAISettings(),
      selectedRoleTemplateId: firstTemplate.id,
      characterProfile: createDefaultCharacterProfile(firstTemplate),
      currentHP: getMaxHPByAttributes(firstTemplate.baseAttributes),
      currentMP: getMaxMPByAttributes(firstTemplate.baseAttributes),
      statusEffects: []
    };

    room.players.push(newPlayer);
    room.emptySince = null;
    socketRoomIndex[socket.id] = roomId;
    socket.join(roomId);

    if (getActivePlayers(room).length === 1) {
      room.hostId = socket.id;
    } else {
      syncHostIfNeeded(room);
    }

    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");
    console.log(`${playerName} joined room ${roomId}`);
  });

  socket.on("toggle_player_ai_function", ({ roomId, functionType }: { roomId: string; functionType: AIFunctionType }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found.");
      return;
    }

    if (!FUNCTION_TYPES.includes(functionType)) {
      socket.emit("error", "Invalid function type.");
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit("error", "Player not found in the room.");
      return;
    }

    player.apiFunctions[functionType] = !player.apiFunctions[functionType];
    io.to(roomId).emit("room_updated", room);
  });

  socket.on("update_player_ai_config", ({ roomId, aiSettings }: { roomId: string; aiSettings: PlayerAISettings }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found.");
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit("error", "Player not found in the room.");
      return;
    }

    const defaults = cloneDefaultAISettings();
    player.aiSettings = {
      ...defaults,
      ...aiSettings,
      defaultProvider: aiSettings.defaultProvider || defaults.defaultProvider,
      defaultEndpoint: aiSettings.defaultEndpoint ?? defaults.defaultEndpoint,
      defaultApiKey: aiSettings.defaultApiKey ?? defaults.defaultApiKey,
      actionCollector: {
        ...defaults.actionCollector,
        ...aiSettings.actionCollector,
        connection: {
          ...defaults.actionCollector.connection,
          ...(aiSettings.actionCollector?.connection || {})
        },
        prompt: {
          ...defaults.actionCollector.prompt,
          ...(aiSettings.actionCollector?.prompt || {})
        }
      },
      mainStory: {
        ...defaults.mainStory,
        ...aiSettings.mainStory,
        connection: {
          ...defaults.mainStory.connection,
          ...(aiSettings.mainStory?.connection || {})
        },
        prompt: {
          ...defaults.mainStory.prompt,
          ...(aiSettings.mainStory?.prompt || {})
        }
      },
      stateProcessor: {
        ...defaults.stateProcessor,
        ...aiSettings.stateProcessor,
        connection: {
          ...defaults.stateProcessor.connection,
          ...(aiSettings.stateProcessor?.connection || {})
        },
        prompt: {
          ...defaults.stateProcessor.prompt,
          ...(aiSettings.stateProcessor?.prompt || {})
        }
      }
    };

    io.to(roomId).emit("room_updated", room);
  });

  socket.on("select_role_template", ({ roomId, roleTemplateId }: { roomId: string; roleTemplateId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.status !== "waiting") {
      socket.emit("error", "仅可在等待大厅选择角色");
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const roleExists = room.script.roleTemplates.some((role) => role.id === roleTemplateId);
    if (!roleExists) {
      socket.emit("error", "角色模板不存在");
      return;
    }

    if (room.gameSetupMode === "load_save" && !player.canCreateCustomCharacter) {
      socket.emit("error", "加载存档模式下，请先选择存档角色或切换到创建角色");
      return;
    }

    player.selectedRoleTemplateId = roleTemplateId;
    const selectedTemplate = room.script.roleTemplates.find((role) => role.id === roleTemplateId);
    if (selectedTemplate) {
      player.characterProfile = createDefaultCharacterProfile(selectedTemplate);
      applyCharacterProfilePatch(room, player, {});
    }

    io.to(roomId).emit("room_updated", room);
  });

  socket.on("update_character_profile", ({ roomId, profile }: { roomId: string; profile: Partial<PlayerCharacterProfile> }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.status !== "waiting") {
      socket.emit("error", "仅可在等待大厅编辑角色信息");
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (room.gameSetupMode === "load_save" && !player.canCreateCustomCharacter) {
      socket.emit("error", "加载存档模式下，请先选择存档角色或切换到创建角色");
      return;
    }

    applyCharacterProfilePatch(room, player, profile);

    io.to(roomId).emit("room_updated", room);
  });

  socket.on("set_game_setup_mode", ({ roomId, mode }: { roomId: string; mode: "new_game" | "load_save" }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("error", "只有房主可以切换游戏模式");
      return;
    }

    if (room.hasStarted || room.status !== "waiting") {
      socket.emit("error", "游戏开始后不可切换模式");
      return;
    }

    switchGameSetupMode(room, mode);
    io.to(roomId).emit("room_updated", room);
  });

  socket.on("claim_saved_character", ({ roomId, characterId }: { roomId: string; characterId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.status !== "waiting") {
      socket.emit("error", "仅可在等待大厅选择角色");
      return;
    }

    if (room.gameSetupMode !== "load_save") {
      socket.emit("error", "当前不是加载存档模式");
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    try {
      claimSavedCharacterForPlayer(room, player, characterId);
    } catch (error) {
      socket.emit("error", String((error as Error)?.message ?? error));
      return;
    }

    io.to(roomId).emit("room_updated", room);
  });

  socket.on("set_custom_character_mode", ({ roomId, enabled }: { roomId: string; enabled: boolean }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.status !== "waiting") {
      socket.emit("error", "仅可在等待大厅切换角色创建模式");
      return;
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (room.gameSetupMode !== "load_save") {
      player.canCreateCustomCharacter = true;
      io.to(roomId).emit("room_updated", room);
      return;
    }

    setPlayerCustomCharacterMode(room, player, enabled);
    io.to(roomId).emit("room_updated", room);
  });

  socket.on("publish_shared_asset", ({
    roomId,
    assetType,
    id,
    name,
    updatedAt,
    payload
  }: {
    roomId: string;
    assetType: "script" | "save";
    id: string;
    name: string;
    updatedAt: number;
    payload: any;
  }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (!id || !name) {
      socket.emit("error", "共享资源缺少必要信息");
      return;
    }

    const envelope: SharedAssetEnvelope<any> = {
      assetType,
      id,
      name,
      hash: computeHash(payload),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      ownerId: socket.id,
      payload
    };

    room.sharedAssets[assetType] = envelope;

    if (assetType === "script") {
      const nextScript = payload as ScriptDefinition;
      if (!nextScript || !Array.isArray(nextScript.roleTemplates) || !nextScript.roleTemplates.length) {
        socket.emit("error", "共享剧本格式无效");
        return;
      }
      room.script = nextScript;
      room.scriptId = nextScript.id;
      room.players.forEach((p) => {
        if (!p.selectedRoleTemplateId || !nextScript.roleTemplates.some((r) => r.id === p.selectedRoleTemplateId)) {
          p.selectedRoleTemplateId = nextScript.roleTemplates[0]?.id || null;
          if (nextScript.roleTemplates[0]) {
            p.characterProfile = createDefaultCharacterProfile(nextScript.roleTemplates[0]);
            applyCharacterProfilePatch(room, p, {});
          }
        }
      });
    }

    io.to(roomId).emit("room_updated", room);
  });

  socket.on("request_shared_asset", ({ roomId, assetType }: { roomId: string; assetType: "script" | "save" }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const asset = room.sharedAssets[assetType];
    if (!asset) {
      socket.emit("error", "该房间暂无可下载资源");
      return;
    }

    socket.emit("shared_asset_payload", asset);
  });

  socket.on("start_game", ({ roomId }: { roomId: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit("error", "只有房主可以开始游戏");
      return;
    }

    if (!validateStartCondition(room)) {
      socket.emit("error", "三个AI功能都至少需要一名玩家提供API");
      return;
    }

    if (room.gameSetupMode === "load_save") {
      const activePlayers = getActivePlayers(room);
      const hasUnassigned = activePlayers.some((player) => !player.selectedSavedCharacterId && !player.canCreateCustomCharacter);
      if (hasUnassigned) {
        socket.emit("error", "加载存档模式下，仍有玩家未选择角色或未进入创建角色");
        return;
      }
    }

    room.status = "playing";
    room.hasStarted = true;
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");
    console.log(`Game started in room ${roomId}`);
  });

  socket.on("chat_message", ({ roomId, message }: { roomId: string; message: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const newLog = {
      id: Date.now().toString(),
      发送者: player.name,
      内容: message,
      类型: "OOC",
      时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    room.logs.push(newLog);
    io.to(roomId).emit("new_log", newLog);
  });

  socket.on("submit_action", ({ roomId, action }: { roomId: string; action: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    if (player.isReady) return;

    player.action = action;
    player.isReady = true;

    const activePlayers = getActivePlayers(room);
    const readyCount = activePlayers.filter((p) => p.isReady).length;
    io.to(roomId).emit("turn_progress", { readyCount, total: activePlayers.length });
    io.to(roomId).emit("room_updated", room);

    const allReady = activePlayers.length > 0 && activePlayers.every((p) => p.isReady);

    if (allReady) {
      room.status = "processing";
      io.to(roomId).emit("room_updated", room);
      io.emit("rooms_list_updated");
      processTurn(roomId);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    removePlayerFromRoom(socket.id);
  });
});

async function processTurn(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  try {
    io.to(roomId).emit("story_stream_start");

    const groupedActions = await runActionCollector(room);

    room.status = "story_generation";
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");

    const storyRaw = await runMainStory(room, groupedActions);
    const storyPayload = safeJsonParse<MainStoryPayload>(storyRaw);
    if (!storyPayload || !Array.isArray(storyPayload.segments)) {
      throw new Error("mainStory 输出JSON无效");
    }

    io.to(roomId).emit("story_stream_end");

    room.status = "settlement";
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");

    const storyByPlayer: Record<string, string> = {};
    const globalSummary = typeof storyPayload.globalSummary === "string" ? storyPayload.globalSummary.trim() : "";

    for (const player of room.players) {
      storyByPlayer[player.id] = globalSummary ? `${globalSummary}\n\n` : "";
    }

    const grouped = groupedActions as { groups?: Array<{ groupId?: string; playerIds?: string[] }>; rawActions?: Array<{ playerId?: string; playerName?: string }> };
    const groupPlayerMap = new Map<string, string[]>();
    for (const g of grouped?.groups || []) {
      if (!g?.groupId) continue;
      const ids = Array.isArray(g.playerIds) ? g.playerIds : [];
      groupPlayerMap.set(g.groupId, ids);
    }

    const nameToId = new Map<string, string>();
    for (const a of grouped?.rawActions || []) {
      const name = String(a?.playerName || "").trim();
      const id = String(a?.playerId || "").trim();
      if (name && id) nameToId.set(name, id);
    }
    for (const p of room.players) {
      if (p.name && p.id) nameToId.set(p.name, p.id);
    }

    for (const seg of storyPayload.segments) {
      const title = (seg.title || "").trim();
      const content = (seg.content || "").trim();
      const block = [title, content].filter(Boolean).join("\n").trim();
      if (!block) continue;

      const directIds = Array.isArray(seg.visibleToPlayerIds) ? seg.visibleToPlayerIds : [];
      let resolvedIds = directIds.filter((id) => room.players.some((p) => p.id === id));

      if (resolvedIds.length === 0 && seg.groupId && groupPlayerMap.has(seg.groupId)) {
        resolvedIds = (groupPlayerMap.get(seg.groupId) || []).filter((id) => room.players.some((p) => p.id === id));
      }

      if (resolvedIds.length === 0 && title) {
        const titleNames = Array.from(title.matchAll(/【([^\]]+)】/g)).map((m) => String(m[1] || "").trim()).filter(Boolean);
        resolvedIds = titleNames
          .map((n) => nameToId.get(n) || "")
          .filter((id) => Boolean(id) && room.players.some((p) => p.id === id));
      }

      if (resolvedIds.length === 0) {
        resolvedIds = room.players.map((p) => p.id);
      }

      for (const playerId of resolvedIds) {
        if (!storyByPlayer[playerId]) storyByPlayer[playerId] = "";
        storyByPlayer[playerId] += `${block}\n\n`;
      }
    }

    if (Array.isArray(storyPayload.nextHints)) {
      for (const hintItem of storyPayload.nextHints) {
        if (!hintItem || typeof hintItem.playerId !== "string") continue;
        const hint = typeof hintItem.hint === "string" ? hintItem.hint.trim() : "";
        if (!hint) continue;
        if (!storyByPlayer[hintItem.playerId]) storyByPlayer[hintItem.playerId] = "";
        storyByPlayer[hintItem.playerId] += `【下一步可选行动提示】${hint}\n`;
      }
    }

    room.players.forEach((player) => {
      const personalStory = (storyByPlayer[player.id] || "").trim() || "本回合没有你的可见剧情。";
      io.to(player.id).emit("player_story", {
        story: personalStory,
        round: room.currentRound
      });
    });

    const stateStoryText = buildStateStoryText(storyPayload) || Object.values(storyByPlayer).join("\n\n");
    const changes = await runStateProcessor(room, stateStoryText);
    applyStateChanges(room, changes);

    const stateLog = {
      id: `${Date.now()}-state`,
      发送者: "系统",
      内容: `状态结算: ${JSON.stringify(changes)}`,
      类型: "系统",
      时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    room.logs.push(stateLog);

    room.currentRound += 1;
    room.status = "waiting";
    room.players.forEach((p) => {
      p.isReady = false;
      p.action = "";
    });

    io.to(roomId).emit("turn_progress", { readyCount: 0, total: getActivePlayers(room).length });
    io.to(roomId).emit("round_complete", {
      room,
      story: globalSummary || "回合处理完成。"
    });
    io.emit("rooms_list_updated");
  } catch (error) {
    console.error("Error processing turn:", error);
    io.to(roomId).emit("story_stream_end");
    io.to(roomId).emit("error", `AI 处理回合失败: ${String((error as Error)?.message ?? error)}`);
    room.status = "waiting";
    room.players.forEach((p) => {
      p.isReady = false;
    });
    io.to(roomId).emit("turn_progress", { readyCount: 0, total: getActivePlayers(room).length });
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/scripts", async (_req, res) => {
  await adminStateReady;
  const scripts = adminState.scripts
    .filter((script) => script.isPublished)
    .map((script) => ({
      id: script.id,
      title: script.title,
      description: script.description,
      tags: script.tags,
      content: script.content,
      settingPrompt: script.settingPrompt,
      finalGoal: script.finalGoal,
      roleTemplates: script.roleTemplates
    }));
  res.json({ scripts });
});

app.post("/api/auth/register", async (req, res) => {
  await adminStateReady;
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username) {
    res.status(400).json({ error: "用户名不能为空" });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "密码不能为空" });
    return;
  }

  const exists = adminState.users.some((user) => user.username === username);
  if (exists) {
    res.status(400).json({ error: "用户名已存在" });
    return;
  }

  const now = Date.now();
  const user: ManagedUser = {
    uid: generateUserUid(),
    username,
    password: sha256(password),
    createdAt: now,
    status: "active",
    role: "player",
    lastLoginAt: now
  };

  adminState.users.push(user);
  addAdminLog("system", "register_user", "user", username);
  await persistAdminState();

  res.json({
    token: issuePlayerToken(user),
    expiresIn: PLAYER_TOKEN_TTL_SECONDS,
    user: buildAuthUserResponse(user)
  });
});

app.post("/api/auth/login", async (req, res) => {
  await adminStateReady;
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    res.status(400).json({ error: "请输入用户名和密码" });
    return;
  }

  const user = adminState.users.find((item) => item.username === username);
  if (!user || user.password !== sha256(password)) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }

  if (user.status === "disabled") {
    res.status(403).json({ error: "该账号已被禁用" });
    return;
  }

  user.lastLoginAt = Date.now();
  addAdminLog(username, "player_login", "user", username);
  await persistAdminState();

  res.json({
    token: issuePlayerToken(user),
    expiresIn: PLAYER_TOKEN_TTL_SECONDS,
    user: buildAuthUserResponse(user)
  });
});

app.get("/api/auth/me", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  res.json({ user: buildAuthUserResponse(user) });
});

app.post("/api/auth/change-password", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const oldPassword = String(req.body?.oldPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: "请填写旧密码与新密码" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "新密码长度至少 6 位" });
    return;
  }

  if (sha256(oldPassword) !== user.password) {
    res.status(400).json({ error: "旧密码错误" });
    return;
  }

  user.password = sha256(newPassword);
  addAdminLog(user.username, "change_password", "user", user.username);
  await persistAdminState();

  res.json({ ok: true });
});

app.get("/api/prompts/defaults", async (_req, res) => {
  const data: Record<AIFunctionType, Record<PromptRole, string>> = {
    actionCollector: { system: "", user: "", model: "" },
    mainStory: { system: "", user: "", model: "" },
    stateProcessor: { system: "", user: "", model: "" }
  };

  for (const fn of FUNCTION_TYPES) {
    data[fn].system = await readPromptFile(fn, "system");
    data[fn].user = await readPromptFile(fn, "user");
    data[fn].model = await readPromptFile(fn, "model");
  }

  res.json(data);
});

app.post("/api/models", async (req, res) => {
  const provider = String(req.body?.provider || "openaiCompatible") as AIProviderType;
  const endpointInput = String(req.body?.endpoint || "").trim();
  const apiKey = String(req.body?.apiKey || "").trim();

  const endpoint = endpointInput || PROVIDER_DEFAULT_ENDPOINTS[provider] || "";

  if (!endpoint) {
    res.status(400).json({ error: "endpoint is required" });
    return;
  }

  try {
    if (provider === "gemini") {
      const response = await fetch(getModelsUrl("gemini", endpoint), {
        method: "GET",
        headers: {
          ...buildAuthHeaders("gemini", apiKey)
        }
      });

      if (!response.ok) {
        const detail = await response.text();
        res.status(response.status).json({ error: detail || "获取Gemini模型失败" });
        return;
      }

      const payload = await response.json() as any;
      const rawList = Array.isArray(payload?.models) ? payload.models : [];
      const models = rawList.map((m: any) => ({
        id: String(m.name || "").replace(/^models\//, ""),
        name: String(m.displayName || m.name || "")
      })).filter((m: { id: string }) => m.id);

      res.json({ models });
      return;
    }

    const response = await fetch(getModelsUrl(provider, endpoint), {
      method: "GET",
      headers: {
        ...buildAuthHeaders(provider, apiKey)
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      res.status(response.status).json({ error: detail || "获取模型失败" });
      return;
    }

    const payload = await response.json() as any;
    const rawList = Array.isArray(payload?.data) ? payload.data : [];
    const models = rawList.map((m: any) => ({
      id: String(m.id || m.name || ""),
      name: String(m.display_name || m.id || m.name || "")
    })).filter((m: { id: string }) => m.id);

    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: `模型获取异常: ${String((error as Error)?.message ?? error)}` });
  }
});

app.post("/api/admin/login", async (req, res) => {
  await adminStateReady;
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    res.status(400).json({ error: "请输入用户名和密码" });
    return;
  }

  const user = adminState.users.find((item) => item.username === username && item.role === "moderator");
  if (!user || user.password !== sha256(password)) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }

  if (user.status === "disabled") {
    res.status(403).json({ error: "该管理员账户已被禁用" });
    return;
  }

  user.lastLoginAt = Date.now();
  addAdminLog(user.username, "admin_login", "system", user.username);
  await persistAdminState();

  res.json({
    token: issueAdminToken(user.username),
    expiresIn: ADMIN_TOKEN_TTL_SECONDS,
    user: buildAuthUserResponse(user)
  });
});

app.get("/api/admin/me", requireAdmin, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { adminUser: ManagedUser }).adminUser;
  res.json({ user: buildAuthUserResponse(user) });
});

app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
  await adminStateReady;
  const allRooms = Object.values(rooms);
  const activeRooms = allRooms.filter((room) => getActivePlayers(room).length > 0);

  res.json({
    users: {
      total: adminState.users.length,
      active: adminState.users.filter((user) => user.status === "active").length,
      disabled: adminState.users.filter((user) => user.status === "disabled").length,
      moderators: adminState.users.filter((user) => user.role === "moderator").length
    },
    scripts: {
      total: adminState.scripts.length,
      published: adminState.scripts.filter((script) => script.isPublished).length,
      builtin: adminState.scripts.filter((script) => script.source === "builtin").length,
      custom: adminState.scripts.filter((script) => script.source === "admin").length
    },
    rooms: {
      total: allRooms.length,
      active: activeRooms.length,
      waiting: allRooms.filter((room) => room.status === "waiting").length,
      processing: allRooms.filter((room) => room.status !== "waiting").length,
      onlinePlayers: allRooms.reduce((count, room) => count + getActivePlayers(room).length, 0)
    },
    recentLogs: adminState.logs.slice(0, 10)
  });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  await adminStateReady;
  const query = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim() as AdminUserStatus | "";
  const role = String(req.query.role || "").trim() as AdminUserRole | "";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));

  let list = [...adminState.users];
  if (query) list = list.filter((user) => user.username.toLowerCase().includes(query) || user.uid.toLowerCase().includes(query));
  if (status === "active" || status === "disabled") list = list.filter((user) => user.status === status);
  if (role === "player" || role === "moderator") list = list.filter((user) => user.role === role);

  list.sort((a, b) => b.createdAt - a.createdAt);
  const total = list.length;
  const start = (page - 1) * pageSize;

  res.json({
    rows: list.slice(start, start + pageSize).map(buildAuthUserResponse),
    total,
    page,
    pageSize
  });
});

app.patch("/api/admin/users/:username", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const username = String(req.params.username || "").trim();
  const target = adminState.users.find((user) => user.username === username);

  if (!target) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  const nextStatus = req.body?.status as AdminUserStatus | undefined;
  const nextRole = req.body?.role as AdminUserRole | undefined;
  const nextPassword = typeof req.body?.password === "string" ? req.body.password : "";

  if (nextStatus && nextStatus !== "active" && nextStatus !== "disabled") {
    res.status(400).json({ error: "status 参数无效" });
    return;
  }
  if (nextRole && nextRole !== "player" && nextRole !== "moderator") {
    res.status(400).json({ error: "role 参数无效" });
    return;
  }

  if (target.username === operator.username) {
    if (nextStatus === "disabled") {
      res.status(400).json({ error: "不能禁用当前登录管理员" });
      return;
    }
    if (nextRole === "player") {
      res.status(400).json({ error: "不能降级当前登录管理员" });
      return;
    }
  }

  if (nextStatus) target.status = nextStatus;
  if (nextRole) target.role = nextRole;
  if (nextPassword) {
    if (nextPassword.length < 6) {
      res.status(400).json({ error: "新密码长度至少 6 位" });
      return;
    }
    target.password = sha256(nextPassword);
  }

  addAdminLog(operator.username, "update_user", "user", target.username, {
    status: target.status,
    role: target.role,
    passwordReset: Boolean(nextPassword)
  });

  await persistAdminState();
  res.json({ user: buildAuthUserResponse(target) });
});

app.delete("/api/admin/users/:username", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const username = String(req.params.username || "").trim();
  const index = adminState.users.findIndex((user) => user.username === username);

  if (index < 0) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  const target = adminState.users[index];

  if (target.username === operator.username) {
    res.status(400).json({ error: "不能删除当前登录管理员" });
    return;
  }

  if (target.role === "moderator") {
    const moderators = adminState.users.filter((user) => user.role === "moderator");
    if (moderators.length <= 1) {
      res.status(400).json({ error: "至少需要保留一个管理员账号" });
      return;
    }
  }

  adminState.users.splice(index, 1);
  addAdminLog(operator.username, "delete_user", "user", target.username, { uid: target.uid, role: target.role });
  await persistAdminState();

  res.json({ ok: true });
});

app.get("/api/admin/scripts", requireAdmin, async (_req, res) => {
  await adminStateReady;
  const rows = [...adminState.scripts].sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ rows });
});

app.post("/api/admin/scripts", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const base = sanitizeScriptInput(req.body || {});
  const scriptId = String(base.id || "").trim();

  if (!scriptId) {
    res.status(400).json({ error: "剧本 ID 不能为空" });
    return;
  }

  if (adminState.scripts.some((script) => script.id === scriptId)) {
    res.status(400).json({ error: "剧本 ID 已存在" });
    return;
  }

  if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) {
    res.status(400).json({ error: "剧本至少需要一个角色模板" });
    return;
  }

  const now = Date.now();
  const script: ManagedScript = {
    ...base,
    id: scriptId,
    source: "admin",
    isPublished: req.body?.isPublished !== false,
    createdAt: now,
    updatedAt: now
  };

  adminState.scripts.push(script);
  addAdminLog(operator.username, "create_script", "script", script.id, { title: script.title });
  await persistAdminState();

  res.json({ script });
});

app.put("/api/admin/scripts/:id", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const id = String(req.params.id || "").trim();
  const index = adminState.scripts.findIndex((script) => script.id === id);

  if (index < 0) {
    res.status(404).json({ error: "剧本不存在" });
    return;
  }

  const current = adminState.scripts[index];
  const base = sanitizeScriptInput({ ...current, ...req.body, id: current.id });

  if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) {
    res.status(400).json({ error: "剧本至少需要一个角色模板" });
    return;
  }

  const next: ManagedScript = {
    ...base,
    id: current.id,
    source: current.source,
    isPublished: typeof req.body?.isPublished === "boolean" ? req.body.isPublished : current.isPublished,
    createdAt: current.createdAt,
    updatedAt: Date.now()
  };

  adminState.scripts[index] = next;
  addAdminLog(operator.username, "update_script", "script", id, { title: next.title });
  await persistAdminState();

  res.json({ script: next });
});

app.patch("/api/admin/scripts/:id/publish", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const id = String(req.params.id || "").trim();
  const script = adminState.scripts.find((item) => item.id === id);

  if (!script) {
    res.status(404).json({ error: "剧本不存在" });
    return;
  }

  script.isPublished = Boolean(req.body?.isPublished);
  script.updatedAt = Date.now();
  addAdminLog(operator.username, script.isPublished ? "publish_script" : "unpublish_script", "script", id);
  await persistAdminState();

  res.json({ script });
});

app.delete("/api/admin/scripts/:id", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const id = String(req.params.id || "").trim();
  const index = adminState.scripts.findIndex((script) => script.id === id);

  if (index < 0) {
    res.status(404).json({ error: "剧本不存在" });
    return;
  }

  if (adminState.scripts[index].source === "builtin") {
    res.status(400).json({ error: "内置剧本不允许删除" });
    return;
  }

  adminState.scripts.splice(index, 1);
  addAdminLog(operator.username, "delete_script", "script", id);
  await persistAdminState();

  res.json({ ok: true });
});

app.get("/api/admin/rooms", requireAdmin, async (_req, res) => {
  await adminStateReady;
  const rows = Object.values(rooms).map((room) => ({
    id: room.id,
    name: room.name,
    scriptId: room.scriptId,
    scriptTitle: room.script.title,
    hostId: room.hostId,
    status: room.status,
    hasStarted: room.hasStarted,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      accountUsername: player.accountUsername,
      isOnline: player.isOnline,
      isReady: player.isReady
    })),
    activePlayers: getActivePlayers(room).length,
    maxPlayers: room.maxPlayers,
    currentRound: room.currentRound,
    logCount: room.logs.length
  }));

  res.json({ rows });
});

app.post("/api/admin/rooms/:id/force-close", requireAdmin, async (req, res) => {
  await adminStateReady;
  const operator = (req as Request & { adminUser: ManagedUser }).adminUser;
  const id = String(req.params.id || "").trim();
  const room = rooms[id];

  if (!room) {
    res.status(404).json({ error: "房间不存在" });
    return;
  }

  room.players.forEach((player) => {
    delete socketRoomIndex[player.id];
    io.sockets.sockets.get(player.id)?.leave(id);
  });
  delete rooms[id];
  io.emit("rooms_list_updated");

  addAdminLog(operator.username, "force_close_room", "room", id, { roomName: room.name });
  await persistAdminState();

  res.json({ ok: true });
});

app.get("/api/admin/logs", requireAdmin, async (req, res) => {
  await adminStateReady;
  const query = String(req.query.q || "").trim().toLowerCase();
  const targetType = String(req.query.targetType || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

  let rows = [...adminState.logs];
  if (query) {
    rows = rows.filter((log) => {
      const haystack = `${log.operator} ${log.action} ${log.targetId} ${JSON.stringify(log.details || {})}`.toLowerCase();
      return haystack.includes(query);
    });
  }
  if (["user", "script", "room", "system"].includes(targetType)) {
    rows = rows.filter((log) => log.targetType === targetType);
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  rows = rows.slice(start, start + pageSize);

  res.json({ rows, total, page, pageSize });
});

app.get("/api/workshop/scripts", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const query = String(req.query.q || "").trim().toLowerCase();
  const mineOnly = String(req.query.mine || "").trim() === "1";

  let rows = adminState.workshopScripts.filter((script) => (mineOnly ? script.ownerUid === user.uid : script.isPublic || script.ownerUid === user.uid));

  if (query) {
    rows = rows.filter((script) => {
      const haystack = `${script.id} ${script.title} ${script.description} ${(script.tags || []).join(" ")} ${script.ownerUsername}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  rows.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ rows });
});

app.post("/api/workshop/scripts", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const base = sanitizeScriptInput(req.body || {});
  const now = Date.now();
  const scriptId = String(base.id || `workshop-${now}`).trim();

  if (!scriptId) {
    res.status(400).json({ error: "剧本 ID 不能为空" });
    return;
  }

  if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) {
    res.status(400).json({ error: "剧本至少需要一个角色模板" });
    return;
  }

  const exists = adminState.workshopScripts.find((item) => item.id === scriptId);
  if (exists) {
    res.status(400).json({ error: "剧本 ID 已存在" });
    return;
  }

  const record: WorkshopScriptRecord = {
    ...base,
    id: scriptId,
    ownerUid: user.uid,
    ownerUsername: user.username,
    isPublic: req.body?.isPublic !== false,
    createdAt: now,
    updatedAt: now,
    downloads: 0
  };

  adminState.workshopScripts.push(record);
  addAdminLog(user.username, "upload_workshop_script", "script", record.id, { isPublic: record.isPublic });
  await persistAdminState();

  res.json({ script: record });
});

app.put("/api/workshop/scripts/:id", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const id = String(req.params.id || "").trim();
  const index = adminState.workshopScripts.findIndex((item) => item.id === id);

  if (index < 0) {
    res.status(404).json({ error: "剧本不存在" });
    return;
  }

  const current = adminState.workshopScripts[index];
  if (current.ownerUid !== user.uid && user.role !== "moderator") {
    res.status(403).json({ error: "无权限修改该剧本" });
    return;
  }

  const base = sanitizeScriptInput({ ...current, ...req.body, id: current.id });
  if (!Array.isArray(base.roleTemplates) || base.roleTemplates.length === 0) {
    res.status(400).json({ error: "剧本至少需要一个角色模板" });
    return;
  }

  const next: WorkshopScriptRecord = {
    ...base,
    id: current.id,
    ownerUid: current.ownerUid,
    ownerUsername: current.ownerUsername,
    isPublic: typeof req.body?.isPublic === "boolean" ? req.body.isPublic : current.isPublic,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
    downloads: current.downloads
  };

  adminState.workshopScripts[index] = next;
  addAdminLog(user.username, "update_workshop_script", "script", id, { isPublic: next.isPublic });
  await persistAdminState();

  res.json({ script: next });
});

app.delete("/api/workshop/scripts/:id", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const id = String(req.params.id || "").trim();
  const index = adminState.workshopScripts.findIndex((item) => item.id === id);

  if (index < 0) {
    res.status(404).json({ error: "剧本不存在" });
    return;
  }

  const target = adminState.workshopScripts[index];
  if (target.ownerUid !== user.uid && user.role !== "moderator") {
    res.status(403).json({ error: "无权限删除该剧本" });
    return;
  }

  adminState.workshopScripts.splice(index, 1);
  addAdminLog(user.username, "delete_workshop_script", "script", id);
  await persistAdminState();

  res.json({ ok: true });
});

app.post("/api/workshop/scripts/:id/download", requirePlayer, async (req, res) => {
  await adminStateReady;
  const id = String(req.params.id || "").trim();
  const script = adminState.workshopScripts.find((item) => item.id === id);

  if (!script || !script.isPublic) {
    res.status(404).json({ error: "剧本不存在或未公开" });
    return;
  }

  script.downloads += 1;
  script.updatedAt = Date.now();
  await persistAdminState();

  res.json({ script });
});

app.get("/api/cloud/saves", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const rows = adminState.cloudSaves
    .filter((save) => save.ownerUid === user.uid)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((save) => ({
      id: save.id,
      name: save.name,
      ownerUid: save.ownerUid,
      ownerUsername: save.ownerUsername,
      createdAt: save.createdAt,
      updatedAt: save.updatedAt
    }));

  res.json({ rows });
});

app.get("/api/cloud/saves/:id", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const id = String(req.params.id || "").trim();
  const save = adminState.cloudSaves.find((item) => item.id === id && item.ownerUid === user.uid);

  if (!save) {
    res.status(404).json({ error: "云存档不存在" });
    return;
  }

  res.json({ save });
});

app.post("/api/cloud/saves", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const now = Date.now();
  const name = String(req.body?.name || "").trim();
  const data = req.body?.data;

  if (!name) {
    res.status(400).json({ error: "存档名称不能为空" });
    return;
  }

  if (data === undefined || data === null) {
    res.status(400).json({ error: "存档数据不能为空" });
    return;
  }

  const record: CloudSaveRecord = {
    id: String(req.body?.id || `cloud-${now}-${Math.random().toString(36).slice(2, 8)}`),
    name,
    data,
    ownerUid: user.uid,
    ownerUsername: user.username,
    createdAt: now,
    updatedAt: now
  };

  adminState.cloudSaves = [record, ...adminState.cloudSaves.filter((save) => save.id !== record.id)];
  addAdminLog(user.username, "upload_cloud_save", "system", record.id, { name: record.name });
  await persistAdminState();

  res.json({ save: record });
});

app.put("/api/cloud/saves/:id", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const id = String(req.params.id || "").trim();
  const save = adminState.cloudSaves.find((item) => item.id === id && item.ownerUid === user.uid);

  if (!save) {
    res.status(404).json({ error: "云存档不存在" });
    return;
  }

  const nextName = String(req.body?.name || save.name).trim();
  const nextData = req.body?.data ?? save.data;

  if (!nextName) {
    res.status(400).json({ error: "存档名称不能为空" });
    return;
  }

  save.name = nextName;
  save.data = nextData;
  save.updatedAt = Date.now();
  addAdminLog(user.username, "update_cloud_save", "system", save.id, { name: save.name });
  await persistAdminState();

  res.json({ save });
});

app.delete("/api/cloud/saves/:id", requirePlayer, async (req, res) => {
  await adminStateReady;
  const user = (req as Request & { playerUser: ManagedUser }).playerUser;
  const id = String(req.params.id || "").trim();
  const index = adminState.cloudSaves.findIndex((item) => item.id === id && item.ownerUid === user.uid);

  if (index < 0) {
    res.status(404).json({ error: "云存档不存在" });
    return;
  }

  adminState.cloudSaves.splice(index, 1);
  addAdminLog(user.username, "delete_cloud_save", "system", id);
  await persistAdminState();

  res.json({ ok: true });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

ViteExpress.bind(app, httpServer);
