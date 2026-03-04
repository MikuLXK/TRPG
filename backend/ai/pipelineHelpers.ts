import type {
  ActionCollectorPayload,
  ActionCollectorRawAction,
  ActionCollectorGroup,
  MainStoryPayload,
  MainStorySegment,
  RoomLike
} from "./types";
import { toSingleLine, trimTextForContext } from "./prompting";

const toUniqueIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

const joinNamesByAnd = (names: string[]) => {
  if (names.length <= 2) return names.join("与");
  return `${names.slice(0, -1).join("、")}与${names[names.length - 1]}`;
};

const buildGroupTitleByPlayerIds = (room: RoomLike, playerIds: string[]) => {
  const names = playerIds
    .map((id) => room.players.find((player) => player.id === id)?.name || "")
    .filter(Boolean);
  if (names.length === 0) return "【未知玩家】";
  return names.map((name) => `【${name}】`).join("|");
};

export const getActivePlayers = (room: RoomLike) => room.players.filter((p) => p.isOnline !== false);

export const buildActionCollectorInput = (room: RoomLike) => {
  const activePlayers = getActivePlayers(room);
  const actions: ActionCollectorRawAction[] = activePlayers.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerSlot: Number.isFinite(Number((player as any).playerSlot)) ? Math.max(1, Math.floor(Number((player as any).playerSlot))) : undefined,
    location: player.location,
    action: String(player.action || "").trim()
  }));

  const locationBuckets = actions.reduce<Record<string, string[]>>((acc, item) => {
    const location = item.location || "未知地点";
    if (!acc[location]) acc[location] = [];
    acc[location].push(item.playerId);
    return acc;
  }, {});

  return {
    phase: "collect_actions",
    round: room.currentRound,
    room: {
      id: room.id,
      name: room.name,
      scriptTitle: room.script?.title || "",
      intro: trimTextForContext(room.intro || "", 600)
    },
    players: actions,
    locationBuckets
  };
};

export const normalizeActionCollectorPayload = (
  room: RoomLike,
  parsed: { groups?: unknown[]; rawActions?: unknown[] } | null,
  fallbackActions: ActionCollectorRawAction[]
): ActionCollectorPayload => {
  const activePlayers = getActivePlayers(room);
  const activeIdSet = new Set(activePlayers.map((player) => player.id));
  const rawActionMap = new Map<string, ActionCollectorRawAction>();
  for (const action of fallbackActions) {
    if (!activeIdSet.has(action.playerId)) continue;
    rawActionMap.set(action.playerId, { ...action });
  }

  if (Array.isArray(parsed?.rawActions)) {
    for (const item of parsed.rawActions) {
      const playerId = String((item as any)?.playerId || "").trim();
      if (!playerId || !rawActionMap.has(playerId)) continue;
      const base = rawActionMap.get(playerId)!;
      rawActionMap.set(playerId, {
        playerId,
        playerName: toSingleLine((item as any)?.playerName ?? base.playerName, base.playerName),
        playerSlot: Number.isFinite(Number((item as any)?.playerSlot))
          ? Math.max(1, Math.floor(Number((item as any).playerSlot)))
          : base.playerSlot,
        location: toSingleLine((item as any)?.location ?? base.location, base.location),
        action: String((item as any)?.action ?? base.action).trim()
      });
    }
  }

  const rawActions = activePlayers
    .map((player) => rawActionMap.get(player.id))
    .filter((item): item is ActionCollectorRawAction => Boolean(item));
  const assigned = new Set<string>();
  const groups: ActionCollectorGroup[] = [];
  let groupIndex = 1;

  const pushGroup = (options: { groupType: "together" | "solo"; playerIds: string[]; location?: string; reason?: string }) => {
    const uniqueIds = options.playerIds.filter((id) => activeIdSet.has(id) && !assigned.has(id));
    if (uniqueIds.length === 0) return;
    const normalizedType = options.groupType === "together" && uniqueIds.length > 1 ? "together" : "solo";
    const firstPlayer = room.players.find((player) => player.id === uniqueIds[0]);
    const location = toSingleLine(options.location || firstPlayer?.location || "未知地点", "未知地点");
    const reason = String(options.reason || "").trim() || (normalizedType === "together" ? "同地协同行动" : "单独行动");
    const groupId = `g${groupIndex++}`;
    groups.push({ groupId, groupType: normalizedType, location, playerIds: uniqueIds, reason });
    uniqueIds.forEach((id) => assigned.add(id));
  };

  if (Array.isArray(parsed?.groups)) {
    for (const item of parsed.groups) {
      const ids = toUniqueIds((item as any)?.playerIds).filter((id) => activeIdSet.has(id) && !assigned.has(id));
      if (ids.length === 0) continue;
      const location = String((item as any)?.location || "").trim();
      const reason = String((item as any)?.reason || "").trim();
      const requestedType = (item as any)?.groupType === "together" ? "together" : "solo";
      if (requestedType === "together" && ids.length > 1) pushGroup({ groupType: "together", playerIds: ids, location, reason });
      else ids.forEach((id) => pushGroup({ groupType: "solo", playerIds: [id], location, reason }));
    }
  }

  for (const player of activePlayers) {
    if (assigned.has(player.id)) continue;
    pushGroup({ groupType: "solo", playerIds: [player.id], location: player.location, reason: "兜底单人分组" });
  }

  const rawActionById = new Map(rawActions.map((item) => [item.playerId, item]));
  const groupNarratives = groups.map((group) => {
    const names = group.playerIds
      .map((id) => rawActionById.get(id)?.playerName || room.players.find((player) => player.id === id)?.name || "未知玩家")
      .filter(Boolean);
    const heading = group.groupType === "together" ? `${joinNamesByAnd(names)}在一起行动（${group.location}）` : `${names[0] || "未知玩家"}单独行动（${group.location}）`;
    const lines = group.playerIds.map((id) => {
      const action = rawActionById.get(id);
      const name = action?.playerName || room.players.find((player) => player.id === id)?.name || "未知玩家";
      const content = action?.action || "（空输入）";
      return `${name}输入：${content}`;
    });
    return [heading, ...lines].join("\n");
  });
  return { groups, rawActions, groupNarratives };
};

export const buildMainStoryInput = (room: RoomLike, groupedActions: ActionCollectorPayload) => {
  const activePlayers = getActivePlayers(room);
  const players = activePlayers.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerSlot: Number.isFinite(Number((player as any).playerSlot)) ? Math.max(1, Math.floor(Number((player as any).playerSlot))) : undefined,
    location: player.location,
    currentHP: player.currentHP,
    currentMP: player.currentMP,
    statusEffects: Array.isArray(player.statusEffects) ? player.statusEffects : []
  }));
  const recentLogs = room.logs
    .slice(-8)
    .map((log) => ({
      sender: String(log?.["发送者"] || ""),
      type: String(log?.["类型"] || ""),
      content: trimTextForContext(log?.["内容"] || "", 240),
      time: String(log?.["时间戳"] || "")
    }))
    .filter((item) => item.content);
  const memory = room.memorySystem || {};
  const memoryContext = {
    长期记忆: Array.isArray((memory as any).长期记忆) ? (memory as any).长期记忆.slice(-8) : [],
    中期记忆: Array.isArray((memory as any).中期记忆) ? (memory as any).中期记忆.slice(-10) : [],
    短期记忆: Array.isArray((memory as any).短期记忆) ? (memory as any).短期记忆.slice(-12) : [],
    即时记忆: Array.isArray((memory as any).即时记忆) ? (memory as any).即时记忆.slice(-8) : []
  };
  return {
    phase: "main_story",
    round: room.currentRound,
    room: {
      id: room.id,
      name: room.name,
      scriptTitle: room.script?.title || "",
      scriptDescription: trimTextForContext(room.script?.description || "", 600),
      finalGoal: trimTextForContext(room.script?.finalGoal || "", 500),
      intro: trimTextForContext(room.intro || "", 600)
    },
    groupedActions,
    players,
    recentLogs,
    memoryContext
  };
};

export const buildStateProcessorInput = (room: RoomLike, storyPayload: MainStoryPayload, groupedActions: ActionCollectorPayload) => {
  const currentState = room.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    playerSlot: Number.isFinite(Number((player as any).playerSlot)) ? Math.max(1, Math.floor(Number((player as any).playerSlot))) : undefined,
    location: player.location,
    currentHP: player.currentHP,
    currentMP: player.currentMP,
    statusEffects: Array.isArray(player.statusEffects) ? player.statusEffects : []
  }));
  return {
    phase: "state_processor",
    round: room.currentRound,
    groupedActions,
    story: {
      globalSummary: String(storyPayload.globalSummary || "").trim(),
      segments: Array.isArray(storyPayload.segments)
        ? storyPayload.segments.map((segment) => ({ groupId: segment.groupId, visibleToPlayerIds: segment.visibleToPlayerIds, title: segment.title, content: segment.content }))
        : []
    },
    currentState
  };
};

export const normalizeMainStoryPayload = (room: RoomLike, groupedActions: ActionCollectorPayload, parsed: MainStoryPayload | null): MainStoryPayload => {
  const expectedGroups = groupedActions.groups;
  const expectedMap = new Map(expectedGroups.map((group) => [group.groupId, group]));
  const groupNarrativeMap = new Map(expectedGroups.map((group, index) => [group.groupId, groupedActions.groupNarratives[index] || ""]));
  const filledSegments: MainStorySegment[] = [];
  const consumedGroupIds = new Set<string>();
  const rawSegments = Array.isArray(parsed?.segments) ? parsed!.segments! : [];
  const findGroupIdByVisibleList = (visibleToPlayerIds: string[]) => expectedGroups.find((group) => group.playerIds.length === visibleToPlayerIds.length && group.playerIds.every((id) => visibleToPlayerIds.includes(id)))?.groupId;
  for (const item of rawSegments) {
    const fallbackVisible = toUniqueIds(item?.visibleToPlayerIds);
    const resolvedGroupId = String(item?.groupId || "").trim() || findGroupIdByVisibleList(fallbackVisible) || "";
    if (!resolvedGroupId || !expectedMap.has(resolvedGroupId) || consumedGroupIds.has(resolvedGroupId)) continue;
    const expected = expectedMap.get(resolvedGroupId)!;
    const title = String(item?.title || "").trim() || buildGroupTitleByPlayerIds(room, expected.playerIds);
    const content = String(item?.content || "").trim() || "该组行动已发生，但本回合未产生可公开的新叙事结果。";
    filledSegments.push({ groupId: resolvedGroupId, visibleToPlayerIds: expected.playerIds, title, content });
    consumedGroupIds.add(resolvedGroupId);
  }
  for (const group of expectedGroups) {
    if (consumedGroupIds.has(group.groupId)) continue;
    filledSegments.push({
      groupId: group.groupId,
      visibleToPlayerIds: group.playerIds,
      title: buildGroupTitleByPlayerIds(room, group.playerIds),
      content: groupNarrativeMap.get(group.groupId) || "该组行动已记录，等待下一轮推进。"
    });
  }
  const nextHints = Array.isArray(parsed?.nextHints)
    ? parsed.nextHints
        .map((item) => ({ playerId: String(item?.playerId || "").trim(), hint: String(item?.hint || "").trim() }))
        .filter((item) => item.playerId && item.hint && room.players.some((player) => player.id === item.playerId))
    : [];
  return { globalSummary: String(parsed?.globalSummary || "").trim(), segments: filledSegments, nextHints };
};

export const normalizeStateProcessorPayload = (room: RoomLike, parsed: { changes?: unknown[] } | null) => {
  const changes = Array.isArray(parsed?.changes)
    ? parsed.changes
        .map((item) => {
          const playerId = String((item as any)?.playerId || "").trim();
          const rawPlayerSlot = Number((item as any)?.playerSlot ?? (item as any)?.slot ?? 0);
          const playerSlot = Number.isFinite(rawPlayerSlot) && rawPlayerSlot > 0 ? Math.floor(rawPlayerSlot) : undefined;
          const fields = (item as any)?.fields && typeof (item as any).fields === "object" ? (item as any).fields as Record<string, unknown> : {};
          const reason = String((item as any)?.reason || "").trim();
          return { playerId, playerSlot, fields, reason };
        })
        .filter((item) => {
          if (item.playerId && room.players.some((player) => player.id === item.playerId)) return true;
          if (item.playerSlot && room.players.some((player: any) => Number(player.playerSlot) === item.playerSlot)) return true;
          return false;
        })
    : [];
  return { changes };
};
