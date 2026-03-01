import React from 'react';
import { Scroll, Users, Settings, Backpack, ClipboardList, UserRound } from 'lucide-react';

interface MenuOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const menuOptions: MenuOption[] = [
  { id: '1', label: '物品栏', icon: <Backpack size={20} />, description: '查看和使用持有物品' },
  { id: '2', label: '技能书', icon: <Scroll size={20} />, description: '查看已习得的技能与魔法' },
  { id: '3', label: '任务记录', icon: <ClipboardList size={20} />, description: '查看当前任务与进度' },
  { id: '4', label: '人物志', icon: <UserRound size={20} />, description: '查看已结识的人物信息' },
  { id: '5', label: '队伍', icon: <Users size={20} />, description: '管理队伍成员与阵型' },
  { id: '6', label: '系统设置', icon: <Settings size={20} />, description: '调整游戏显示与音效' },
];

interface ActionMenuPanelProps {
  onOpenSettings: () => void;
  onOpenTeam: () => void;
}

export default function ActionMenuPanel({ onOpenSettings, onOpenTeam }: ActionMenuPanelProps) {
  return (
    <div className="h-full bg-transparent border-l border-zinc-800 p-4 flex flex-col overflow-y-auto no-scrollbar relative">
       {/* Decorative Corner */}
       <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-2xl pointer-events-none"></div>

      <h2 className="text-xl font-bold text-zinc-300 mb-6 font-serif tracking-wider border-b border-zinc-800 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-8 bg-amber-500 rounded-sm"></span>
          功能菜单
        </div>
      </h2>

      <div className="grid grid-cols-1 gap-4">
        {menuOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              if (option.id === '6') onOpenSettings();
              if (option.id === '5') onOpenTeam();
            }}
            className="group relative w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-left transition-all duration-300 hover:border-amber-500/50 hover:bg-zinc-900 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/5 group-hover:via-amber-500/5 transition-all duration-500"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-zinc-900 rounded-lg text-zinc-400 group-hover:text-amber-500 group-hover:bg-zinc-950 transition-colors border border-zinc-800 group-hover:border-amber-500/30">
                {option.icon}
              </div>
              <div>
                <div className="font-bold text-zinc-200 group-hover:text-amber-400 text-lg">{option.label}</div>
                <div className="text-xs text-zinc-500 group-hover:text-zinc-400 mt-1">{option.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
