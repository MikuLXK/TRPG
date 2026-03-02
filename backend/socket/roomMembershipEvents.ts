export const registerRoomMembershipEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  socketRoomIndex: Record<string, string>;
  getActivePlayers: (room: any) => Array<any>;
  findRuntimeScript: (scriptId: string) => any;
  generateRoomId: () => string;
  cloneDefaultAISettings: () => any;
  createDefaultCharacterProfile: (template: any) => any;
  getMaxHPByAttributes: (attrs: any) => number;
  getMaxMPByAttributes: (attrs: any) => number;
  computeHash: (value: unknown) => string;
  syncHostIfNeeded: (room: any) => void;
}) => {
  socket.on("get_rooms", (data?: { accountUsername?: string; playerName?: string }) => {
    const accountUsername = typeof data?.accountUsername === "string" ? data.accountUsername.trim() : "";
    const playerName = typeof data?.playerName === "string" ? data.playerName.trim() : "";

    const roomList = Object.values(deps.rooms).map((r: any) => {
      const activePlayers = deps.getActivePlayers(r);
      const reconnectCandidate = accountUsername
        ? r.players.find((p: any) => p.accountUsername === accountUsername)
        : playerName ? r.players.find((p: any) => p.name === playerName) : undefined;
      const reconnectable = Boolean(r.hasStarted && reconnectCandidate && !reconnectCandidate.isOnline);
      return {
        id: r.id,
        name: r.name,
        script: r.script.title,
        players: activePlayers.length,
        maxPlayers: r.maxPlayers,
        locked: !!r.password,
        status: r.status,
        inGame: r.hasStarted,
        reconnectable
      };
    });
    socket.emit("rooms_list", roomList);
  });

  socket.on("create_room", (data: any) => {
    const scriptFromPayload = data.scriptPayload && data.scriptPayload.id === data.scriptId ? data.scriptPayload : undefined;
    const script = scriptFromPayload || deps.findRuntimeScript(data.scriptId);
    if (!script) return socket.emit("error", "无效剧本");
    if (!script.roleTemplates.length) return socket.emit("error", "该剧本未配置角色模板");

    const roomId = deps.generateRoomId();
    const newRoom = {
      id: roomId,
      hostId: socket.id,
      name: data.roomName,
      scriptId: data.scriptId,
      password: (data.password || "").trim() || undefined,
      intro: data.intro,
      players: [{
        id: socket.id,
        name: data.playerName || "房主",
        accountUsername: data.accountUsername,
        isReady: false,
        action: "",
        location: "初始地点",
        role: "未分配",
        avatar: "bg-amber-500",
        isOnline: true,
        lastSeenAt: null,
        selectedSavedCharacterId: null,
        canCreateCustomCharacter: true,
        apiFunctions: { actionCollector: false, mainStory: false, stateProcessor: false },
        aiSettings: deps.cloneDefaultAISettings(),
        selectedRoleTemplateId: script.roleTemplates[0]?.id || null,
        characterProfile: deps.createDefaultCharacterProfile(script.roleTemplates[0]),
        currentHP: deps.getMaxHPByAttributes(script.roleTemplates[0].baseAttributes),
        currentMP: deps.getMaxMPByAttributes(script.roleTemplates[0].baseAttributes),
        statusEffects: []
      }],
      status: "waiting",
      hasStarted: false,
      gameSetupMode: "new_game",
      savedCharacters: [],
      currentRound: 1,
      logs: [],
      maxPlayers: 4,
      functionRotationIndex: { actionCollector: 0, mainStory: 0, stateProcessor: 0 },
      emptySince: null,
      script,
      sharedAssets: {
        script: {
          assetType: "script",
          id: script.id,
          name: script.title,
          hash: deps.computeHash(script),
          updatedAt: Date.now(),
          ownerId: socket.id,
          payload: script
        }
      }
    };

    deps.rooms[roomId] = newRoom;
    deps.socketRoomIndex[socket.id] = roomId;
    socket.join(roomId);
    socket.emit("room_created", { roomId, roomState: newRoom });
    deps.io.to(roomId).emit("room_updated", newRoom);
    deps.io.emit("rooms_list_updated");
    console.log(`Room created: ${roomId} (${data.roomName}) by ${data.playerName}`);
  });

  socket.on("join_room", ({ roomId, playerName, accountUsername, password }: { roomId: string; playerName: string; accountUsername?: string; password?: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return socket.emit("error", "房间不存在");

    const activePlayers = deps.getActivePlayers(room);
    const identityKey = typeof accountUsername === "string" && accountUsername.trim()
      ? { type: "account" as const, value: accountUsername.trim() }
      : { type: "name" as const, value: playerName };
    const existingPlayer = room.players.find((p: any) => identityKey.type === "account" ? p.accountUsername === identityKey.value : p.name === identityKey.value);
    const isReconnectAttempt = Boolean(existingPlayer && !existingPlayer.isOnline);

    if (!isReconnectAttempt && room.password && room.password !== (password ?? "")) return socket.emit("error", "房间密码错误");
    if (room.hasStarted) {
      if (!existingPlayer) return socket.emit("error", "游戏已开始，仅支持断线重连");
      if (existingPlayer.isOnline) return socket.emit("error", "该玩家已在线");
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.name = playerName;
      existingPlayer.accountUsername = accountUsername ?? existingPlayer.accountUsername;
      existingPlayer.isOnline = true;
      existingPlayer.lastSeenAt = null;
      if (oldId && oldId !== socket.id) delete deps.socketRoomIndex[oldId];
      deps.socketRoomIndex[socket.id] = roomId;
      room.emptySince = null;
      socket.join(roomId);
      if (deps.getActivePlayers(room).length === 1) room.hostId = socket.id;
      else deps.syncHostIfNeeded(room);
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");
      return console.log(`${playerName} reconnected to room ${roomId}`);
    }

    if (room.status !== "waiting") return socket.emit("error", "房间暂不可加入");
    if (activePlayers.length >= room.maxPlayers) return socket.emit("error", "房间人数已满");

    if (existingPlayer) {
      if (existingPlayer.isOnline) return socket.emit("error", "玩家名已存在");
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.name = playerName;
      existingPlayer.accountUsername = accountUsername ?? existingPlayer.accountUsername;
      existingPlayer.isOnline = true;
      existingPlayer.lastSeenAt = null;
      existingPlayer.isReady = false;
      existingPlayer.action = "";
      if (oldId && oldId !== socket.id) delete deps.socketRoomIndex[oldId];
      deps.socketRoomIndex[socket.id] = roomId;
      room.emptySince = null;
      socket.join(roomId);
      if (deps.getActivePlayers(room).length === 1) room.hostId = socket.id;
      else deps.syncHostIfNeeded(room);
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");
      return console.log(`${playerName} rejoined room ${roomId}`);
    }

    const firstTemplate = room.script.roleTemplates[0];
    if (!firstTemplate) return socket.emit("error", "该剧本未配置角色模板");
    room.players.push({
      id: socket.id,
      name: playerName,
      accountUsername,
      isReady: false,
      action: "",
      location: "初始地点",
      isOnline: true,
      lastSeenAt: null,
      selectedSavedCharacterId: null,
      canCreateCustomCharacter: room.gameSetupMode === "new_game",
      apiFunctions: { actionCollector: false, mainStory: false, stateProcessor: false },
      aiSettings: deps.cloneDefaultAISettings(),
      selectedRoleTemplateId: firstTemplate.id,
      characterProfile: deps.createDefaultCharacterProfile(firstTemplate),
      currentHP: deps.getMaxHPByAttributes(firstTemplate.baseAttributes),
      currentMP: deps.getMaxMPByAttributes(firstTemplate.baseAttributes),
      statusEffects: []
    });
    room.emptySince = null;
    deps.socketRoomIndex[socket.id] = roomId;
    socket.join(roomId);
    if (deps.getActivePlayers(room).length === 1) room.hostId = socket.id;
    else deps.syncHostIfNeeded(room);
    deps.io.to(roomId).emit("room_updated", room);
    deps.io.emit("rooms_list_updated");
    console.log(`${playerName} joined room ${roomId}`);
  });
};

