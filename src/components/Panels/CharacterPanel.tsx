import React from 'react';
import { 角色信息 } from '../../types/gameData';
import { Shield, Zap, Heart, User, Activity } from 'lucide-react';

interface CharacterPanelProps {
  角色: 角色信息;
}

export default function CharacterPanel({ 角色 }: CharacterPanelProps) {
  return (
    <div className="h-full flex flex-col bg-transparent border-r border-zinc-800 p-4 overflow-y-auto no-scrollbar relative">
      {/* Decorative Corner */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-500/30 rounded-tl-2xl pointer-events-none"></div>

      <div className="mb-6 text-center relative">
        <div className="w-24 h-24 mx-auto bg-zinc-800 rounded-full border-2 border-amber-500/50 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
           <User size={40} className="text-zinc-400" />
        </div>
        <h2 className="text-2xl font-bold text-amber-400 font-serif tracking-wider">{角色.姓名}</h2>
        <p className="text-cyan-600 text-sm font-bold uppercase tracking-widest">{角色.职业} LV.{角色.等级}</p>
      </div>

      {/* Stats Bars */}
      <div className="space-y-4 mb-8">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400 flex items-center gap-1"><Heart size={12}/> HP</span>
            <span className="text-zinc-400">{角色.生命值}/{角色.最大生命值}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-900 to-red-500 rounded-full transition-all duration-500"
              style={{ width: `${(角色.生命值 / 角色.最大生命值) * 100}%` }}
            ></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-blue-400 flex items-center gap-1"><Zap size={12}/> MP</span>
            <span className="text-zinc-400">{角色.法力值}/{角色.最大法力值}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-900 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(角色.法力值 / 角色.最大法力值) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Attributes Grid */}
      <div className="mb-8">
        <h3 className="text-zinc-500 text-xs font-bold mb-3 uppercase tracking-widest border-b border-zinc-800 pb-1">基础属性</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(角色.属性).map(([key, value]) => (
            <div key={key} className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800 flex justify-between items-center hover:border-amber-500/30 transition-colors">
              <span className="text-zinc-400 text-sm">{key}</span>
              <span className="text-amber-500 font-mono font-bold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Effects */}
      <div className="mb-8">
        <h3 className="text-zinc-500 text-xs font-bold mb-3 uppercase tracking-widest border-b border-zinc-800 pb-1">当前状态</h3>
        <div className="flex flex-wrap gap-2">
          {角色.状态.map((status, index) => (
            <span key={index} className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-cyan-300 border border-cyan-900/50 flex items-center gap-1">
              <Activity size={10} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Background Story */}
      <div className="flex-1">
        <h3 className="text-zinc-500 text-xs font-bold mb-3 uppercase tracking-widest border-b border-zinc-800 pb-1">背景档案</h3>
        <p className="text-zinc-400 text-sm leading-relaxed italic bg-zinc-950/30 p-3 rounded-xl border border-zinc-800/50">
          "{角色.背景故事}"
        </p>
      </div>
    </div>
  );
}

