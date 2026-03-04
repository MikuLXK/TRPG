export const registerRoomMembershipEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  socketRoomIndex: Record<string, string>;
  getActivePlayers: (room: any) => Array<any>;
  findRuntimeScript: (scriptId: string) => any;
  generateRoomId: () => string;
  cloneDefaultAISettings: () => any;
  createDefaultCharacterProfile: (template: any) => any;
  claimSavedCharacterForPlayer: (room: any, player: any, characterId: string) => void;
  getMaxHPByAttributes: (attrs: any) => number;
  getMaxMPByAttributes: (attrs: any) => number;
  computeHash: (value: unknown) => string;
  syncHostIfNeeded: (room: any) => void;
}) => {
  const normalizeAccountKey = (value: unknown) => String(value || "").trim().toLowerCase();
  const normalizeSlot = (value: unknown, maxPlayers = 4) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1;
    return Math.max(1, Math.min(maxPlayers, Math.floor(num)));
  };

  const ensureAccountSlotMap = (room: any) => {
    if (!room.accountSlotMap || typeof room.accountSlotMap !== "object") {
      room.accountSlotMap = {};
    }
    return room.accountSlotMap as Record<string, number>;
  };

  const collectUsedSlots = (room: any) => {
    const used = new Set<number>();
    room.players.forEach((player: any) => {
      used.add(normalizeSlot(player.playerSlot, room.maxPlayers || 4));
    });
    return used;
  };

  const pickPlayerSlotForJoin = (room: any, accountUsername?: string) => {
    const map = ensureAccountSlotMap(room);
    const accountKey = normalizeAccountKey(accountUsername);
    const usedSlots = collectUsedSlots(room);
    const maxPlayers = Math.max(1, Number(room.maxPlayers) || 4);

    if (accountKey) {
      const preferred = normalizeSlot(map[accountKey], maxPlayers);
      if (!usedSlots.has(preferred)) {
        map[accountKey] = preferred;
        return preferred;
      }
    }

    for (let slot = 1; slot <= maxPlayers; slot += 1) {
      if (!usedSlots.has(slot)) {
        if (accountKey) map[accountKey] = slot;
        return slot;
      }
    }
    return 1;
  };

  const tryAutoClaimSlotCharacter = (room: any, player: any) => {
    if (room.gameSetupMode !== "load_save") return;
    if (!Array.isArray(room.savedCharacters) || room.savedCharacters.length === 0) return;
    const playerSlot = normalizeSlot(player.playerSlot, room.maxPlayers || 4);
    const target = room.savedCharacters.find((saved: any) => normalizeSlot(saved.slotIndex, room.maxPlayers || 4) === playerSlot);
    if (!target) return;
    if (target.claimedBy && target.claimedBy !== player.id) return;
    const playerAccount = normalizeAccountKey(player.accountUsername);
    const preferredAccount = normalizeAccountKey(target.preferredAccountUsername);
    if (!playerAccount || !preferredAccount || playerAccount !== preferredAccount) return;

    try {
      deps.claimSavedCharacterForPlayer(room, player, target.id);
    } catch {
      // ignore auto-claim failure
    }
  };

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
    const hostSlot = 1;
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
        playerSlot: hostSlot,
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
      streamingMode: "provider",
      hasStarted: false,
      gameSetupMode: "new_game",
      savedCharacters: [],
      currentRound: 1,
      logs: [],
      maxPlayers: 4,
      functionRotationIndex: { actionCollector: 0, mainStory: 0, stateProcessor: 0 },
      emptySince: null,
      script,
      accountSlotMap: data.accountUsername ? { [normalizeAccountKey(data.accountUsername)]: hostSlot } : {},
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
      ensureAccountSlotMap(room);
      if (existingPlayer.accountUsername) {
        room.accountSlotMap[normalizeAccountKey(existingPlayer.accountUsername)] = normalizeSlot(existingPlayer.playerSlot, room.maxPlayers || 4);
      }
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
      ensureAccountSlotMap(room);
      if (existingPlayer.accountUsername) {
        room.accountSlotMap[normalizeAccountKey(existingPlayer.accountUsername)] = normalizeSlot(existingPlayer.playerSlot, room.maxPlayers || 4);
      }
      existingPlayer.isOnline = true;
      existingPlayer.lastSeenAt = null;
      existingPlayer.isReady = false;
      existingPlayer.action = "";
      tryAutoClaimSlotCharacter(room, existingPlayer);
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
    const playerSlot = pickPlayerSlotForJoin(room, accountUsername);
    const nextPlayer = {
      id: socket.id,
      name: playerName,
      accountUsername,
      playerSlot,
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
    };
    if (room.gameSetupMode === "load_save") {
      nextPlayer.canCreateCustomCharacter = false;
      tryAutoClaimSlotCharacter(room, nextPlayer);
    }
    room.players.push(nextPlayer);
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
