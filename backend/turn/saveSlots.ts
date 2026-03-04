export type RoomSaveSlotType = "manual" | "auto";

export interface RoomSnapshotPlayerState {
  playerSlot: number;
  location: string;
  currentHP: number;
  currentMP: number;
  statusEffects: string[];
  selectedSavedCharacterId: string | null;
  canCreateCustomCharacter: boolean;
  selectedRoleTemplateId: string | null;
  characterProfile: unknown;
}

export interface RoomSaveSnapshot {
  version: 1;
  createdAt: number;
  round: number;
  stateTree: Record<string, unknown>;
  logs: unknown[];
  memoryConfig: unknown;
  memorySystem: unknown;
  memoryPendingTask: unknown;
  aiThinkingHistory: unknown[];
  lastTurnSnapshot: unknown;
  playersBySlot: RoomSnapshotPlayerState[];
}

export interface RoomSaveSlot {
  slotId: string;
  slotType: RoomSaveSlotType;
  slotIndex: number;
  label: string;
  updatedAt: number | null;
  round: number | null;
  savedBy: string;
  note: string;
  snapshot: RoomSaveSnapshot | null;
}

export interface RoomSaveSlots {
  manual: RoomSaveSlot[];
  auto: RoomSaveSlot[];
  autoCursor: number;
}

const SLOT_COUNT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const deepClone = <T>(value: T): T => {
  if (typeof value === "undefined") return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const toSlotLabel = (slotType: RoomSaveSlotType, slotIndex: number) =>
  slotType === "manual" ? `手动存档 ${slotIndex}` : `自动存档 ${slotIndex}`;

const toSlotId = (slotType: RoomSaveSlotType, slotIndex: number) =>
  `${slotType === "manual" ? "MS" : "AS"}${String(slotIndex).padStart(3, "0")}`;

const createSlot = (slotType: RoomSaveSlotType, slotIndex: number): RoomSaveSlot => ({
  slotId: toSlotId(slotType, slotIndex),
  slotType,
  slotIndex,
  label: toSlotLabel(slotType, slotIndex),
  updatedAt: null,
  round: null,
  savedBy: "",
  note: "",
  snapshot: null
});

export const createRoomSaveSlots = (): RoomSaveSlots => ({
  manual: Array.from({ length: SLOT_COUNT }, (_, i) => createSlot("manual", i + 1)),
  auto: Array.from({ length: SLOT_COUNT }, (_, i) => createSlot("auto", i + 1)),
  autoCursor: 0
});

const normalizeSlotArray = (raw: unknown, slotType: RoomSaveSlotType): RoomSaveSlot[] => {
  const defaults = Array.from({ length: SLOT_COUNT }, (_, i) => createSlot(slotType, i + 1));
  if (!Array.isArray(raw)) return defaults;
  return defaults.map((baseSlot, index) => {
    const source = raw[index];
    if (!isRecord(source)) return baseSlot;
    const slotIndex = baseSlot.slotIndex;
    return {
      slotId: toSlotId(slotType, slotIndex),
      slotType,
      slotIndex,
      label: String(source.label || baseSlot.label),
      updatedAt: Number.isFinite(Number(source.updatedAt)) ? Math.floor(Number(source.updatedAt)) : null,
      round: Number.isFinite(Number(source.round)) ? Math.max(1, Math.floor(Number(source.round))) : null,
      savedBy: String(source.savedBy || ""),
      note: String(source.note || ""),
      snapshot: isRecord(source.snapshot) ? deepClone(source.snapshot as RoomSaveSnapshot) : null
    };
  });
};

export const normalizeRoomSaveSlots = (raw?: Partial<RoomSaveSlots> | null): RoomSaveSlots => {
  const source = (raw || {}) as Record<string, unknown>;
  const autoCursorRaw = Number(source.autoCursor);
  return {
    manual: normalizeSlotArray(source.manual, "manual"),
    auto: normalizeSlotArray(source.auto, "auto"),
    autoCursor: Number.isFinite(autoCursorRaw)
      ? Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(autoCursorRaw)))
      : 0
  };
};

const sanitizeRound = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.floor(num));
};

const sanitizeSlotIndex = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.min(SLOT_COUNT, Math.floor(num)));
};

export const buildRoomSnapshot = (room: any): RoomSaveSnapshot => {
  const playersBySlot: RoomSnapshotPlayerState[] = Array.isArray(room?.players)
    ? room.players.map((player: any) => ({
      playerSlot: sanitizeRound(player?.playerSlot),
      location: String(player?.location || ""),
      currentHP: Number.isFinite(Number(player?.currentHP)) ? Number(player.currentHP) : 0,
      currentMP: Number.isFinite(Number(player?.currentMP)) ? Number(player.currentMP) : 0,
      statusEffects: Array.isArray(player?.statusEffects) ? player.statusEffects.map((item: unknown) => String(item)) : [],
      selectedSavedCharacterId: player?.selectedSavedCharacterId ? String(player.selectedSavedCharacterId) : null,
      canCreateCustomCharacter: Boolean(player?.canCreateCustomCharacter),
      selectedRoleTemplateId: player?.selectedRoleTemplateId ? String(player.selectedRoleTemplateId) : null,
      characterProfile: deepClone(player?.characterProfile || {})
    }))
    : [];

  return {
    version: 1,
    createdAt: Date.now(),
    round: sanitizeRound(room?.currentRound),
    stateTree: deepClone(isRecord(room?.stateTree) ? room.stateTree : {}),
    logs: deepClone(Array.isArray(room?.logs) ? room.logs : []),
    memoryConfig: deepClone(room?.memoryConfig || {}),
    memorySystem: deepClone(room?.memorySystem || {}),
    memoryPendingTask: deepClone(room?.memoryPendingTask || null),
    aiThinkingHistory: deepClone(Array.isArray(room?.aiThinkingHistory) ? room.aiThinkingHistory : []),
    lastTurnSnapshot: deepClone(room?.lastTurnSnapshot || null),
    playersBySlot
  };
};

export const writeRoomSaveSlot = (args: {
  room: any;
  slots: RoomSaveSlots;
  slotType: RoomSaveSlotType;
  slotIndex: number;
  savedBy?: string;
  note?: string;
}) => {
  const slotIndex = sanitizeSlotIndex(args.slotIndex);
  const list = args.slotType === "manual" ? args.slots.manual : args.slots.auto;
  const targetIndex = slotIndex - 1;
  const current = list[targetIndex] || createSlot(args.slotType, slotIndex);
  const snapshot = buildRoomSnapshot(args.room);
  const nextSlot: RoomSaveSlot = {
    ...current,
    slotId: toSlotId(args.slotType, slotIndex),
    slotType: args.slotType,
    slotIndex,
    label: current.label || toSlotLabel(args.slotType, slotIndex),
    updatedAt: snapshot.createdAt,
    round: snapshot.round,
    savedBy: String(args.savedBy || "").trim(),
    note: String(args.note || "").trim(),
    snapshot
  };
  list[targetIndex] = nextSlot;
  return nextSlot;
};

export const writeAutoRoomSave = (args: {
  room: any;
  slots: RoomSaveSlots;
  savedBy?: string;
  note?: string;
}) => {
  const cursor = Number.isFinite(Number(args.slots.autoCursor))
    ? Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(Number(args.slots.autoCursor))))
    : 0;
  const slotIndex = cursor + 1;
  const written = writeRoomSaveSlot({
    room: args.room,
    slots: args.slots,
    slotType: "auto",
    slotIndex,
    savedBy: args.savedBy,
    note: args.note
  });
  args.slots.autoCursor = (cursor + 1) % SLOT_COUNT;
  return written;
};

export const findRoomSaveSlot = (slots: RoomSaveSlots, slotType: RoomSaveSlotType, slotIndex: number) => {
  const idx = sanitizeSlotIndex(slotIndex) - 1;
  const list = slotType === "manual" ? slots.manual : slots.auto;
  return list[idx] || null;
};

export const applyRoomSnapshot = (room: any, snapshot: RoomSaveSnapshot) => {
  if (!snapshot || typeof snapshot !== "object") return;
  room.currentRound = sanitizeRound(snapshot.round);
  room.stateTree = deepClone(isRecord(snapshot.stateTree) ? snapshot.stateTree : {});
  room.logs = deepClone(Array.isArray(snapshot.logs) ? snapshot.logs : []);
  room.memoryConfig = deepClone(snapshot.memoryConfig || {});
  room.memorySystem = deepClone(snapshot.memorySystem || {});
  room.memoryPendingTask = deepClone(snapshot.memoryPendingTask || null);
  room.aiThinkingHistory = deepClone(Array.isArray(snapshot.aiThinkingHistory) ? snapshot.aiThinkingHistory : []);
  room.lastTurnSnapshot = deepClone(snapshot.lastTurnSnapshot || null);

  const bySlot = new Map<number, RoomSnapshotPlayerState>();
  (Array.isArray(snapshot.playersBySlot) ? snapshot.playersBySlot : []).forEach((item) => {
    if (!item) return;
    bySlot.set(sanitizeRound(item.playerSlot), item);
  });

  (Array.isArray(room.players) ? room.players : []).forEach((player: any) => {
    player.isReady = false;
    player.action = "";
    const slot = sanitizeRound(player?.playerSlot);
    const saved = bySlot.get(slot);
    if (!saved) return;
    player.location = String(saved.location || player.location || "");
    player.currentHP = Number.isFinite(Number(saved.currentHP)) ? Number(saved.currentHP) : player.currentHP;
    player.currentMP = Number.isFinite(Number(saved.currentMP)) ? Number(saved.currentMP) : player.currentMP;
    player.statusEffects = Array.isArray(saved.statusEffects) ? saved.statusEffects.map((item) => String(item)) : [];
    player.selectedSavedCharacterId = saved.selectedSavedCharacterId || null;
    player.canCreateCustomCharacter = Boolean(saved.canCreateCustomCharacter);
    player.selectedRoleTemplateId = saved.selectedRoleTemplateId || null;
    player.characterProfile = deepClone(saved.characterProfile || {});
  });
};
