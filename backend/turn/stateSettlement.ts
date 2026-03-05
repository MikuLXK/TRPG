interface RoomPlayerLike {
  id: string;
  location: string;
  currentHP: number;
  currentMP: number;
  statusEffects: string[];
  characterProfile?: {
    calculatedAttributes?: unknown;
  };
}

interface RoomLike {
  players: RoomPlayerLike[];
}

export const applyStateChanges = (
  room: RoomLike,
  changesInput: unknown,
  deps: {
    getMaxHPByAttributes: (attrs: unknown) => number;
    getMaxMPByAttributes: (attrs: unknown) => number;
    createEmptyAttributes: () => unknown;
    syncPlayerCombatStats: (player: RoomPlayerLike) => void;
  }
) => {
  const changes = Array.isArray((changesInput as any)?.changes) ? (changesInput as any).changes : [];
  for (const change of changes) {
    const playerId = typeof change?.playerId === "string" ? change.playerId : "";
    const rawPlayerSlot = Number(change?.playerSlot ?? change?.slot ?? 0);
    const playerSlot = Number.isFinite(rawPlayerSlot) && rawPlayerSlot > 0 ? Math.floor(rawPlayerSlot) : 0;
    const playerBySlot = playerSlot > 0
      ? room.players.find((p: any) => Number((p as any).playerSlot) === playerSlot)
      : undefined;
    const playerById = playerId
      ? room.players.find((p) => p.id === playerId)
      : undefined;
    // Prefer stable seat binding (playerSlot) over reconnect-volatile socket ids.
    const player = playerBySlot || playerById;
    if (!player) continue;
    const fields = (change?.fields && typeof change.fields === "object") ? change.fields as Record<string, unknown> : {};

    if (typeof fields.位置 === "string" && fields.位置.trim()) {
      player.location = fields.位置.trim();
    }

    const hpDelta = Number(fields.生命值 ?? fields.hpDelta ?? 0);
    if (Number.isFinite(hpDelta) && hpDelta !== 0) {
      const maxHP = deps.getMaxHPByAttributes(player.characterProfile?.calculatedAttributes || deps.createEmptyAttributes());
      player.currentHP = Math.max(0, Math.min(maxHP, Math.floor(player.currentHP + hpDelta)));
    }

    const mpDelta = Number(fields.法力值 ?? fields.mpDelta ?? 0);
    if (Number.isFinite(mpDelta) && mpDelta !== 0) {
      const maxMP = deps.getMaxMPByAttributes(player.characterProfile?.calculatedAttributes || deps.createEmptyAttributes());
      player.currentMP = Math.max(0, Math.min(maxMP, Math.floor(player.currentMP + mpDelta)));
    }

    const nextHP = Number(fields.当前生命值);
    if (Number.isFinite(nextHP)) {
      const maxHP = deps.getMaxHPByAttributes(player.characterProfile?.calculatedAttributes || deps.createEmptyAttributes());
      player.currentHP = Math.max(0, Math.min(maxHP, Math.floor(nextHP)));
    }

    const nextMP = Number(fields.当前法力值);
    if (Number.isFinite(nextMP)) {
      const maxMP = deps.getMaxMPByAttributes(player.characterProfile?.calculatedAttributes || deps.createEmptyAttributes());
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

    deps.syncPlayerCombatStats(player);
  }
};
