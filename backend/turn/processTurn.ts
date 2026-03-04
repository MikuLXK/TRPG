import {
  buildMemoryTask,
  buildRoundMemoryEntries,
  normalizeRoomMemoryConfig,
  normalizeRoomMemorySystem,
  writeRoomMemory
} from "./memory";
import { composeStoryByPlayer } from "./storyDispatch";

interface StorySegmentLike {
  groupId: string;
  visibleToPlayerIds: string[];
  title: string;
  content: string;
}

interface StoryHintLike {
  playerId: string;
  hint: string;
}

interface StoryPayloadLike {
  thinking?: string;
  globalSummary?: string;
  shortTerm?: string;
  publicLines?: Array<{ speaker?: string; text?: string }>;
  segments?: StorySegmentLike[];
  nextHints?: StoryHintLike[];
}

interface GroupLike {
  groupId: string;
  playerIds: string[];
}

interface RawActionLike {
  playerId: string;
  playerName: string;
}

interface GroupedActionsLike {
  groups: GroupLike[];
  rawActions: RawActionLike[];
}

export const createTurnProcessor = (deps: {
  rooms: Record<string, any>;
  io: any;
  getActivePlayers: (room: any) => Array<{ id: string; name: string; isReady: boolean; action: string }>;
  runActionCollector: (room: any) => Promise<GroupedActionsLike>;
  runMainStory: (
    room: any,
    groupedActions: GroupedActionsLike,
    options?: { stream?: boolean; onStreamChunk?: (chunk: string) => void }
  ) => Promise<StoryPayloadLike>;
  runStateProcessor: (room: any, storyPayload: StoryPayloadLike, groupedActions: GroupedActionsLike) => Promise<unknown>;
  applyStateChanges: (room: any, changesInput: unknown) => void;
}) => {
  return async (roomId: string) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const streamMode = room.streamingMode === "provider" ? "provider" : "off";
    const useProviderStream = streamMode === "provider";

    try {
      if (useProviderStream) {
        deps.io.to(roomId).emit("story_stream_start");
      }
      const groupedActions = await deps.runActionCollector(room);
      room.rerollVote = null;
      room.lastTurnSnapshot = {
        round: Number(room.currentRound) || 1,
        groupedActions: JSON.parse(JSON.stringify(groupedActions))
      };
      room.status = "story_generation";
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");

      const storyPayload = await deps.runMainStory(room, groupedActions, {
        stream: useProviderStream,
        onStreamChunk: (chunk) => {
          if (!useProviderStream || !chunk) return;
          deps.io.to(roomId).emit("story_stream_chunk", { chunk });
        }
      });
      if (useProviderStream) {
        deps.io.to(roomId).emit("story_stream_end");
      }
      const memoryConfig = normalizeRoomMemoryConfig(room.memoryConfig);
      const memoryBase = normalizeRoomMemorySystem(room.memorySystem);
      const { immediateEntry, shortEntry, round, timeText } = buildRoundMemoryEntries({
        room,
        storyPayload
      });
      room.memorySystem = writeRoomMemory({
        memory: memoryBase,
        config: memoryConfig,
        immediateEntry,
        shortEntry,
        round,
        recordTime: timeText
      });
      room.memoryConfig = memoryConfig;
      room.memoryPendingTask = buildMemoryTask(room.memorySystem, memoryConfig);
      if (!Array.isArray(room.aiThinkingHistory)) room.aiThinkingHistory = [];
      const thinking = String(storyPayload?.thinking || "").trim();
      if (thinking) {
        room.aiThinkingHistory.push({
          round: Number(room.currentRound) || 1,
          thinking,
          source: "mainStory",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
        if (room.aiThinkingHistory.length > 60) {
          room.aiThinkingHistory = room.aiThinkingHistory.slice(-60);
        }
      }
      room.status = "settlement";
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");

      const globalSummary = typeof storyPayload.globalSummary === "string" ? storyPayload.globalSummary.trim() : "";
      const storyByPlayer = composeStoryByPlayer({
        room,
        groupedActions,
        storyPayload
      });

      room.players.forEach((player: any) => {
        const personalStory = (storyByPlayer[player.id] || "").trim() || "本回合没有你的可见剧情。";
        deps.io.to(player.id).emit("player_story", { story: personalStory, round: room.currentRound });
      });

      const changes = await deps.runStateProcessor(room, storyPayload, groupedActions);
      deps.applyStateChanges(room, changes);
      room.logs.push({
        id: `${Date.now()}-state`,
        发送者: "系统",
        内容: `状态结算: ${JSON.stringify(changes)}`,
        类型: "系统",
        时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });

      room.currentRound += 1;
      room.status = "waiting";
      room.players.forEach((p: any) => {
        p.isReady = false;
        p.action = "";
      });

      deps.io.to(roomId).emit("turn_progress", { readyCount: 0, total: deps.getActivePlayers(room).length });
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.to(roomId).emit("round_complete", { room, story: globalSummary || "回合处理完成。" });
      deps.io.emit("rooms_list_updated");
    } catch (error) {
      console.error("Error processing turn:", error);
      if (useProviderStream) {
        deps.io.to(roomId).emit("story_stream_end");
      }
      deps.io.to(roomId).emit("error", `AI 处理回合失败: ${String((error as Error)?.message ?? error)}`);
      room.status = "waiting";
      room.players.forEach((p: any) => {
        p.isReady = false;
      });
      deps.io.to(roomId).emit("turn_progress", { readyCount: 0, total: deps.getActivePlayers(room).length });
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");
    }
  };
};
