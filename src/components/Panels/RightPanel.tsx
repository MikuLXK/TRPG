import { useState } from 'react';
import { MessageSquare, Menu as MenuIcon } from 'lucide-react';
import ChatPanel from './ChatPanel';
import ActionMenuPanel from './ActionMenuPanel';
import TeamPanel from './TeamPanel';
import MemoryReviewPanel from './MemoryReviewPanel';
import { 游戏日志, 记忆压缩任务, 记忆系统结构 } from '../../types/gameData';

interface RightPanelProps {
  logs: 游戏日志[];
  onSendChat: (text: string) => void;
  onOpenSettings: () => void;
  players?: any[]; // Optional for now, but needed for TeamPanel
  memorySystem: 记忆系统结构;
  memoryPendingTask: 记忆压缩任务 | null;
  memorySummaryStage: 'idle' | 'remind' | 'processing' | 'review';
  onOpenMemorySummary: () => void;
}

export default function RightPanel({
  logs,
  onSendChat,
  onOpenSettings,
  players = [],
  memorySystem,
  memoryPendingTask,
  memorySummaryStage,
  onOpenMemorySummary
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'menu' | 'team' | 'memory'>('menu');

  const handleOpenTeam = () => {
    setActiveTab('team');
  };

  const handleOpenMemory = () => {
    setActiveTab('memory');
  };

  return (
    <div className="h-full flex flex-col bg-black border-l border-zinc-800">
      {/* Tab Header */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors relative
            ${activeTab === 'menu' || activeTab === 'team' || activeTab === 'memory' ? 'text-amber-500 bg-zinc-900/50' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/30'}`}
        >
          <MenuIcon size={14} />
          菜单
          {(activeTab === 'menu' || activeTab === 'team' || activeTab === 'memory') && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500"></div>}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors relative
            ${activeTab === 'chat' ? 'text-amber-500 bg-zinc-900/50' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/30'}`}
        >
          <MessageSquare size={14} />
          闲聊
          {activeTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500"></div>}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' ? (
          <ChatPanel logs={logs} onSendChat={onSendChat} />
        ) : activeTab === 'memory' ? (
          <MemoryReviewPanel
            memorySystem={memorySystem}
            pendingTask={memoryPendingTask}
            summaryStage={memorySummaryStage}
            onOpenSummary={onOpenMemorySummary}
          />
        ) : activeTab === 'team' ? (
          <TeamPanel players={players} onBack={() => setActiveTab('menu')} />
        ) : (
          <ActionMenuPanel onOpenSettings={onOpenSettings} onOpenTeam={handleOpenTeam} onOpenMemory={handleOpenMemory} />
        )}
      </div>
    </div>
  );
}

