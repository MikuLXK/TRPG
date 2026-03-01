import { io, Socket } from "socket.io-client";
import type { GameSettings, AIFunctionType, AIProviderType } from "../types/Settings";

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (this.socket) return;
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
    this.socket?.emit("chat_message", { roomId, message });
  }

  submitAction(roomId: string, action: string) {
    this.socket?.emit("submit_action", { roomId, action });
  }

  togglePlayerAIFunction(roomId: string, functionType: AIFunctionType) {
    this.socket?.emit("toggle_player_ai_function", { roomId, functionType });
  }

  updatePlayerAIConfig(roomId: string, aiSettings: GameSettings["ai"]) {
    this.socket?.emit("update_player_ai_config", { roomId, aiSettings });
  }

  async fetchPromptDefaults() {
    const response = await fetch("/api/prompts/defaults");
    if (!response.ok) {
      throw new Error("获取默认提示词失败");
    }
    return response.json();
  }

  async fetchModels(args: {
    provider: AIProviderType;
    endpoint: string;
    apiKey: string;
  }) {
    const response = await fetch("/api/models", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "获取模型失败" }));
      throw new Error(payload.error || "获取模型失败");
    }

    return response.json() as Promise<{ models: Array<{ id: string; name: string }> }>;
  }
}

export const socketService = new SocketService();
