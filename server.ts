import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import ViteExpress from "vite-express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { promises as fs } from "fs";
import { getScriptById } from "./src/data/scripts";
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

interface Player {
  id: string;
  name: string;
  isReady: boolean;
  action: string;
  location: string;
  avatar?: string;
  role?: string;
  apiFunctions: Record<AIFunctionType, boolean>;
  aiSettings: PlayerAISettings;
  selectedRoleTemplateId: string | null;
  characterProfile: PlayerCharacterProfile;
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
  currentRound: number;
  logs: any[];
  maxPlayers: number;
  functionRotationIndex: Record<AIFunctionType, number>;
  emptySince: number | null;
  script: ScriptDefinition;
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

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

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
  return room.players.filter((player) => player.apiFunctions[functionType]);
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

  const actions = room.players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
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
    location: p.location
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

const removePlayerFromRoom = (socketId: string) => {
  const roomId = socketRoomIndex[socketId];
  if (!roomId) return;

  const room = rooms[roomId];
  delete socketRoomIndex[socketId];
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== socketId);

  if (room.players.length === 0) {
    room.emptySince = Date.now();
  } else {
    room.emptySince = null;
    if (room.hostId === socketId) {
      room.hostId = room.players[0].id;
    }
  }

  io.to(roomId).emit("room_updated", room);
  io.emit("rooms_list_updated");
};

const sweepEmptyRooms = () => {
  const now = Date.now();
  let changed = false;

  Object.entries(rooms).forEach(([roomId, room]) => {
    if (room.players.length > 0) {
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

  socket.on("get_rooms", () => {
    const roomList = Object.values(rooms).map((r) => ({
      id: r.id,
      name: r.name,
      script: r.script.title,
      players: r.players.length,
      maxPlayers: r.maxPlayers,
      locked: !!r.password,
      status: r.status,
      inGame: r.status !== "waiting"
    }));
    socket.emit("rooms_list", roomList);
  });

  socket.on("create_room", (data: { roomName: string; scriptId: string; password?: string; intro?: string; playerName: string; accountUsername?: string }) => {
    const script = getScriptById(data.scriptId);
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
      password: data.password,
      intro: data.intro,
      players: [{
        id: socket.id,
        name: data.playerName || "房主",
        isReady: false,
        action: "",
        location: "初始地点",
        role: "未分配",
        avatar: "bg-amber-500",
        apiFunctions: {
          actionCollector: false,
          mainStory: false,
          stateProcessor: false
        },
        aiSettings: cloneDefaultAISettings(),
        selectedRoleTemplateId: script.roleTemplates[0]?.id || null,
        characterProfile: createDefaultCharacterProfile(script.roleTemplates[0])
      }],
      status: "waiting",
      currentRound: 1,
      logs: [],
      maxPlayers: 4,
      functionRotationIndex: {
        actionCollector: 0,
        mainStory: 0,
        stateProcessor: 0
      },
      emptySince: null,
      script
    };

    rooms[roomId] = newRoom;
    socketRoomIndex[socket.id] = roomId;

    socket.join(roomId);
    socket.emit("room_created", { roomId, roomState: newRoom });
    io.to(roomId).emit("room_updated", newRoom);
    io.emit("rooms_list_updated");
    console.log(`Room created: ${roomId} (${data.roomName}) by ${data.playerName}`);
  });

  socket.on("join_room", ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "房间不存在");
      return;
    }

    if (room.status !== "waiting") {
      socket.emit("error", "游戏已开始，无法加入");
      return;
    }

    const existingPlayer = room.players.find((p) => p.name === playerName);
    if (existingPlayer) {
      socket.emit("error", "玩家名已存在");
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
      isReady: false,
      action: "",
      location: "初始地点",
      apiFunctions: {
        actionCollector: false,
        mainStory: false,
        stateProcessor: false
      },
      aiSettings: cloneDefaultAISettings(),
      selectedRoleTemplateId: firstTemplate.id,
      characterProfile: createDefaultCharacterProfile(firstTemplate)
    };

    room.players.push(newPlayer);
    room.emptySince = null;
    socketRoomIndex[socket.id] = roomId;
    socket.join(roomId);

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

    applyCharacterProfilePatch(room, player, profile);

    io.to(roomId).emit("room_updated", room);
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

    room.status = "playing";
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

    const readyCount = room.players.filter((p) => p.isReady).length;
    io.to(roomId).emit("turn_progress", { readyCount, total: room.players.length });
    io.to(roomId).emit("room_updated", room);

    const allReady = room.players.length > 0 && room.players.every((p) => p.isReady);

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

    const story = await runMainStory(room, groupedActions);

    for (let i = 0; i < story.length; i += 24) {
      const chunk = story.slice(i, i + 24);
      io.to(roomId).emit("story_stream_chunk", { chunk });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    io.to(roomId).emit("story_stream_end");

    room.status = "settlement";
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");

    const changes = await runStateProcessor(room, story);

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

    io.to(roomId).emit("turn_progress", { readyCount: 0, total: room.players.length });
    io.to(roomId).emit("round_complete", {
      room,
      story: story || "本回合没有生成有效剧情。"
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
    io.to(roomId).emit("turn_progress", { readyCount: 0, total: room.players.length });
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
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

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

ViteExpress.bind(app, httpServer);
