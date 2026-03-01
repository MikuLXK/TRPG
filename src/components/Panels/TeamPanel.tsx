import React from 'react';
import { motion } from 'motion/react';
import { User, Heart, Zap, ChevronLeft } from 'lucide-react';
import { 角色信息 } from '../../types/GameData';

interface TeamPanelProps {
  players: any[]; // Using 'any' for now as we might need to extend the player type with character stats
  onBack?: () => void;
}

export default function TeamPanel({ players, onBack }: TeamPanelProps) {
  // Mock character data for players who don't have it yet
  // In a real app, this would come from the room state
  const getMockCharacter = (playerId: string, index: number): 角色信息 => {
    const roles = ['战士', '法师', '游侠', '牧师'];
    return {
      姓名: `队友 ${index + 1}`,
      职业: roles[index % roles.length],
      等级: 1,
      生命值: 80 + (index * 5),
      最大生命值: 100,
      法力值: 60 - (index * 5),
      最大法力值: 100,
      属性: { 力量: 10, 敏捷: 12, 智力: 14, 体质: 12, 魅力: 10, 感知: 10 },
      状态: ['正常'],
      背景故事: ''
    };
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <User size={14} /> 队伍成员 ({players.length})
        </h3>
      </div>

      <div className="space-y-3">
        {players.map((player, index) => {
          const char = player.character || getMockCharacter(player.id, index);
          
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-700">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-200 truncate text-sm">{player.name}</div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                      Lv.{char.等级} {char.职业}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {/* HP Bar */}
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(char.生命值 / char.最大生命值) * 100}%` }}
                      ></div>
                    </div>
                    {/* MP Bar */}
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${(char.法力值 / char.最大法力值) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-950/50 px-2 py-1 rounded">
                  <Heart size={12} className="text-emerald-500" />
                  <span>HP: {char.生命值}/{char.最大生命值}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-950/50 px-2 py-1 rounded">
                  <Zap size={12} className="text-indigo-500" />
                  <span>MP: {char.法力值}/{char.最大法力值}</span>
                </div>
              </div>
              
              {/* Status Tags */}
              {char.状态 && char.状态.length > 0 && (
                 <div className="flex flex-wrap gap-1 mt-2">
                   {char.状态.map((status: string, i: number) => (
                     <span key={i} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                       {status}
                     </span>
                   ))}
                 </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
