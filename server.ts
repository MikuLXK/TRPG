import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import ViteExpress from "vite-express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Game State Management (In-Memory) ---

interface Player {
  id: string; // Socket ID
  name: string;
  isReady: boolean;
  action: string;
  location: string; // Current location context
  avatar?: string;
  role?: string;
  apiFunctions: {
    actionCollector: boolean;
    mainStory: boolean;
    stateProcessor: boolean;
  };
}

interface Room {
  id: string;
  hostId: string;
  name: string;
  scriptId: string;
  password?: string;
  intro?: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'processing' | 'story_generation' | 'settlement';
  currentRound: number;
  logs: any[]; // Store game logs
  maxPlayers: number;
}

const rooms: Record<string, Room> = {};

// Helper: Generate Room ID
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// --- Socket.IO Logic ---

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Get Rooms List
  socket.on("get_rooms", () => {
    const roomList = Object.values(rooms).map(r => ({
      id: r.id,
      name: r.name,
      script: r.scriptId,
      players: r.players.length,
      maxPlayers: r.maxPlayers,
      locked: !!r.password
    }));
    socket.emit("rooms_list", roomList);
  });

  // Create Room
  socket.on("create_room", (data: { roomName: string, scriptId: string, password?: string, intro?: string, playerName: string }) => {
    const roomId = generateRoomId();
    const newRoom: Room = {
      id: roomId,
      hostId: socket.id,
      name: data.roomName,
      scriptId: data.scriptId,
      password: data.password,
      intro: data.intro,
      players: [{
        id: socket.id,
        name: data.playerName || "房主",
        isReady: false,
        action: "",
        location: "初始地点",
        role: "未分配",
        avatar: "bg-amber-500",
        api: null,
      }],
      status: 'waiting',
      currentRound: 1,
      logs: [],
      maxPlayers: 4
    };
    rooms[roomId] = newRoom;
    
    socket.join(roomId);
    socket.emit("room_created", { roomId, roomState: newRoom });
    io.emit("rooms_list_updated"); 
    console.log(`Room created: ${roomId} (${data.roomName}) by ${data.playerName}`);
  });

  // Join Room
  socket.on("join_room", ({ roomId, playerName }: { roomId: string, playerName: string }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "房间不存在");
      return;
    }
    
    if (room.status !== 'waiting') {
      socket.emit("error", "游戏已开始，无法加入");
      return;
    }

    const existingPlayer = room.players.find(p => p.name === playerName);
    if (existingPlayer) {
       socket.emit("error", "玩家名已存在");
       return;
    }

    const newPlayer: Player = {
      id: socket.id,
      name: playerName,
      isReady: false,
      action: "",
      location: "初始地点",
      api: null,
    };

    room.players.push(newPlayer);
    socket.join(roomId);
    
    // Broadcast update to all in room
    io.to(roomId).emit("room_updated", room);
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Update Player API
  socket.on("update_player_api", ({ roomId, apiId }) => {
    const room = rooms[roomId];
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        console.log(`Player ${player.name} in room ${roomId} selected API: ${apiId}`);
        player.api = apiId;

        // Broadcast the change to everyone in the room
        io.to(roomId).emit("room_updated", room);
      } else {
        socket.emit("error", "Player not found in the room.");
      }
    } else {
      socket.emit("error", "Room not found.");
    }
  });

  // Start Game
  socket.on("start_game", (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    
    // Only host can start
    if (room.hostId !== socket.id) {
      socket.emit("error", "只有房主可以开始游戏");
      return;
    }

    room.status = 'playing';
    io.to(roomId).emit("room_updated", room);
    console.log(`Game started in room ${roomId}`);
  });

  // Chat Message
  socket.on("chat_message", ({ roomId, message }: { roomId: string, message: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const newLog = {
      id: Date.now().toString(),
      发送者: player.name,
      内容: message,
      类型: 'OOC',
      时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    room.logs.push(newLog);
    socket.broadcast.to(roomId).emit("new_log", newLog);
  });

  // Submit Action
  socket.on("submit_action", ({ roomId, action }: { roomId: string, action: string }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.action = action;
    player.isReady = true;

    // Check if all players are ready
    const allReady = room.players.every(p => p.isReady);
    
    io.to(roomId).emit("room_updated", room);

    if (allReady) {
      room.status = 'processing';
      io.to(roomId).emit("room_updated", room);
      // Trigger AI processing flow (Placeholder for now)
      console.log(`All players ready in room ${roomId}. Starting processing...`);
      processTurn(roomId); 
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Handle player leaving logic if needed
    // For simplicity, we keep the player in the room object for now, 
    // but in a real app we might want to mark them as disconnected or remove them.
  });
});

// --- AI Processing Stub ---
async function processTurn(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  try {
    // 1. Action Collector AI (Mock)
    // In real implementation, call the AI API here using the settings provided by the host
    console.log("AI: Collecting actions...");
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Main Story AI (Mock)
    console.log("AI: Generating story...");
    room.status = 'story_generation';
    io.to(roomId).emit("room_updated", room);
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. State Processor AI (Mock)
    console.log("AI: Processing state...");
    room.status = 'settlement';
    io.to(roomId).emit("room_updated", room);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Round Complete
    room.currentRound += 1;
    room.status = 'waiting';
    room.players.forEach(p => {
      p.isReady = false;
      p.action = "";
    });

    io.to(roomId).emit("round_complete", { 
      room, 
      story: "（模拟剧情）经过一番探索，你们发现了一个神秘的宝箱..." 
    });

  } catch (error) {
    console.error("Error processing turn:", error);
    io.to(roomId).emit("error", "AI 处理回合失败");
    room.status = 'waiting'; // Reset to waiting on error
    io.to(roomId).emit("room_updated", room);
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

ViteExpress.bind(app, httpServer);
