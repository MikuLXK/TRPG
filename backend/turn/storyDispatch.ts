interface StorySegmentLike {
  groupId?: string;
  visibleToPlayerIds?: string[];
  title?: string;
  content?: string;
  lines?: Array<{ speaker?: string; text?: string }>;
}

interface StoryPayloadLike {
  globalSummary?: string;
  shortTerm?: string;
  publicLines?: Array<{ speaker?: string; text?: string }>;
  segments?: StorySegmentLike[];
  nextHints?: Array<{ playerId?: string; hint?: string }>;
}

interface GroupLike {
  groupId?: string;
  playerIds?: string[];
}

interface GroupedActionsLike {
  groups?: GroupLike[];
  rawActions?: Array<{ playerId?: string; playerName?: string }>;
}

const segmentToTextBlock = (segment: StorySegmentLike) => {
  const title = String(segment?.title || "").trim();
  const content = String(segment?.content || "").trim();
  const lines = Array.isArray(segment?.lines)
    ? segment.lines
        .map((line) => {
          const speaker = String(line?.speaker || "").trim();
          const text = String(line?.text || "").trim();
          if (!speaker || !text) return "";
          return `【${speaker}】${text}`;
        })
        .filter(Boolean)
    : [];
  const body = [content, lines.join("\n")].filter(Boolean).join("\n").trim();
  return [title, body].filter(Boolean).join("\n").trim();
};

export const composeStoryByPlayer = (args: {
  room: any;
  groupedActions: GroupedActionsLike;
  storyPayload: StoryPayloadLike;
}) => {
  const storyByPlayer: Record<string, string> = {};
  const globalSummary = String(args.storyPayload.globalSummary || "").trim();
  const publicLines = Array.isArray(args.storyPayload.publicLines)
    ? args.storyPayload.publicLines
        .map((line) => {
          const speaker = String(line?.speaker || "").trim();
          const text = String(line?.text || "").trim();
          if (!speaker || !text) return "";
          return `【${speaker}】${text}`;
        })
        .filter(Boolean)
    : [];
  const publicBlock = [globalSummary, publicLines.join("\n")].filter(Boolean).join("\n").trim();

  for (const player of args.room.players || []) {
    storyByPlayer[player.id] = publicBlock ? `${publicBlock}\n\n` : "";
  }

  const groupPlayerMap = new Map<string, string[]>();
  for (const group of args.groupedActions.groups || []) {
    if (!group?.groupId) continue;
    groupPlayerMap.set(group.groupId, Array.isArray(group.playerIds) ? group.playerIds : []);
  }

  const nameToId = new Map<string, string>();
  for (const action of args.groupedActions.rawActions || []) {
    const name = String(action?.playerName || "").trim();
    const id = String(action?.playerId || "").trim();
    if (name && id) nameToId.set(name, id);
  }
  for (const player of args.room.players || []) {
    if (player?.name && player?.id) nameToId.set(String(player.name), String(player.id));
  }

  for (const segment of args.storyPayload.segments || []) {
    const block = segmentToTextBlock(segment);
    if (!block) continue;
    const directIds = Array.isArray(segment.visibleToPlayerIds) ? segment.visibleToPlayerIds : [];
    let resolvedIds = directIds.filter((id) => args.room.players.some((p: any) => p.id === id));
    if (resolvedIds.length === 0) {
      const gid = String(segment.groupId || "").trim();
      if (gid && groupPlayerMap.has(gid)) {
        resolvedIds = (groupPlayerMap.get(gid) || []).filter((id) => args.room.players.some((p: any) => p.id === id));
      }
    }
    if (resolvedIds.length === 0) {
      const title = String(segment.title || "").trim();
      const names = Array.from(title.matchAll(/【([^\]]+)】/g))
        .map((m) => String(m[1] || "").trim())
        .filter(Boolean);
      resolvedIds = names
        .map((name) => nameToId.get(name) || "")
        .filter((id) => Boolean(id) && args.room.players.some((p: any) => p.id === id));
    }
    if (resolvedIds.length === 0) {
      resolvedIds = (args.room.players || []).map((player: any) => player.id);
    }

    for (const playerId of resolvedIds) {
      if (!storyByPlayer[playerId]) storyByPlayer[playerId] = "";
      storyByPlayer[playerId] += `${block}\n\n`;
    }
  }

  if (Array.isArray(args.storyPayload.nextHints)) {
    for (const item of args.storyPayload.nextHints) {
      if (!item || typeof item.playerId !== "string") continue;
      const hint = String(item.hint || "").trim();
      if (!hint) continue;
      if (!storyByPlayer[item.playerId]) storyByPlayer[item.playerId] = "";
      storyByPlayer[item.playerId] += `【下一步可选行动提示】${hint}\n`;
    }
  }

  return storyByPlayer;
};

