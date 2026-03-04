import type { ScriptDefinition, ScriptOpeningConfig } from "../../src/types/Script";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const deepMergeValue = (base: unknown, patch: unknown): unknown => {
  if (Array.isArray(patch)) {
    return patch.map((item) => deepMergeValue(undefined, item));
  }
  if (!isRecord(patch)) return patch;
  const next: Record<string, unknown> = isRecord(base) ? { ...base } : {};
  for (const key of Object.keys(patch)) {
    next[key] = deepMergeValue(isRecord(base) ? base[key] : undefined, patch[key]);
  }
  return next;
};

const OPENING_PUBLIC_STATE_ROOT_KEYS = new Set(["环境", "社交", "战斗", "剧情", "任务列表", "约定列表", "记忆系统"]);

const pickPublicStatePatch = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!OPENING_PUBLIC_STATE_ROOT_KEYS.has(key)) continue;
    next[key] = value[key];
  }
  return Object.keys(next).length > 0 ? next : null;
};

const sanitizeStoryLine = (value: unknown) => {
  const speaker = String((value as any)?.speaker || "").trim();
  const text = String((value as any)?.text || "").trim();
  if (!speaker || !text) return null;
  return { speaker, text };
};

const sanitizeStorySegment = (value: unknown) => {
  const groupId = String((value as any)?.groupId || "").trim();
  const title = String((value as any)?.title || "").trim();
  const visibleToPlayerIds = Array.isArray((value as any)?.visibleToPlayerIds)
    ? (value as any).visibleToPlayerIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
    : undefined;
  const lines = Array.isArray((value as any)?.lines)
    ? (value as any).lines.map(sanitizeStoryLine).filter((line): line is { speaker: string; text: string } => Boolean(line))
    : [];
  if (!groupId || !title || lines.length === 0) return null;
  return { groupId, title, lines, visibleToPlayerIds };
};

const buildFallbackOpening = (script: ScriptDefinition): ScriptOpeningConfig => {
  const safeTitle = String(script?.title || "未命名剧本").trim() || "未命名剧本";
  const safeDescription = String(script?.description || "").trim();
  const safeFinalGoal = String(script?.finalGoal || "").trim();
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

const resolveScriptOpening = (script: ScriptDefinition): ScriptOpeningConfig | null => {
  const fallback = buildFallbackOpening(script);
  const source = script?.opening;
  if (source?.enabled === false) return null;
  if (!source || typeof source !== "object") return fallback;

  const initialState = source.initialState && typeof source.initialState === "object"
    ? source.initialState
    : fallback.initialState;
  const rawStory = source.openingStory && typeof source.openingStory === "object"
    ? source.openingStory
    : fallback.openingStory;
  const round = Number(rawStory.round);
  const publicLines = Array.isArray(rawStory.publicLines)
    ? rawStory.publicLines.map(sanitizeStoryLine).filter((line): line is { speaker: string; text: string } => Boolean(line))
    : [];
  const segments = Array.isArray(rawStory.segments)
    ? rawStory.segments.map(sanitizeStorySegment).filter((segment): segment is { groupId: string; title: string; lines: { speaker: string; text: string }[]; visibleToPlayerIds?: string[] } => Boolean(segment))
    : [];

  return {
    enabled: true,
    initialState,
    openingStory: {
      round: Number.isFinite(round) && round > 0 ? Math.floor(round) : fallback.openingStory.round,
      publicLines: publicLines.length > 0 ? publicLines : fallback.openingStory.publicLines,
      segments
    }
  };
};

export const registerCharacterSetupEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  computeHash: (value: unknown) => string;
  createDefaultCharacterProfile: (template: any) => any;
  applyCharacterProfilePatch: (room: any, player: any, patch: any) => void;
  switchGameSetupMode: (room: any, mode: "new_game" | "load_save") => void;
  claimSavedCharacterForPlayer: (room: any, player: any, characterId: string) => void;
  setPlayerCustomCharacterMode: (room: any, player: any, enabled: boolean) => void;
  validateStartCondition: (room: any) => boolean;
  getActivePlayers: (room: any) => Array<any>;
}) => {
  socket.on("select_role_template", ({ roomId, roleTemplateId }: { roomId: string; roleTemplateId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅选择角色");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    const roleExists = room.script.roleTemplates.some((role: any) => role.id === roleTemplateId);
    if (!roleExists) return socket.emit("error", "角色模板不存在");
    if (room.gameSetupMode === "load_save" && !player.canCreateCustomCharacter) {
      return socket.emit("error", "加载存档模式下，请先选择存档角色或切换到创建角色");
    }
    player.selectedRoleTemplateId = roleTemplateId;
    const selectedTemplate = room.script.roleTemplates.find((role: any) => role.id === roleTemplateId);
    if (selectedTemplate) {
      player.characterProfile = deps.createDefaultCharacterProfile(selectedTemplate);
      deps.applyCharacterProfilePatch(room, player, {});
    }
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("update_character_profile", ({ roomId, profile }: { roomId: string; profile: any }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅编辑角色信息");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (room.gameSetupMode === "load_save" && !player.canCreateCustomCharacter) {
      return socket.emit("error", "加载存档模式下，请先选择存档角色或切换到创建角色");
    }
    deps.applyCharacterProfilePatch(room, player, profile);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("set_game_setup_mode", ({ roomId, mode }: { roomId: string; mode: "new_game" | "load_save" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("error", "只有房主可以切换游戏模式");
    if (room.hasStarted || room.status !== "waiting") return socket.emit("error", "游戏开始后不可切换模式");
    deps.switchGameSetupMode(room, mode);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("claim_saved_character", ({ roomId, characterId }: { roomId: string; characterId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅选择角色");
    if (room.gameSetupMode !== "load_save") return socket.emit("error", "当前不是加载存档模式");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    try {
      deps.claimSavedCharacterForPlayer(room, player, characterId);
    } catch (error) {
      return socket.emit("error", String((error as Error)?.message ?? error));
    }
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("set_custom_character_mode", ({ roomId, enabled }: { roomId: string; enabled: boolean }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅切换角色创建模式");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (room.gameSetupMode !== "load_save") {
      player.canCreateCustomCharacter = true;
      return deps.io.to(roomId).emit("room_updated", room);
    }
    deps.setPlayerCustomCharacterMode(room, player, enabled);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("publish_shared_asset", ({ roomId, assetType, id, name, updatedAt, payload }: { roomId: string; assetType: "script" | "save"; id: string; name: string; updatedAt: number; payload: any }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (!id || !name) return socket.emit("error", "共享资源缺少必要信息");

    room.sharedAssets[assetType] = {
      assetType,
      id,
      name,
      hash: deps.computeHash(payload),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      ownerId: socket.id,
      payload
    };

    if (assetType === "script") {
      const nextScript = payload as ScriptDefinition;
      if (!nextScript || !Array.isArray(nextScript.roleTemplates) || !nextScript.roleTemplates.length) {
        return socket.emit("error", "共享剧本格式无效");
      }
      room.script = nextScript;
      room.scriptId = nextScript.id;
      room.players.forEach((p: any) => {
        if (!p.selectedRoleTemplateId || !nextScript.roleTemplates.some((r) => r.id === p.selectedRoleTemplateId)) {
          p.selectedRoleTemplateId = nextScript.roleTemplates[0]?.id || null;
          if (nextScript.roleTemplates[0]) {
            p.characterProfile = deps.createDefaultCharacterProfile(nextScript.roleTemplates[0]);
            deps.applyCharacterProfilePatch(room, p, {});
          }
        }
      });
    }
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("request_shared_asset", ({ roomId, assetType }: { roomId: string; assetType: "script" | "save" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    const asset = room.sharedAssets[assetType];
    if (!asset) return socket.emit("error", "该房间暂无可下载资源");
    socket.emit("shared_asset_payload", asset);
  });

  socket.on("start_game", ({ roomId }: { roomId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("error", "只有房主可以开始游戏");
    if (room.hasStarted || room.status !== "waiting") return socket.emit("error", "游戏已经开始");
    if (!deps.validateStartCondition(room)) return socket.emit("error", "三个AI功能都至少需要一名玩家提供API");
    if (room.gameSetupMode === "load_save") {
      const activePlayers = deps.getActivePlayers(room);
      const hasUnassigned = activePlayers.some((player: any) => !player.selectedSavedCharacterId && !player.canCreateCustomCharacter);
      if (hasUnassigned) return socket.emit("error", "加载存档模式下，仍有玩家未选择角色或未进入创建角色");
    }

    room.players.forEach((player: any) => {
      player.isReady = false;
      player.action = "";
    });

    const opening = resolveScriptOpening(room.script as ScriptDefinition);
    let openingLog: any = null;
    if (opening && opening.enabled !== false) {
      (room.script as ScriptDefinition).opening = opening;
      if (room.gameSetupMode !== "load_save") {
        const patch = pickPublicStatePatch(opening.initialState);
        if (patch) {
          room.stateTree = deepMergeValue(isRecord(room.stateTree) ? room.stateTree : {}, patch) as Record<string, unknown>;
        }
      }
      const openingRound = Number(opening.openingStory.round);
      if (Number.isFinite(openingRound) && openingRound > 0) {
        room.currentRound = Math.floor(openingRound);
      }
      const openingLocation = String((room.stateTree as any)?.环境?.具体地点 || (opening.initialState as any)?.环境?.具体地点 || "").trim();
      if (openingLocation) {
        room.players.forEach((player: any) => {
          player.location = openingLocation;
        });
      }
      openingLog = {
        id: `${Date.now()}-opening`,
        发送者: "系统",
        内容: JSON.stringify(opening.openingStory),
        类型: "旁白",
        时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      room.logs.push(openingLog);
    }

    room.status = "playing";
    room.hasStarted = true;
    deps.io.to(roomId).emit("room_updated", room);
    if (openingLog) {
      deps.io.to(roomId).emit("new_log", openingLog);
    }
    deps.io.emit("rooms_list_updated");
    console.log(`Game started in room ${roomId}`);
  });
};
