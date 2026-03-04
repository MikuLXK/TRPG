import { applyMemorySummary, buildMemorySummaryUserPrompt, cleanupSummaryOutput } from "../turn/memory";

export const registerTurnEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  getActivePlayers: (room: any) => Array<any>;
  processTurn: (roomId: string) => void;
  removePlayerFromRoom: (socketId: string) => void;
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
  socket.on("set_room_streaming_mode", ({ roomId, mode }: { roomId: string; mode: "off" | "provider" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    room.streamingMode = mode === "provider" ? "provider" : "off";
    deps.io.to(roomId).emit("room_updated", room);
  });

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
