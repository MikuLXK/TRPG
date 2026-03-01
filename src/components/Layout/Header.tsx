import React from 'react';
import { 游戏世界观 } from '../../types/GameData';
import { Clock, MapPin, BookOpen, Hourglass } from 'lucide-react';

interface HeaderProps {
  世界信息: 游戏世界观;
}

export default function Header({ 世界信息 }: HeaderProps) {
  return (
    <header className="w-full h-20 bg-zinc-950 border-b-2 border-amber-500/50 flex items-center justify-between px-6 shadow-lg z-30 relative overflow-hidden">
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900 via-zinc-900 to-zinc-950"></div>
      
      {/* Left Group */}
      <div className="flex-1 flex justify-start items-center space-x-4 z-10">
        <div className="flex items-center space-x-2 text-zinc-300 px-4 py-2 border border-zinc-800 rounded-lg bg-zinc-900/50 hover:border-amber-500/30 transition-colors">
          <Clock size={16} className="text-amber-600" />
          <span className="font-mono text-sm">{世界信息.当前时间}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-zinc-300 px-4 py-2 border border-zinc-800 rounded-lg bg-zinc-900/50 hover:border-amber-500/30 transition-colors">
          <MapPin size={16} className="text-amber-600" />
          <span className="font-bold text-sm">{世界信息.当前地点}</span>
        </div>
      </div>

      {/* Center Title - Script Name */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="px-8 py-3 border-2 border-amber-500/50 bg-zinc-900/90 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.1)] flex items-center gap-3 min-w-[200px] justify-center backdrop-blur-md">
           <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
           <h1 className="text-xl font-bold text-amber-500 tracking-[0.2em] font-serif whitespace-nowrap">
            {世界信息.名称}
          </h1>
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
        </div>
      </div>

      {/* Right Group */}
      <div className="flex-1 flex justify-end items-center space-x-4 z-10">
        <div className="flex items-center space-x-2 text-zinc-300 px-4 py-2 border border-zinc-800 rounded-lg bg-zinc-900/50 hover:border-amber-500/30 transition-colors">
          <BookOpen size={16} className="text-amber-600" />
          <span className="italic text-sm">{世界信息.当前章节}</span>
        </div>

        <div className="flex items-center space-x-2 text-zinc-300 px-4 py-2 border border-zinc-800 rounded-lg bg-zinc-900/50 hover:border-amber-500/30 transition-colors">
          <Hourglass size={16} className="text-amber-600" />
          <span className="font-mono text-sm">Turn {世界信息.当前回合}</span>
        </div>
      </div>
    </header>
  );
}
