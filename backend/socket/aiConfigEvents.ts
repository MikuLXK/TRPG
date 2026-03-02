export const registerAIConfigEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  FUNCTION_TYPES: string[];
  cloneDefaultAISettings: () => any;
}) => {
  socket.on("toggle_player_ai_function", ({ roomId, functionType }: { roomId: string; functionType: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return socket.emit("error", "Room not found.");
    if (!deps.FUNCTION_TYPES.includes(functionType)) return socket.emit("error", "Invalid function type.");

    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return socket.emit("error", "Player not found in the room.");
    player.apiFunctions[functionType] = !player.apiFunctions[functionType];
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("update_player_ai_config", ({ roomId, aiSettings }: { roomId: string; aiSettings: any }) => {
    const room = deps.rooms[roomId];
    if (!room) return socket.emit("error", "Room not found.");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return socket.emit("error", "Player not found in the room.");

    const defaults = deps.cloneDefaultAISettings();
    player.aiSettings = {
      ...defaults,
      ...aiSettings,
      defaultProvider: aiSettings.defaultProvider || defaults.defaultProvider,
      defaultEndpoint: aiSettings.defaultEndpoint ?? defaults.defaultEndpoint,
      defaultApiKey: aiSettings.defaultApiKey ?? defaults.defaultApiKey,
      actionCollector: {
        ...defaults.actionCollector,
        ...aiSettings.actionCollector,
        connection: { ...defaults.actionCollector.connection, ...(aiSettings.actionCollector?.connection || {}) },
        prompt: { ...defaults.actionCollector.prompt, ...(aiSettings.actionCollector?.prompt || {}) }
      },
      mainStory: {
        ...defaults.mainStory,
        ...aiSettings.mainStory,
        connection: { ...defaults.mainStory.connection, ...(aiSettings.mainStory?.connection || {}) },
        prompt: { ...defaults.mainStory.prompt, ...(aiSettings.mainStory?.prompt || {}) }
      },
      stateProcessor: {
        ...defaults.stateProcessor,
        ...aiSettings.stateProcessor,
        connection: { ...defaults.stateProcessor.connection, ...(aiSettings.stateProcessor?.connection || {}) },
        prompt: { ...defaults.stateProcessor.prompt, ...(aiSettings.stateProcessor?.prompt || {}) }
      }
    };
    deps.io.to(roomId).emit("room_updated", room);
  });
};

