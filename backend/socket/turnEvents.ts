export const registerTurnEvents = (socket: any, deps: {
  rooms: Record<string, any>;
  io: any;
  getActivePlayers: (room: any) => Array<any>;
  processTurn: (roomId: string) => void;
  removePlayerFromRoom: (socketId: string) => void;
}) => {
  socket.on("set_room_streaming_mode", ({ roomId, mode }: { roomId: string; mode: "off" | "provider" }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    room.streamingMode = mode === "provider" ? "provider" : "off";
    deps.io.to(roomId).emit("room_updated", room);
  });

  socket.on("chat_message", ({ roomId, message }: { roomId: string; message: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;

    const newLog = {
      id: Date.now().toString(),
      发送者: player.name,
      内容: message,
      类型: "OOC",
      时间戳: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    room.logs.push(newLog);
    deps.io.to(roomId).emit("new_log", newLog);
  });

  socket.on("submit_action", ({ roomId, action }: { roomId: string; action: string }) => {
    const room = deps.rooms[roomId];
    if (!room) return;
    const player = room.players.find((p: any) => p.id === socket.id);
    if (!player) return;
    if (player.isReady) return;

    player.action = action;
    player.isReady = true;
    const activePlayers = deps.getActivePlayers(room);
    const readyCount = activePlayers.filter((p: any) => p.isReady).length;
    deps.io.to(roomId).emit("turn_progress", { readyCount, total: activePlayers.length });
    deps.io.to(roomId).emit("room_updated", room);

    const allReady = activePlayers.length > 0 && activePlayers.every((p: any) => p.isReady);
    if (allReady) {
      room.status = "processing";
      deps.io.to(roomId).emit("room_updated", room);
      deps.io.emit("rooms_list_updated");
      deps.processTurn(roomId);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    deps.removePlayerFromRoom(socket.id);
  });
};
