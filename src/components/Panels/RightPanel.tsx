import { useState } from 'react';
import { MessageSquare, Menu as MenuIcon } from 'lucide-react';
import ChatPanel from './ChatPanel';
import ActionMenuPanel from './ActionMenuPanel';
import { 游戏日志, 游戏状态, 记忆压缩任务, 记忆系统结构 } from '../../types/gameData';

interface RightPanelProps {
  logs: 游戏日志[];
  onSendChat: (text: string) => void;
  onOpenSettings: () => void;
  players?: any[];
  roomState?: any;
  gameData: 游戏状态;
  memorySystem: 记忆系统结构;
  memoryPendingTask: 记忆压缩任务 | null;
  memorySummaryStage: 'idle' | 'remind' | 'processing' | 'review';
  onOpenMemorySummary: () => void;
  selfPlayerId?: string;
  onRequestReroll: (prompt: string) => Promise<{ ok: boolean; error?: string }>;
  onRespondReroll: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelReroll: () => void;
  onSaveToSlot: (slotIndex: number, note?: string) => Promise<{ ok: boolean; error?: string }>;
  onRequestSaveSlots: () => void;
  onRequestLoadVote: (slotType: 'manual' | 'auto', slotIndex: number) => Promise<{ ok: boolean; error?: string }>;
  onRespondLoadVote: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelLoadVote: () => void;
}

export default function RightPanel({
  logs,
  onSendChat,
  onOpenSettings,
  players = [],
  roomState,
  gameData,
  memorySystem,
  memoryPendingTask,
  memorySummaryStage,
  onOpenMemorySummary,
  selfPlayerId = '',
  onRequestReroll,
  onRespondReroll,
  onCancelReroll,
  onSaveToSlot,
  onRequestSaveSlots,
  onRequestLoadVote,
  onRespondLoadVote,
  onCancelLoadVote
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'menu'>('menu');

  return (
    <div className="h-full flex flex-col bg-black border-l border-zinc-800">
      {/* Tab Header */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors relative
            ${activeTab === 'menu' ? 'text-amber-500 bg-zinc-900/50' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/30'}`}
        >
          <MenuIcon size={14} />
          菜单
          {activeTab === 'menu' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500"></div>}
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
        ) : (
          <ActionMenuPanel
            onOpenSettings={onOpenSettings}
            players={players}
            roomState={roomState}
            gameData={gameData}
            memorySystem={memorySystem}
            memoryPendingTask={memoryPendingTask}
            memorySummaryStage={memorySummaryStage}
            onOpenMemorySummary={onOpenMemorySummary}
            selfPlayerId={selfPlayerId}
            onRequestReroll={onRequestReroll}
            onRespondReroll={onRespondReroll}
            onCancelReroll={onCancelReroll}
            onSaveToSlot={onSaveToSlot}
            onRequestSaveSlots={onRequestSaveSlots}
            onRequestLoadVote={onRequestLoadVote}
            onRespondLoadVote={onRespondLoadVote}
            onCancelLoadVote={onCancelLoadVote}
          />
        )}
      </div>
    </div>
  );
}

