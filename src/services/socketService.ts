import { io, Socket } from "socket.io-client";
import type { GameSettings, AIFunctionType, AIProviderType } from "../types/Settings";
import type { PlayerCharacterProfile } from "../types/Script";

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (this.socket) return;
    this.socket = io({
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

  createRoom(data: {
    roomName: string;
    scriptId: string;
    password?: string;
    intro?: string;
    playerName: string;
    accountUsername?: string;
    scriptPayload?: any;
  }) {
    this.socket?.emit("create_room", data);
  }

  joinRoom(roomId: string, playerName: string, accountUsername?: string, password?: string) {
    this.socket?.emit("join_room", { roomId, playerName, accountUsername, password });
  }

  getRooms(data?: { accountUsername?: string; playerName?: string }) {
    this.socket?.emit("get_rooms", data);
  }

  setGameSetupMode(roomId: string, mode: "new_game" | "load_save") {
    this.socket?.emit("set_game_setup_mode", { roomId, mode });
  }

  claimSavedCharacter(roomId: string, characterId: string) {
    this.socket?.emit("claim_saved_character", { roomId, characterId });
  }

  setCustomCharacterMode(roomId: string, enabled: boolean) {
    this.socket?.emit("set_custom_character_mode", { roomId, enabled });
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

  setRoomStreamingMode(roomId: string, mode: "off" | "provider") {
    this.socket?.emit("set_room_streaming_mode", { roomId, mode });
  }

  togglePlayerAIFunction(roomId: string, functionType: AIFunctionType) {
    this.socket?.emit("toggle_player_ai_function", { roomId, functionType });
  }

  updatePlayerAIConfig(roomId: string, aiSettings: GameSettings["ai"]) {
    this.socket?.emit("update_player_ai_config", { roomId, aiSettings });
  }

  selectRoleTemplate(roomId: string, roleTemplateId: string) {
    this.socket?.emit("select_role_template", { roomId, roleTemplateId });
  }

  updateCharacterProfile(roomId: string, profile: Partial<PlayerCharacterProfile>) {
    this.socket?.emit("update_character_profile", { roomId, profile });
  }

  requestSharedAsset(roomId: string, assetType: "script" | "save") {
    this.socket?.emit("request_shared_asset", { roomId, assetType });
  }

  publishSharedAsset(args: {
    roomId: string;
    assetType: "script" | "save";
    id: string;
    name: string;
    updatedAt: number;
    payload: any;
  }) {
    this.socket?.emit("publish_shared_asset", args);
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
