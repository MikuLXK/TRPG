import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Copy, Check, Play, LogOut, User, Server, ChevronDown } from 'lucide-react';
import { socketService } from '../../services/socketService';
import ChatPanel from '../Panels/ChatPanel';
import { 游戏日志 } from '../../types/GameData';

interface WaitingRoomProps {
  roomState: any;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

// Mock API list
const AVAILABLE_APIS = [
  { id: 'openai', name: 'OpenAI GPT-4' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'claude', name: 'Anthropic Claude 3' },
  { id: 'local', name: '本地模型' },
];

export default function WaitingRoom({ roomState, onStartGame, onLeaveRoom }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [chatLogs, setChatLogs] = useState<游戏日志[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const players = roomState.players || [];
  const selfId = socketService.socket?.id;

  useEffect(() => {
    const socket = socketService.socket;
    if (socket) {
      setIsHost(roomState.hostId === socket.id);

      const onNewLog = (log: 游戏日志) => {
        if (log.类型 === 'OOC') {
          setChatLogs(prev => [...prev, log]);
        }
      };

      socket.on("new_log", onNewLog);
      
      return () => {
        socket.off("new_log", onNewLog);
      };
    }
  }, [roomState]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomState.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    socketService.startGame(roomState.id);
  };

  const handleSendChat = (text: string) => {
    socketService.sendChat(roomState.id, text);
  };

  const handleSelectApi = (apiId: string) => {
    socketService.updatePlayerApi(roomState.id, apiId);
    setActiveDropdown(null);
  };

  const renderApiSelector = (player: any) => {
    if (player.id !== selfId) {
      return (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Server size={14} />
          <span>{player.api ? AVAILABLE_APIS.find(a => a.id === player.api)?.name : '未选择'}</span>
        </div>
      );
    }

    return (
      <div className="relative">
        <button 
          onClick={() => setActiveDropdown(activeDropdown === player.id ? null : player.id)}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors p-1 rounded bg-zinc-800/50 hover:bg-zinc-700/50"
        >
          <Server size={14} />
          <span>{player.api ? AVAILABLE_APIS.find(a => a.id === player.api)?.name : '选择API'}</span>
          <ChevronDown size={14} className={`transition-transform ${activeDropdown === player.id ? 'rotate-180' : ''}`} />
        </button>
        {activeDropdown === player.id && (
          <div className="absolute bottom-full mb-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-20">
            {AVAILABLE_APIS.map(api => (
              <button 
                key={api.id} 
                onClick={() => handleSelectApi(api.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
              >
                {api.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-200 font-sans">
      <div className="w-full max-w-6xl bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden flex flex-col h-[80vh]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
        
        <header className="flex justify-between items-start mb-8 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-amber-500 mb-2 font-serif tracking-wider">等待大厅</h1>
            <div className="flex items-center gap-3 text-zinc-400 text-sm">
              <span>房间号:</span>
              <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded border border-zinc-800 font-mono text-amber-200">
                {roomState.id}
                <button onClick={copyRoomId} className="hover:text-white transition-colors">
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          <button 
            onClick={onLeaveRoom}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 min-h-0">
          <section className="md:col-span-2 flex flex-col space-y-6 overflow-hidden">
            <div className="flex items-center justify-between text-sm font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2 flex-shrink-0">
              <span>玩家列表 ({players.length}/4)</span>
              <Users size={16} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {players.map((player: any) => (
                <motion.div 
                  key={player.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-4 p-3 rounded-xl border ${player.id === selfId ? 'bg-amber-900/10 border-amber-500/30' : 'bg-zinc-950 border-zinc-800'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${player.id === roomState.hostId ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                    <User size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-zinc-200 flex items-center gap-2">
                      {player.name}
                      {player.id === selfId && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded">我</span>}
                      {player.id === roomState.hostId && <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-300 rounded">房主</span>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {renderApiSelector(player)}
                    </div>
                  </div>
                  {/* Placeholder for future status like 'Ready' */}
                </motion.div>
              ))}
              
              {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-4 p-3 rounded-xl border border-zinc-800/50 border-dashed opacity-50">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                    <User size={20} />
                  </div>
                  <div className="text-sm text-zinc-600">等待玩家加入...</div>
                </div>
              ))}
            </div>

            {isHost ? (
              <button 
                onClick={handleStartGame}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded-xl font-bold text-lg shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={players.some((p:any) => !p.api)} // Disable if any player hasn't chosen an API
              >
                <Play size={20} /> 开始游戏
              </button>
            ) : (
              <div className="w-full py-4 bg-zinc-800 text-zinc-400 rounded-xl font-bold text-center border border-zinc-700 flex-shrink-0">
                等待房主开始...
              </div>
            )}
          </section>

          <aside className="md:col-span-1 flex flex-col h-full border border-zinc-800 rounded-xl overflow-hidden bg-black">
             <ChatPanel logs={chatLogs} onSendChat={handleSendChat} />
          </aside>
        </main>
      </div>
    </div>
  );
}
