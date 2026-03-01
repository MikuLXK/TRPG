import { io, Socket } from "socket.io-client";

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (this.socket) return;
    // Connect to the server
    this.socket = io("ws://localhost:3000", {
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      this.socket = null;
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }

  createRoom(data: { roomName: string; scriptId: string; password?: string; intro?: string; playerName: string }) {
    this.socket?.emit("create_room", data);
  }

  joinRoom(roomId: string, playerName: string) {
    this.socket?.emit("join_room", { roomId, playerName });
  }
  
  getRooms() {
    this.socket?.emit("get_rooms");
  }

  startGame(roomId: string) {
    this.socket?.emit("start_game", { roomId });
  }

  sendChat(roomId: string, message: string) {
    this.socket?.emit("send_chat", { roomId, message });
  }

  sendAction(roomId: string, action: any) {
    this.socket?.emit("player_action", { roomId, action });
  }

  updatePlayerApi(roomId: string, apiId: string) {
    this.socket?.emit("update_player_api", { roomId, apiId });
  }
}

export const socketService = new SocketService();
