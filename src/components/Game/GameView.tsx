import React, { useState, useEffect } from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import CharacterPanel from '../Panels/CharacterPanel';
import GameLogPanel from '../Panels/GameLogPanel';
import RightPanel from '../Panels/RightPanel';
import SettingsModal from '../Settings/SettingsModal';
import { 初始游戏状态, 游戏状态, 游戏日志 } from '../../types/GameData';
import { socketService } from '../../services/socketService';

interface GameViewProps {
  roomState: any;
  onExit: () => void;
}

export default function GameView({ roomState, onExit }: GameViewProps) {
  const [游戏数据, set游戏数据] = useState<游戏状态>(初始游戏状态);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize logs from roomState if any
    if (roomState?.logs && roomState.logs.length > 0) {
      // Convert server logs to client logs if needed
      // For now, let's assume server sends compatible logs or we just use local state for now
    }

    const socket = socketService.socket;
    if (socket) {
      // Check if I am ready in the current room state
      const myPlayer = roomState?.players?.find((p: any) => p.id === socket.id);
      if (myPlayer) {
        setIsReady(myPlayer.isReady);
      }

      socket.on("round_complete", ({ room, story }: { room: any, story: string }) => {
        // Add story log
        const newLog: 游戏日志 = {
          id: Date.now().toString(),
          发送者: '系统', // Or 'DM'
          内容: story,
          类型: '旁白',
          时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        set游戏数据(prev => ({
          ...prev,
          日志列表: [...prev.日志列表, newLog]
        }));
        
        setIsReady(false); // Reset ready state for next round
      });
      
      socket.on("room_updated", (updatedRoom) => {
         const me = updatedRoom.players.find((p: any) => p.id === socket.id);
         if (me) setIsReady(me.isReady);
      });

      socket.on("new_log", (log: 游戏日志) => {
        set游戏数据(prev => ({
          ...prev,
          日志列表: [...prev.日志列表, log]
        }));
      });
    }

    return () => {
      socket?.off("round_complete");
      socket?.off("room_updated");
      socket?.off("new_log");
    };
  }, [roomState]);

  const handleSendMessage = (text: string) => {
    if (isReady) return;

    // Optimistic update
    const newLog: 游戏日志 = {
      id: Date.now().toString(),
      发送者: '玩家',
      内容: text,
      类型: '对话',
      时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set游戏数据(prev => ({
      ...prev,
      日志列表: [...prev.日志列表, newLog]
    }));

    // Send to server
    if (roomState?.id) {
      socketService.submitAction(roomState.id, text);
      setIsReady(true);
    }
  };

  const handleSendChat = (text: string) => {
    // Optimistic update for chat
    const newLog: 游戏日志 = {
      id: Date.now().toString(),
      发送者: '玩家', // Or current player name if available, but '玩家' is consistent with local view
      内容: text,
      类型: 'OOC',
      时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set游戏数据(prev => ({
      ...prev,
      日志列表: [...prev.日志列表, newLog]
    }));

    if (roomState?.id) {
      socketService.sendChat(roomState.id, text);
    }
  };

  // Filter logs
  const actionLogs = 游戏数据.日志列表.filter(log => log.类型 !== 'OOC');
  const chatLogs = 游戏数据.日志列表.filter(log => log.类型 === 'OOC');

  return (
    <div className="w-full h-full flex flex-col relative bg-zinc-950">
      <Header 世界信息={游戏数据.世界} />
      
      <main className="flex-1 flex items-center justify-center overflow-hidden relative p-4">
        {/* Main Interface Wrapper */}
        <div className="w-full h-full flex border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl bg-black">
          
          {/* Left Column: Character Info */}
          <div className="w-[280px] flex-shrink-0 z-20 bg-black relative">
            <CharacterPanel 角色={游戏数据.玩家} />
          </div>

          {/* Center Column: Game Interaction */}
          <div className="flex-1 flex flex-col min-w-0 z-10 relative bg-zinc-900/50 p-3">
              <div className="flex-1 rounded-2xl overflow-hidden border border-zinc-800/50 shadow-inner relative flex flex-col">
                <GameLogPanel 
                  日志列表={actionLogs} 
                  onSendMessage={handleSendMessage} 
                  isReady={isReady}
                />
              </div>
          </div>

          {/* Right Column: Chat & Menu */}
          <div className="w-[320px] flex-shrink-0 z-20 bg-black relative">
            <RightPanel 
              logs={chatLogs} 
              onSendChat={handleSendChat} 
              onOpenSettings={() => setIsSettingsOpen(true)}
              players={roomState?.players || []}
            />
          </div>

        </div>
      </main>

      <Footer />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onExitToHome={onExit}
      />
    </div>
  );
}
