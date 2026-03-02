import type { ScriptDefinition } from "../../src/types/Script";

export const registerCharacterSetupEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  computeHash: (value: unknown) => string;
  createDefaultCharacterProfile: (template: any) => any;
  applyCharacterProfilePatch: (room: any, player: any, patch: any) => void;
  switchGameSetupMode: (room: any, mode: "new_game" | "load_save") => void;
  claimSavedCharacterForPlayer: (room: any, player: any, characterId: string) => void;
  setPlayerCustomCharacterMode: (room: any, player: any, enabled: boolean) => void;
  validateStartCondition: (room: any) => boolean;
  getActivePlayers: (room: any) => Array<any>;
}) => {
  socket.on("select_role_template", ({ roomId, roleTemplateId }: { roomId: string; roleTemplateId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅选择角色");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    const roleExists = room.script.roleTemplates.some((role: any) => role.id === roleTemplateId);
    if (!roleExists) return socket.emit("error", "角色模板不存在");
    if (room.gameSetupMode === "load_save" && !player.canCreateCustomCharacter) {
      return socket.emit("error", "加载存档模式下，请先选择存档角色或切换到创建角色");
    }
    player.selectedRoleTemplateId = roleTemplateId;
    const selectedTemplate = room.script.roleTemplates.find((role: any) => role.id === roleTemplateId);
    if (selectedTemplate) {
      player.characterProfile = deps.createDefaultCharacterProfile(selectedTemplate);
      deps.applyCharacterProfilePatch(room, player, {});
    }
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("update_character_profile", ({ roomId, profile }: { roomId: string; profile: any }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅编辑角色信息");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (room.gameSetupMode === "load_save" && !player.canCreateCustomCharacter) {
      return socket.emit("error", "加载存档模式下，请先选择存档角色或切换到创建角色");
    }
    deps.applyCharacterProfilePatch(room, player, profile);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("set_game_setup_mode", ({ roomId, mode }: { roomId: string; mode: "new_game" | "load_save" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("error", "只有房主可以切换游戏模式");
    if (room.hasStarted || room.status !== "waiting") return socket.emit("error", "游戏开始后不可切换模式");
    deps.switchGameSetupMode(room, mode);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("claim_saved_character", ({ roomId, characterId }: { roomId: string; characterId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅选择角色");
    if (room.gameSetupMode !== "load_save") return socket.emit("error", "当前不是加载存档模式");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    try {
      deps.claimSavedCharacterForPlayer(room, player, characterId);
    } catch (error) {
      return socket.emit("error", String((error as Error)?.message ?? error));
    }
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("set_custom_character_mode", ({ roomId, enabled }: { roomId: string; enabled: boolean }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.status !== "waiting") return socket.emit("error", "仅可在等待大厅切换角色创建模式");
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (room.gameSetupMode !== "load_save") {
      player.canCreateCustomCharacter = true;
      return deps.io.to(roomId).emit("room_updated", room);
    }
    deps.setPlayerCustomCharacterMode(room, player, enabled);
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("publish_shared_asset", ({ roomId, assetType, id, name, updatedAt, payload }: { roomId: string; assetType: "script" | "save"; id: string; name: string; updatedAt: number; payload: any }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (!id || !name) return socket.emit("error", "共享资源缺少必要信息");

    room.sharedAssets[assetType] = {
      assetType,
      id,
      name,
      hash: deps.computeHash(payload),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      ownerId: socket.id,
      payload
    };

    if (assetType === "script") {
      const nextScript = payload as ScriptDefinition;
      if (!nextScript || !Array.isArray(nextScript.roleTemplates) || !nextScript.roleTemplates.length) {
        return socket.emit("error", "共享剧本格式无效");
      }
      room.script = nextScript;
      room.scriptId = nextScript.id;
      room.players.forEach((p: any) => {
        if (!p.selectedRoleTemplateId || !nextScript.roleTemplates.some((r) => r.id === p.selectedRoleTemplateId)) {
          p.selectedRoleTemplateId = nextScript.roleTemplates[0]?.id || null;
          if (nextScript.roleTemplates[0]) {
            p.characterProfile = deps.createDefaultCharacterProfile(nextScript.roleTemplates[0]);
            deps.applyCharacterProfilePatch(room, p, {});
          }
        }
      });
    }
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("request_shared_asset", ({ roomId, assetType }: { roomId: string; assetType: "script" | "save" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    const asset = room.sharedAssets[assetType];
    if (!asset) return socket.emit("error", "该房间暂无可下载资源");
    socket.emit("shared_asset_payload", asset);
  });

  socket.on("start_game", ({ roomId }: { roomId: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("error", "只有房主可以开始游戏");
    if (!deps.validateStartCondition(room)) return socket.emit("error", "三个AI功能都至少需要一名玩家提供API");
    if (room.gameSetupMode === "load_save") {
      const activePlayers = deps.getActivePlayers(room);
      const hasUnassigned = activePlayers.some((player: any) => !player.selectedSavedCharacterId && !player.canCreateCustomCharacter);
      if (hasUnassigned) return socket.emit("error", "加载存档模式下，仍有玩家未选择角色或未进入创建角色");
    }
    room.status = "playing";
    room.hasStarted = true;
    deps.io.to(roomId).emit("room_updated", room);
    deps.io.emit("rooms_list_updated");
    console.log(`Game started in room ${roomId}`);
  });
};

