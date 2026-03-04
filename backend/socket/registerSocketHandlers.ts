import { registerAIConfigEvents } from "./aiConfigEvents";
import { registerCharacterSetupEvents } from "./characterSetupEvents";
import { registerRoomMembershipEvents } from "./roomMembershipEvents";
import { registerTurnEvents } from "./turnEvents";

export const registerSocketHandlers = (deps: {
  io: any;
  rooms: Record<string, any>;
  socketRoomIndex: Record<string, string>;
  processTurn: (roomId: string) => void;
  removePlayerFromRoom: (socketId: string) => void;
  getActivePlayers: (room: any) => Array<any>;
  findRuntimeScript: (scriptId: string) => any;
  generateRoomId: () => string;
  cloneDefaultAISettings: () => any;
  createDefaultCharacterProfile: (template: any) => any;
  getMaxHPByAttributes: (attrs: any) => number;
  getMaxMPByAttributes: (attrs: any) => number;
  computeHash: (value: unknown) => string;
  syncHostIfNeeded: (room: any) => void;
  FUNCTION_TYPES: string[];
  applyCharacterProfilePatch: (room: any, player: any, patch: any) => void;
  switchGameSetupMode: (room: any, mode: "new_game" | "load_save") => void;
  claimSavedCharacterForPlayer: (room: any, player: any, characterId: string) => void;
  setPlayerCustomCharacterMode: (room: any, player: any, enabled: boolean) => void;
  validateStartCondition: (room: any) => boolean;
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
  deps.io.on("connection", (socket: any) => {
    console.log(`Client connected: ${socket.id}`);

    registerRoomMembershipEvents(socket, {
      rooms: deps.rooms,
      io: deps.io,
      socketRoomIndex: deps.socketRoomIndex,
      getActivePlayers: deps.getActivePlayers,
      findRuntimeScript: deps.findRuntimeScript,
      generateRoomId: deps.generateRoomId,
      cloneDefaultAISettings: deps.cloneDefaultAISettings,
      createDefaultCharacterProfile: deps.createDefaultCharacterProfile,
      claimSavedCharacterForPlayer: deps.claimSavedCharacterForPlayer,
      getMaxHPByAttributes: deps.getMaxHPByAttributes,
      getMaxMPByAttributes: deps.getMaxMPByAttributes,
      computeHash: deps.computeHash,
      syncHostIfNeeded: deps.syncHostIfNeeded
    });

    registerAIConfigEvents(socket, {
      rooms: deps.rooms,
      io: deps.io,
      FUNCTION_TYPES: deps.FUNCTION_TYPES,
      cloneDefaultAISettings: deps.cloneDefaultAISettings
    });

    registerCharacterSetupEvents(socket, {
      rooms: deps.rooms,
      io: deps.io,
      computeHash: deps.computeHash,
      createDefaultCharacterProfile: deps.createDefaultCharacterProfile,
      applyCharacterProfilePatch: deps.applyCharacterProfilePatch,
      switchGameSetupMode: deps.switchGameSetupMode,
      claimSavedCharacterForPlayer: deps.claimSavedCharacterForPlayer,
      setPlayerCustomCharacterMode: deps.setPlayerCustomCharacterMode,
      validateStartCondition: deps.validateStartCondition,
      getActivePlayers: deps.getActivePlayers
    });

    registerTurnEvents(socket, {
      rooms: deps.rooms,
      io: deps.io,
      getActivePlayers: deps.getActivePlayers,
      processTurn: deps.processTurn,
      removePlayerFromRoom: deps.removePlayerFromRoom,
      runMemorySummary: deps.runMemorySummary,
      normalizeRoomMemoryConfig: deps.normalizeRoomMemoryConfig,
      normalizeRoomMemorySystem: deps.normalizeRoomMemorySystem,
      buildMemoryTask: deps.buildMemoryTask
    });
  });
};
