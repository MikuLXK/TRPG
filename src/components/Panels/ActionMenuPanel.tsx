import { useMemo, useState } from 'react';
import type { 游戏状态, 记忆压缩任务, 记忆系统结构 } from '../../types/gameData';
import AgreementsView from './actionMenu/AgreementsView';
import InventoryView from './actionMenu/InventoryView';
import MemoryView from './actionMenu/MemoryView';
import ModalShell from './actionMenu/ModalShell';
import SaveLoadView from './actionMenu/SaveLoadView';
import VoteCenterView from './actionMenu/VoteCenterView';
import SkillsView from './actionMenu/SkillsView';
import SocialView from './actionMenu/SocialView';
import StoryView from './actionMenu/StoryView';
import TasksView from './actionMenu/TasksView';
import TeamView from './actionMenu/TeamView';
import { resolveCurrentRole } from './actionMenu/resolveCurrentRole';
import { ACTION_MENU_MODAL_TITLE, ACTION_MENU_OPTIONS, type ActionMenuModal } from './actionMenu/types';

interface ActionMenuPanelProps {
  onOpenSettings: () => void;
  players: any[];
  roomState?: any;
  gameData: 游戏状态;
  memorySystem: 记忆系统结构;
  memoryPendingTask: 记忆压缩任务 | null;
  memorySummaryStage: 'idle' | 'remind' | 'processing' | 'review';
  onOpenMemorySummary: () => void;
  selfPlayerId: string;
  onRequestReroll: (prompt: string) => Promise<{ ok: boolean; error?: string }>;
  onRespondReroll: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelReroll: () => void;
  onSaveToSlot: (slotIndex: number, note?: string) => Promise<{ ok: boolean; error?: string }>;
  onRequestSaveSlots: () => void;
  onRequestLoadVote: (slotType: 'manual' | 'auto', slotIndex: number) => Promise<{ ok: boolean; error?: string }>;
  onRespondLoadVote: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelLoadVote: () => void;
}

export default function ActionMenuPanel({
  onOpenSettings,
  players,
  roomState,
  gameData,
  memorySystem,
  memoryPendingTask,
  memorySummaryStage,
  onOpenMemorySummary,
  selfPlayerId,
  onRequestReroll,
  onRespondReroll,
  onCancelReroll,
  onSaveToSlot,
  onRequestSaveSlots,
  onRequestLoadVote,
  onRespondLoadVote,
  onCancelLoadVote
}: ActionMenuPanelProps) {
  const [openModal, setOpenModal] = useState<ActionMenuModal | null>(null);
  const currentRole = useMemo(() => resolveCurrentRole(gameData), [gameData]);

  const renderModalContent = () => {
    if (!openModal) return null;
    if (openModal === 'inventory') return <InventoryView currentRole={currentRole} />;
    if (openModal === 'skills') return <SkillsView currentRole={currentRole} />;
    if (openModal === 'tasks') return <TasksView gameData={gameData} />;
    if (openModal === 'social') return <SocialView gameData={gameData} />;
    if (openModal === 'team') {
      return <TeamView roomPlayers={players} gameData={gameData} selfPlayerId={selfPlayerId} />;
    }
    if (openModal === 'story') return <StoryView gameData={gameData} />;
    if (openModal === 'agreements') return <AgreementsView gameData={gameData} />;
    if (openModal === 'memory') {
      return (
        <MemoryView
          memorySystem={memorySystem}
          memoryPendingTask={memoryPendingTask}
          memorySummaryStage={memorySummaryStage}
          onOpenMemorySummary={onOpenMemorySummary}
        />
      );
    }
    if (openModal === 'saveLoad') {
      return (
        <SaveLoadView
          saveSlots={roomState?.saveSlots || null}
          loadVote={roomState?.loadVote || null}
          onSaveToSlot={onSaveToSlot}
          onRequestSaveSlots={onRequestSaveSlots}
          onRequestLoadVote={onRequestLoadVote}
        />
      );
    }
    return (
      <VoteCenterView
        players={players}
        rerollVote={roomState?.rerollVote || null}
        loadVote={roomState?.loadVote || null}
        selfPlayerId={selfPlayerId}
        onRequestReroll={onRequestReroll}
        onRespondReroll={onRespondReroll}
        onCancelReroll={onCancelReroll}
        onRespondLoadVote={onRespondLoadVote}
        onCancelLoadVote={onCancelLoadVote}
      />
    );
  };

  return (
    <div className="h-full bg-transparent border-l border-zinc-800 p-4 flex flex-col overflow-y-auto no-scrollbar relative">
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-2xl pointer-events-none"></div>

      <div className="text-xl font-bold text-zinc-300 mb-4 font-serif tracking-wider border-b border-zinc-800 pb-3 flex items-center gap-2">
        <span className="w-2 h-8 bg-amber-500 rounded-sm"></span>
        功能菜单
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ACTION_MENU_OPTIONS.map((option) => (
          <button
            key={String(option.id)}
            onClick={() => {
              if (option.id === 'settings') {
                onOpenSettings();
                return;
              }
              setOpenModal(option.id);
            }}
            className="group relative w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-left transition-all duration-300 hover:border-amber-500/50 hover:bg-zinc-900 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/5 group-hover:via-amber-500/5 transition-all duration-500"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-zinc-900 rounded-lg text-zinc-400 group-hover:text-amber-500 group-hover:bg-zinc-950 transition-colors border border-zinc-800 group-hover:border-amber-500/30">
                <option.icon size={20} />
              </div>
              <div>
                <div className="font-bold text-zinc-200 group-hover:text-amber-400 text-lg">{option.label}</div>
                <div className="text-xs text-zinc-500 group-hover:text-zinc-400 mt-1">{option.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {openModal && (
        <ModalShell title={ACTION_MENU_MODAL_TITLE[openModal]} onClose={() => setOpenModal(null)}>
          {renderModalContent()}
        </ModalShell>
      )}
    </div>
  );
}
