import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { socketService } from '../../services/socketService';
import SettingsModal from '../Settings/SettingsModal';
import Toast, { ToastType } from '../UI/Toast';
import MainMenu from './MainMenu/MainMenu';
import CreateRoom from './CreateRoom/CreateRoom';
import JoinRoom from './JoinRoom/JoinRoom';

interface HomeProps {
  onJoinGame: (roomState: any) => void;
}

export default function Home({ onJoinGame }: HomeProps) {
  const [view, setView] = useState<'main' | 'create' | 'join'>('main');
  const [playerName, setPlayerName] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    socketService.connect();

    const socket = socketService.socket;
    if (socket) {
      const onRoomCreated = ({ roomState }: { roomState: any }) => {
        console.log("Room created, joining game:", roomState.id);
        onJoinGame(roomState);
      };

      const onRoomJoined = (roomState: any) => {
        // This event is fired when a player (including the current user) successfully joins a room.
        if (roomState.players.some((p: any) => p.id === socket.id)) {
            console.log("Successfully joined room, transitioning to game:", roomState.id);
            onJoinGame(roomState);
        }
      };

      const onError = (msg: string) => {
        showToast(`Error: ${msg}`, 'error');
      };

      socket.on("room_created", onRoomCreated);
      socket.on("room_updated", onRoomJoined);
      socket.on("error", onError);

      return () => {
        socket.off("room_created", onRoomCreated);
        socket.off("room_updated", onRoomJoined);
        socket.off("error", onError);
      };
    }
  }, [onJoinGame]);

  const handleCreateRoom = (params: { roomName: string, scriptId: string, password?: string, intro?: string }) => {
    if (!playerName.trim()) {
      showToast("请输入玩家昵称", 'error');
      return;
    }
    socketService.createRoom({
      ...params,
      playerName
    });
  };

  const handleJoinRoom = (roomId: string) => {
    if (!playerName.trim()) {
      showToast("请输入玩家昵称", 'error');
      return;
    }
    if (!roomId.trim()) {
      showToast("请输入或选择一个房间", 'error');
      return;
    }
    socketService.joinRoom(roomId, playerName);
  };

  const renderView = () => {
    switch (view) {
      case 'create':
        return (
          <CreateRoom
            playerName={playerName}
            setPlayerName={setPlayerName}
            onBack={() => setView('main')}
            onCreateRoom={handleCreateRoom}
          />
        );
      case 'join':
        return (
          <JoinRoom
            playerName={playerName}
            setPlayerName={setPlayerName}
            onBack={() => setView('main')}
            onJoinRoom={handleJoinRoom}
          />
        );
      case 'main':
      default:
        return (
          <motion.div
            key="main"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="relative z-10 w-full h-full flex flex-col items-center justify-center"
          >
            <MainMenu setView={setView} setIsSettingsOpen={setIsSettingsOpen} />
          </motion.div>
        );
    }
  };

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden selection:bg-amber-500/30 selection:text-amber-200 relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
