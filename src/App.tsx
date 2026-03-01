import React, { useState, useEffect } from 'react';
import GameView from './components/Game/GameView';
import Home from './components/Home/Home';
import WaitingRoom from './components/Home/WaitingRoom';
import { socketService } from './services/socketService';

export default function App() {
  const [roomState, setRoomState] = useState<any>(null);
  const [isInGame, setIsInGame] = useState(false);

  useEffect(() => {
    // Connect socket on mount
    socketService.connect();

    const socket = socketService.socket;
    if (socket) {
      socket.on("room_updated", (updatedRoom) => {
        setRoomState(updatedRoom);
        if (updatedRoom.status !== 'waiting') {
          setIsInGame(true);
        }
      });
    }

    return () => {
      // socketService.disconnect(); // Keep connection alive for now
    };
  }, []);

  const handleJoinGame = (room: any) => {
    setRoomState(room);
    setIsInGame(false); // Go to waiting room first
  };

  const handleStartGame = () => {
    setIsInGame(true);
  };

  const handleLeaveRoom = () => {
    // socketService.disconnect(); // Maybe just leave room event?
    // For now, reload page or reset state
    setRoomState(null);
    setIsInGame(false);
    window.location.reload(); // Simple reset for prototype
  };

  if (!roomState) {
    return <Home onJoinGame={handleJoinGame} />;
  }

  if (!isInGame) {
    return (
      <WaitingRoom 
        roomState={roomState} 
        onStartGame={handleStartGame} 
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <GameView 
      roomState={roomState} 
      onExit={handleLeaveRoom} 
    />
  );
}
