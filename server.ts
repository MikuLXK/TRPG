import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import ViteExpress from "vite-express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { promises as fs } from "fs";

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
}

const FUNCTION_TYPES: AIFunctionType[] = ["actionCollector", "mainStory", "stateProcessor"];

const PROVIDER_DEFAULT_ENDPOINTS: Record<AIProviderType, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek: "https://api.deepseek.com/v1",
  claude: "https://api.anthropic.com/v1",
  openaiCompatible: "https://api.openai.com/v1"
};

const defaultAISettings: PlayerAISettings = {
  defaultProvider: "openai",
  defaultEndpoint: PROVIDER_DEFAULT_ENDPOINTS.openai,
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
  return (conn.provider || settings.defaultProvider || "openai") as AIProviderType;
};

const getEndpointForConnection = (provider: AIProviderType, settings: PlayerAISettings, conn: AIConnectionConfig): string => {
  return conn.endpoint || settings.defaultEndpoint || PROVIDER_DEFAULT_ENDPOINTS[provider];
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
  if (provider === "claude") return `${normalized}/models`;
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
  const systemPrompt = await getPromptSystemOverride(providerPlayer, "mainStory");

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

const emitRoomAndListUpdate = (roomId: string) => {
  const room = rooms[roomId];
  if (room) {
    io.to(roomId).emit("room_updated", room);
  }
  io.emit("rooms_list_updated");
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

  emitRoomAndListUpdate(roomId);
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

  if (changed) {
    io.emit("rooms_list_updated");
  }
};

setInterval(sweepEmptyRooms, ROOM_SWEEP_INTERVAL_MS);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("get_rooms", () => {
    const roomList = Object.values(rooms).map((r) => ({
      id: r.id,
      name: r.name,
      script: r.scriptId,
      players: r.players.length,
      maxPlayers: r.maxPlayers,
      locked: !!r.password,
      status: r.status,
      inGame: r.status !== "waiting"
    }));
    socket.emit("rooms_list", roomList);
  });

  socket.on("create_room", (data: { roomName: string; scriptId: string; password?: string; intro?: string; playerName: string }) => {
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
        aiSettings: cloneDefaultAISettings()
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
      emptySince: null
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
      aiSettings: cloneDefaultAISettings()
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
      defaultEndpoint: aiSettings.defaultEndpoint || defaults.defaultEndpoint,
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

    player.action = action;
    player.isReady = true;

    const allReady = room.players.every((p) => p.isReady);

    io.to(roomId).emit("room_updated", room);

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
    const groupedActions = await runActionCollector(room);

    room.status = "story_generation";
    io.to(roomId).emit("room_updated", room);
    io.emit("rooms_list_updated");

    const story = await runMainStory(room, groupedActions);

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

    io.to(roomId).emit("round_complete", {
      room,
      story: story || "本回合没有生成有效剧情。"
    });
    io.emit("rooms_list_updated");
  } catch (error) {
    console.error("Error processing turn:", error);
    io.to(roomId).emit("error", `AI 处理回合失败: ${String((error as Error)?.message ?? error)}`);
    room.status = "waiting";
    room.players.forEach((p) => {
      p.isReady = false;
    });
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
  const provider = String(req.body?.provider || "openai") as AIProviderType;
  const endpointInput = String(req.body?.endpoint || "").trim();
  const apiKey = String(req.body?.apiKey || "").trim();

  const endpoint = endpointInput || PROVIDER_DEFAULT_ENDPOINTS[provider] || PROVIDER_DEFAULT_ENDPOINTS.openai;

  if (!endpoint) {
    res.status(400).json({ error: "endpoint is required" });
    return;
  }

  try {
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
