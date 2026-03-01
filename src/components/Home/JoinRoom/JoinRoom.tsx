import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, RefreshCw, Users, Lock, Check, Info } from 'lucide-react';
import { socketService } from '../../../services/socketService';

interface JoinRoomProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  onBack: () => void;
  onJoinRoom: (roomId: string) => void;
}

export default function JoinRoom({ playerName, setPlayerName, onBack, onJoinRoom }: JoinRoomProps) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomList, setRoomList] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshRooms = () => {
    setIsRefreshing(true);
    socketService.getRooms();
  };

  useEffect(() => {
    const onRoomsList = (rooms: any[]) => {
      setRoomList(rooms);
      setIsRefreshing(false);
    };
    
    const onRoomsListUpdated = () => {
      socketService.getRooms();
    };

    socketService.socket?.on("rooms_list", onRoomsList);
    socketService.socket?.on("rooms_list_updated", onRoomsListUpdated);

    // Initial fetch
    refreshRooms();

    return () => {
      socketService.socket?.off("rooms_list", onRoomsList);
      socketService.socket?.off("rooms_list_updated", onRoomsListUpdated);
    };
  }, []);

  const handleJoin = () => {
    if (joinRoomId) {
      onJoinRoom(joinRoomId);
    }
  };

  return (
    <motion.div
      key="join"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-zinc-100">加入房间</h2>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">快速加入</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-emerald-500 outline-none text-sm"
                  placeholder="您的昵称"
                />
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-emerald-500 outline-none text-sm font-mono uppercase"
                  placeholder="房间号 (如: X7J9K2)"
                  maxLength={6}
                />
              </div>
            </div>
            <button
              onClick={handleJoin}
              className="h-[38px] px-6 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-lg font-bold transition-colors shadow-lg shadow-emerald-900/20"
            >
              加入
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                <Users size={16} /> 公开房间列表
              </h3>
              <button
                onClick={refreshRooms}
                className={`p-2 text-zinc-500 hover:text-zinc-300 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {roomList.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {roomList.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => setJoinRoomId(room.id)}
                    className={`bg-zinc-950/50 border rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all ${joinRoomId === room.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900'}`}
                  >
                    <div>
                      <div className="font-bold text-zinc-200 flex items-center gap-2">
                        {room.name}
                        {room.locked && <Lock size={14} className="text-amber-600" />}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{room.script}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-zinc-500 font-mono">
                        {room.players}/{room.maxPlayers}
                      </div>
                      {joinRoomId === room.id && <Check size={16} className="text-amber-500" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-[200px] flex flex-col items-center justify-center text-zinc-600 bg-zinc-950/30 rounded-xl border border-zinc-800/50 border-dashed">
                <Info size={32} className="mb-2 opacity-50" />
                <p className="text-sm">暂无公开房间</p>
                <p className="text-xs opacity-50">请输入房间号直接加入</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
