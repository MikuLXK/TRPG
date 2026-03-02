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
  globalSummary?: string;
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
      room.status = "settlement";
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");

      const storyByPlayer: Record<string, string> = {};
      const globalSummary = typeof storyPayload.globalSummary === "string" ? storyPayload.globalSummary.trim() : "";
      for (const player of room.players) {
        storyByPlayer[player.id] = globalSummary ? `${globalSummary}\n\n` : "";
      }

      const groupPlayerMap = new Map<string, string[]>();
      for (const g of groupedActions.groups || []) {
        if (!g?.groupId) continue;
        groupPlayerMap.set(g.groupId, Array.isArray(g.playerIds) ? g.playerIds : []);
      }

      const nameToId = new Map<string, string>();
      for (const a of groupedActions.rawActions || []) {
        const name = String(a?.playerName || "").trim();
        const id = String(a?.playerId || "").trim();
        if (name && id) nameToId.set(name, id);
      }
      for (const p of room.players) {
        if (p.name && p.id) nameToId.set(p.name, p.id);
      }

      for (const seg of storyPayload.segments || []) {
        const title = (seg.title || "").trim();
        const content = (seg.content || "").trim();
        const block = [title, content].filter(Boolean).join("\n").trim();
        if (!block) continue;

        const directIds = Array.isArray(seg.visibleToPlayerIds) ? seg.visibleToPlayerIds : [];
        let resolvedIds = directIds.filter((id) => room.players.some((p: any) => p.id === id));
        if (resolvedIds.length === 0 && seg.groupId && groupPlayerMap.has(seg.groupId)) {
          resolvedIds = (groupPlayerMap.get(seg.groupId) || []).filter((id) => room.players.some((p: any) => p.id === id));
        }
        if (resolvedIds.length === 0 && title) {
          const titleNames = Array.from(title.matchAll(/【([^\]]+)】/g)).map((m) => String(m[1] || "").trim()).filter(Boolean);
          resolvedIds = titleNames.map((n) => nameToId.get(n) || "").filter((id) => Boolean(id) && room.players.some((p: any) => p.id === id));
        }
        if (resolvedIds.length === 0) resolvedIds = room.players.map((p: any) => p.id);

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
