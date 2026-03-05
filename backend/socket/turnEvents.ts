import { applyMemorySummary, buildMemorySummaryUserPrompt, cleanupSummaryOutput } from "../turn/memory";
import { applyRoomSnapshot, findRoomSaveSlot, normalizeRoomSaveSlots, writeRoomSaveSlot } from "../turn/saveSlots";
import { composeStoryByPlayer } from "../turn/storyDispatch";

export const registerTurnEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  getActivePlayers: (room: any) => Array<any>;
  applyStateChanges: (room: any, changesInput: unknown) => void;
  processTurn: (roomId: string) => void;
  removePlayerFromRoom: (socketId: string) => void;
  runMainStory: (
    room: any,
    groupedActions: any,
    options?: { stream?: boolean; onStreamChunk?: (chunk: string) => void; rerollPrompt?: string }
  ) => Promise<any>;
  runMemorySummary: (args: {
    room: any;
    requesterId: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
  }) => Promise<string>;
  normalizeRoomMemoryConfig: (raw?: any) => any;
  normalizeRoomMemorySystem: (raw?: any) => any;
  buildMemoryTask: (memoryBase: any, configBase: any) => any;
}) => {
  const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const deepMergeValue = (base: unknown, patch: unknown): unknown => {
    if (Array.isArray(patch)) return patch.map((item) => deepMergeValue(undefined, item));
    if (!isRecord(patch)) return patch;
    const next: Record<string, unknown> = isRecord(base) ? { ...base } : {};
    for (const key of Object.keys(patch)) {
      next[key] = deepMergeValue(isRecord(base) ? base[key] : undefined, patch[key]);
    }
    return next;
  };
  const MANUAL_PUBLIC_STATE_ROOT_KEYS = new Set(["环境", "社交", "战斗", "剧情", "任务列表", "约定列表", "记忆系统"]);
  const STATE_SETTLEMENT_COMMAND_PATTERN = /^(?:状态结算[:：]\s*|\/(?:状态结算|settle|state_settlement)\s+)([\s\S]+)$/i;
  const pickCommandPublicPatch = (value: unknown): Record<string, unknown> | null => {
    if (!isRecord(value)) return null;
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (!MANUAL_PUBLIC_STATE_ROOT_KEYS.has(key)) continue;
      next[key] = value[key];
    }
    return Object.keys(next).length > 0 ? next : null;
  };
  const parseJsonMaybeFenced = (value: string) => {
    const source = String(value || "").trim();
    if (!source) return null;
    const unfenced = source.startsWith("```")
      ? source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
      : source;
    try {
      const parsed = JSON.parse(unfenced);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const pickStateSettlementPayload = (value: unknown): Record<string, unknown> | null => {
    if (!isRecord(value)) return null;
    const changeList = Array.isArray((value as any).changes) ? (value as any).changes : [];
    const statePatchRaw =
      (value as any).statePatch ??
      (value as any).状态补丁 ??
      (value as any).stateTreePatch;
    const patch = pickCommandPublicPatch(statePatchRaw);
    if (changeList.length === 0 && !patch) return null;
    const next: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    if (patch) {
      next.statePatch = patch;
    } else {
      delete next.statePatch;
      delete (next as any).状态补丁;
      delete (next as any).stateTreePatch;
    }
    return next;
  };
  const extractStateSettlementCommand = (text: string) => {
    const source = String(text || "").trim();
    if (!source) return null;
    const match = source.match(STATE_SETTLEMENT_COMMAND_PATTERN);
    if (!match) return null;
    const parsed = parseJsonMaybeFenced(String(match[1] || ""));
    if (!parsed) return { ok: false as const, error: "状态结算命令格式错误，示例：状态结算: {\"changes\":[...],\"statePatch\":{...}}" };
    const payload = pickStateSettlementPayload(parsed);
    if (!payload) return { ok: false as const, error: "状态结算命令无效：缺少 changes 或可写入公共 statePatch" };
    return { ok: true as const, payload };
  };
  const applyStateSettlementCommand = (args: {
    room: any;
    roomId: string;
    payload: Record<string, unknown>;
    reason?: string;
  }) => {
    deps.applyStateChanges(args.room, args.payload);
    const changes = Array.isArray((args.payload as any).changes) ? (args.payload as any).changes : [];
    const slots = Array.from(
      new Set(
        changes
          .map((item: any) => Number(item?.playerSlot ?? item?.slot ?? 0))
          .filter((num: number) => Number.isFinite(num) && num > 0)
          .map((num: number) => Math.floor(num))
      )
    ).sort((a, b) => a - b);
    const patch = pickCommandPublicPatch((args.payload as any).statePatch ?? (args.payload as any).状态补丁 ?? (args.payload as any).stateTreePatch);
    const labels: string[] = [];
    if (slots.length > 0) labels.push(`玩家${slots.join("、")}`);
    if (patch) labels.push(`公共状态:${Object.keys(patch).join("、")}`);
    const summary = String(args.reason || "").trim() || "状态结算命令";
    const newLog = {
      id: `${Date.now()}-settlement-command`,
      发送者: "系统",
      内容: `状态结算已执行（${summary}）：${labels.join("；") || "已应用"}`,
      类型: "系统",
      时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      回合: Number(args.room.currentRound) || 1
    };
    args.room.logs.push(newLog);
    deps.io.to(args.roomId).emit("new_log", newLog);
    deps.io.to(args.roomId).emit("room_updated", args.room);
  };

  const getVoteStatusByPlayer = (room: any) => {
    const vote = room?.rerollVote;
    const players = deps.getActivePlayers(room);
    return players.map((p: any) => ({
      playerId: p.id,
      playerName: p.name,
      status: vote?.approvals?.includes(p.id) ? "approved" : vote?.rejections?.includes(p.id) ? "rejected" : "pending"
    }));
  };

  const emitVoteUpdate = (roomId: string, room: any) => {
    deps.io.to(roomId).emit("reroll_vote_updated", {
      vote: room?.rerollVote || null,
      players: getVoteStatusByPlayer(room)
    });
    deps.io.to(roomId).emit("room_updated", room);
  };

  const ensureRerollState = (room: any) => {
    if (!Array.isArray(room.aiThinkingHistory)) room.aiThinkingHistory = [];
    if (typeof room.lastTurnSnapshot === "undefined") room.lastTurnSnapshot = null;
    if (typeof room.rerollVote === "undefined") room.rerollVote = null;
  };

  const emitSaveSlotsUpdate = (roomId: string, room: any) => {
    deps.io.to(roomId).emit("save_slots_updated", {
      saveSlots: room?.saveSlots || normalizeRoomSaveSlots(),
      loadVote: room?.loadVote || null
    });
  };

  const emitLoadVoteUpdate = (roomId: string, room: any) => {
    const vote = room?.loadVote;
    const players = deps.getActivePlayers(room).map((p: any) => ({
      playerId: p.id,
      playerName: p.name,
      status: vote?.approvals?.includes(p.id) ? "approved" : vote?.rejections?.includes(p.id) ? "rejected" : "pending"
    }));
    deps.io.to(roomId).emit("load_vote_updated", { vote: vote || null, players });
    emitSaveSlotsUpdate(roomId, room);
    deps.io.to(roomId).emit("room_updated", room);
  };

  const ensureSaveLoadState = (room: any) => {
    room.saveSlots = normalizeRoomSaveSlots(room?.saveSlots);
    if (typeof room.loadVote === "undefined") room.loadVote = null;
  };

  const executeReroll = async (roomId: string, room: any) => {
    ensureRerollState(room);
    const vote = room.rerollVote;
    const snapshot = room.lastTurnSnapshot;
    if (!vote || !snapshot) return;

    const useProviderStream = room.streamingMode === "provider";
    try {
      room.status = "story_generation";
      emitVoteUpdate(roomId, room);
      deps.io.emit("rooms_list_updated");

      if (useProviderStream) deps.io.to(roomId).emit("story_stream_start");
      const storyPayload = await deps.runMainStory(room, snapshot.groupedActions, {
        stream: useProviderStream,
        rerollPrompt: vote.prompt,
        onStreamChunk: (chunk) => {
          if (!useProviderStream || !chunk) return;
          deps.io.to(roomId).emit("story_stream_chunk", { chunk });
        }
      });
      if (useProviderStream) deps.io.to(roomId).emit("story_stream_end");

      const thinking = String(storyPayload?.thinking || "").trim();
      if (thinking) {
        room.aiThinkingHistory.push({
          round: Number(snapshot.round) || Number(room.currentRound) || 1,
          thinking,
          source: "reroll",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        if (room.aiThinkingHistory.length > 60) {
          room.aiThinkingHistory = room.aiThinkingHistory.slice(-60);
        }
      }

      const storyByPlayer = composeStoryByPlayer({
        room,
        groupedActions: snapshot.groupedActions,
        storyPayload
      });
      room.players.forEach((player: any) => {
        const story = (storyByPlayer[player.id] || "").trim() || "重Roll后仍无可见剧情。";
        deps.io.to(player.id).emit("player_story", {
          story: `【重Roll】\n${story}`,
          round: Number(snapshot.round) || Number(room.currentRound) || 1
        });
      });

      room.logs.push({
        id: `${Date.now()}-reroll`,
        发送者: "系统",
        内容: `重Roll完成：${String(storyPayload?.shortTerm || storyPayload?.globalSummary || "").trim() || "已重新生成剧情"}`,
        类型: "系统",
        时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        回合: Number(snapshot.round) || Number(room.currentRound) || 1
      });

      room.rerollVote = null;
      room.status = "waiting";
      emitVoteUpdate(roomId, room);
      deps.io.to(roomId).emit("reroll_completed", { roomId, round: snapshot.round });
      deps.io.emit("rooms_list_updated");
    } catch (error) {
      if (useProviderStream) deps.io.to(roomId).emit("story_stream_end");
      room.status = "waiting";
      room.rerollVote = null;
      emitVoteUpdate(roomId, room);
      deps.io.to(roomId).emit("error", `重Roll失败: ${String((error as Error)?.message || error)}`);
      deps.io.emit("rooms_list_updated");
    }
  };

  socket.on("set_room_streaming_mode", ({ roomId, mode }: { roomId: string; mode: "off" | "provider" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    room.streamingMode = mode === "provider" ? "provider" : "off";
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on(
    "apply_public_state_patch",
    (
      {
        roomId,
        patch,
        reason
      }: {
        roomId: string;
        patch: Record<string, unknown>;
        reason?: string;
      },
      callback?: (payload: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      const publicPatch = pickCommandPublicPatch(patch);
      if (!publicPatch) {
        callback?.({ ok: false, error: "补丁无效：缺少可写入的公共根路径" });
        return;
      }
      room.stateTree = deepMergeValue(isRecord(room.stateTree) ? room.stateTree : {}, publicPatch) as Record<string, unknown>;
      const summary = String(reason || "").trim() || "前端前缀命令写入";
      const newLog = {
        id: `${Date.now()}-pubpatch`,
        发送者: "系统",
        内容: `公共状态已更新（${summary}）：${Object.keys(publicPatch).join("、")}`,
        类型: "系统",
        时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        回合: Number(room.currentRound) || 1
      };
      room.logs.push(newLog);
      deps.io.to(roomId).emit("new_log", newLog);
      deps.io.to(roomId).emit("room_updated", room);
      callback?.({ ok: true });
    }
  );

  socket.on(
    "apply_state_settlement",
    (
      {
        roomId,
        payload,
        reason
      }: {
        roomId: string;
        payload: Record<string, unknown>;
        reason?: string;
      },
      callback?: (result: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      const commandPayload = pickStateSettlementPayload(payload);
      if (!commandPayload) {
        callback?.({ ok: false, error: "状态结算命令无效：缺少 changes 或可写入公共 statePatch" });
        return;
      }
      applyStateSettlementCommand({
        room,
        roomId,
        payload: commandPayload,
        reason: String(reason || "").trim() || "前端状态结算命令"
      });
      callback?.({ ok: true });
    }
  );

  socket.on("chat_message", ({ roomId, message }: { roomId: string; message: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;

    const newLog = {
      id: Date.now().toString(),
      发送者: player.name,
      内容: message,
      类型: "OOC",
      时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    room.logs.push(newLog);
    deps.io.to(roomId).emit("new_log", newLog);
  });

  socket.on("submit_action", ({ roomId, action }: { roomId: string; action: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    const settlementCommand = extractStateSettlementCommand(action);
    if (settlementCommand) {
      if (!settlementCommand.ok) {
        socket.emit("error", settlementCommand.error);
        return;
      }
      applyStateSettlementCommand({
        room,
        roomId,
        payload: settlementCommand.payload,
        reason: "前端状态结算命令"
      });
      return;
    }
    if (room.rerollVote) {
      socket.emit("error", "重Roll投票进行中，请先完成投票");
      return;
    }
    if (room.loadVote) {
      socket.emit("error", "读档投票进行中，请先完成投票");
      return;
    }
    if (player.isReady) return;

    player.action = action;
    player.isReady = true;
    const activePlayers = deps.getActivePlayers(room);
    const readyCount = activePlayers.filter((p: any) => p.isReady).length;
    deps.io.to(roomId).emit("turn_progress", { readyCount, total: activePlayers.length });
    deps.io.to(roomId).emit("room_updated", room);

    const allReady = activePlayers.length > 0 && activePlayers.every((p: any) => p.isReady);
    if (allReady) {
      room.status = "processing";
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");
      deps.processTurn(roomId);
    }
  });

  socket.on("update_room_memory_config", ({ roomId, config }: { roomId: string; config: any }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;

    room.memoryConfig = deps.normalizeRoomMemoryConfig({
      ...room.memoryConfig,
      ...config
    });
    room.memorySystem = deps.normalizeRoomMemorySystem(room.memorySystem);
    room.memoryPendingTask = deps.buildMemoryTask(room.memorySystem, room.memoryConfig);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on(
    "save_to_slot",
    (
      {
        roomId,
        slotType,
        slotIndex,
        note
      }: {
        roomId: string;
        slotType: "manual" | "auto";
        slotIndex: number;
        note?: string;
      },
      callback?: (payload: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      if (slotType !== "manual") {
        callback?.({ ok: false, error: "仅允许手动槽位保存" });
        return;
      }
      ensureSaveLoadState(room);
      writeRoomSaveSlot({
        room,
        slots: room.saveSlots,
        slotType,
        slotIndex,
        savedBy: String(player.name || ""),
        note: String(note || "").trim()
      });
      emitSaveSlotsUpdate(roomId, room);
      deps.io.to(roomId).emit("room_updated", room);
      callback?.({ ok: true });
    }
  );

  socket.on("request_save_slots", ({ roomId }: { roomId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    ensureSaveLoadState(room);
    emitSaveSlotsUpdate(roomId, room);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on(
    "request_load_vote",
    (
      {
        roomId,
        slotType,
        slotIndex
      }: {
        roomId: string;
        slotType: "manual" | "auto";
        slotIndex: number;
      },
      callback?: (payload: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      ensureSaveLoadState(room);
      if (room.rerollVote) {
        callback?.({ ok: false, error: "重Roll投票进行中，暂不能读档" });
        return;
      }
      if (room.loadVote) {
        callback?.({ ok: false, error: "已有读档投票进行中" });
        return;
      }
      const target = findRoomSaveSlot(room.saveSlots, slotType, slotIndex);
      if (!target?.snapshot) {
        callback?.({ ok: false, error: "该槽位没有可读档快照" });
        return;
      }
      room.loadVote = {
        id: `load-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        slotType,
        slotIndex,
        requesterId: socket.id,
        approvals: [socket.id],
        rejections: [],
        note: String(target.note || "").trim()
      };
      emitLoadVoteUpdate(roomId, room);
      const active = deps.getActivePlayers(room);
      callback?.({ ok: true });
      if (active.length <= 1) {
        applyRoomSnapshot(room, target.snapshot);
        room.loadVote = null;
        emitLoadVoteUpdate(roomId, room);
        deps.io.emit("rooms_list_updated");
      }
    }
  );

  socket.on(
    "respond_load_vote",
    (
      {
        roomId,
        approve
      }: {
        roomId: string;
        approve: boolean;
      },
      callback?: (payload: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      ensureSaveLoadState(room);
      const vote = room.loadVote;
      if (!vote) {
        callback?.({ ok: false, error: "当前没有进行中的读档投票" });
        return;
      }
      const hasVoted = vote.approvals.includes(socket.id) || vote.rejections.includes(socket.id);
      if (hasVoted) {
        callback?.({ ok: false, error: "你已经投过票" });
        return;
      }
      if (approve) vote.approvals.push(socket.id);
      else vote.rejections.push(socket.id);

      if (vote.rejections.length > 0) {
        room.loadVote = null;
        emitLoadVoteUpdate(roomId, room);
        callback?.({ ok: true });
        return;
      }

      const activePlayerIds = deps.getActivePlayers(room).map((p: any) => p.id);
      const allApproved = activePlayerIds.every((id: string) => vote.approvals.includes(id));
      if (!allApproved) {
        emitLoadVoteUpdate(roomId, room);
        callback?.({ ok: true });
        return;
      }

      const target = findRoomSaveSlot(room.saveSlots, vote.slotType, vote.slotIndex);
      if (!target?.snapshot) {
        room.loadVote = null;
        emitLoadVoteUpdate(roomId, room);
        callback?.({ ok: false, error: "目标存档不存在或已损坏" });
        return;
      }
      applyRoomSnapshot(room, target.snapshot);
      room.loadVote = null;
      emitLoadVoteUpdate(roomId, room);
      deps.io.to(roomId).emit("turn_progress", { readyCount: 0, total: deps.getActivePlayers(room).length });
      deps.io.emit("rooms_list_updated");
      callback?.({ ok: true });
    }
  );

  socket.on("cancel_load_vote", ({ roomId }: { roomId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    ensureSaveLoadState(room);
    const vote = room.loadVote;
    if (!vote) return;
    if (vote.requesterId !== socket.id && room.hostId !== socket.id) return;
    room.loadVote = null;
    emitLoadVoteUpdate(roomId, room);
  });

  socket.on(
    "request_reroll",
    (
      {
        roomId,
        prompt
      }: {
        roomId: string;
        prompt?: string;
      },
      callback?: (payload: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      ensureRerollState(room);
      if (!room.hasStarted) {
        callback?.({ ok: false, error: "游戏未开始，不能重Roll" });
        return;
      }
      if (room.status !== "waiting") {
        callback?.({ ok: false, error: "当前不在等待阶段，暂不能重Roll" });
        return;
      }
      if (!room.lastTurnSnapshot || !room.lastTurnSnapshot.groupedActions) {
        callback?.({ ok: false, error: "暂无可重Roll的回合快照" });
        return;
      }
      if (room.rerollVote) {
        callback?.({ ok: false, error: "已有重Roll投票进行中" });
        return;
      }
      ensureSaveLoadState(room);
      if (room.loadVote) {
        callback?.({ ok: false, error: "已有读档投票进行中" });
        return;
      }
      const voteId = `reroll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      room.rerollVote = {
        id: voteId,
        round: Number(room.lastTurnSnapshot.round) || Number(room.currentRound) || 1,
        prompt: String(prompt || "").trim(),
        requesterId: socket.id,
        approvals: [socket.id],
        rejections: []
      };
      emitVoteUpdate(roomId, room);
      const active = deps.getActivePlayers(room);
      callback?.({ ok: true });
      if (active.length <= 1) {
        void executeReroll(roomId, room);
      }
    }
  );

  socket.on(
    "respond_reroll_vote",
    (
      {
        roomId,
        approve
      }: {
        roomId: string;
        approve: boolean;
      },
      callback?: (payload: { ok: boolean; error?: string }) => void
    ) => {
      const room = deps.rooms[roomId];
      if (!room) {
        callback?.({ ok: false, error: "房间不存在" });
        return;
      }
      const player = room.players.find((p: any) => p.id === socket.id);
      if (!player) {
        callback?.({ ok: false, error: "玩家不存在" });
        return;
      }
      ensureRerollState(room);
      const vote = room.rerollVote;
      if (!vote) {
        callback?.({ ok: false, error: "当前没有进行中的重Roll投票" });
        return;
      }
      const hasVoted = vote.approvals.includes(socket.id) || vote.rejections.includes(socket.id);
      if (hasVoted) {
        callback?.({ ok: false, error: "你已经投过票" });
        return;
      }
      if (approve) {
        vote.approvals.push(socket.id);
      } else {
        vote.rejections.push(socket.id);
      }

      if (vote.rejections.length > 0) {
        room.rerollVote = null;
        emitVoteUpdate(roomId, room);
        callback?.({ ok: true });
        return;
      }

      const activePlayerIds = deps.getActivePlayers(room).map((p: any) => p.id);
      const allApproved = activePlayerIds.every((id: string) => vote.approvals.includes(id));
      emitVoteUpdate(roomId, room);
      callback?.({ ok: true });
      if (allApproved) {
        void executeReroll(roomId, room);
      }
    }
  );

  socket.on("cancel_reroll_vote", ({ roomId }: { roomId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    ensureRerollState(room);
    const vote = room.rerollVote;
    if (!vote) return;
    if (vote.requesterId !== socket.id && room.hostId !== socket.id) return;
    room.rerollVote = null;
    emitVoteUpdate(roomId, room);
  });

  socket.on("memory_summary_generate", async (
    {
      roomId,
      taskId,
      temperature
    }: {
      roomId: string;
      taskId?: string;
      temperature?: number;
    },
    callback?: (payload: { ok: boolean; summary?: string; error?: string }) => void
  ) => {
    const room = deps.rooms[roomId];
    if (!room) {
      callback?.({ ok: false, error: "房间不存在" });
      return;
    }
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) {
      callback?.({ ok: false, error: "玩家不存在" });
      return;
    }
    room.memoryConfig = deps.normalizeRoomMemoryConfig(room.memoryConfig);
    room.memorySystem = deps.normalizeRoomMemorySystem(room.memorySystem);
    if (!room.memoryPendingTask) {
      room.memoryPendingTask = deps.buildMemoryTask(room.memorySystem, room.memoryConfig);
    }
    const task = room.memoryPendingTask;
    if (!task) {
      callback?.({ ok: false, error: "当前没有待处理记忆总结任务" });
      return;
    }
    if (taskId && task.id !== taskId) {
      callback?.({ ok: false, error: "任务已变更，请刷新后重试" });
      return;
    }

    try {
      room.memoryConfig = deps.normalizeRoomMemoryConfig(room.memoryConfig);
      const userPrompt = buildMemorySummaryUserPrompt(task, room.memoryConfig);
      const systemPrompt = [
        "你是TRPG记忆压缩助手。",
        "只返回总结正文，不要JSON，不要额外解释，不要标题。"
      ].join("\n");
      const raw = await deps.runMemorySummary({
        room,
        requesterId: socket.id,
        systemPrompt,
        userPrompt,
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.2
      });
      callback?.({ ok: true, summary: cleanupSummaryOutput(raw) });
    } catch (error) {
      callback?.({ ok: false, error: String((error as Error)?.message || error || "记忆总结失败") });
    }
  });

  socket.on("memory_summary_apply", (
    {
      roomId,
      taskId,
      summary
    }: {
      roomId: string;
      taskId: string;
      summary: string;
    },
    callback?: (payload: { ok: boolean; error?: string }) => void
  ) => {
    const room = deps.rooms[roomId];
    if (!room) {
      callback?.({ ok: false, error: "房间不存在" });
      return;
    }
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) {
      callback?.({ ok: false, error: "玩家不存在" });
      return;
    }
    const task = room.memoryPendingTask;
    if (!task) {
      callback?.({ ok: false, error: "当前没有待处理任务" });
      return;
    }
    if (task.id !== String(taskId || "").trim()) {
      callback?.({ ok: false, error: "任务已变更，请刷新后重试" });
      return;
    }
    if (!String(summary || "").trim()) {
      callback?.({ ok: false, error: "总结内容为空，无法写入" });
      return;
    }

    room.memorySystem = applyMemorySummary({
      memory: deps.normalizeRoomMemorySystem(room.memorySystem),
      task,
      summaryText: String(summary || "").trim()
    });
    room.memoryConfig = deps.normalizeRoomMemoryConfig(room.memoryConfig);
    room.memoryPendingTask = deps.buildMemoryTask(room.memorySystem, room.memoryConfig);
    deps.io.to(roomId).emit("room_updated", room);
    callback?.({ ok: true });
  });

  socket.on("memory_summary_dismiss", ({ roomId, taskId }: { roomId: string; taskId?: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (!room.memoryPendingTask) return;
    if (taskId && room.memoryPendingTask.id !== taskId) return;
    room.memoryPendingTask = null;
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    deps.removePlayerFromRoom(socket.id);
  });
};
