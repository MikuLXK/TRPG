import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scroll,
  Users,
  Settings,
  Backpack,
  ClipboardList,
  UserRound,
  Brain,
  Sparkles,
  RotateCcw,
  ChevronLeft,
  BookOpen,
  Handshake
} from 'lucide-react';
import TeamPanel from './TeamPanel';
import MemoryReviewPanel from './MemoryReviewPanel';
import type { 游戏状态, 记忆压缩任务, 记忆系统结构, 玩家角色 } from '../../types/gameData';

type MenuPage =
  | 'root'
  | 'inventory'
  | 'skills'
  | 'tasks'
  | 'social'
  | 'team'
  | 'story'
  | 'agreements'
  | 'memory'
  | 'thinking'
  | 'reroll';

interface MenuOption {
  id: MenuPage | 'settings';
  label: string;
  icon: React.ReactNode;
  description: string;
}

const menuOptions: MenuOption[] = [
  { id: 'inventory', label: '物品栏', icon: <Backpack size={20} />, description: '查看当前主控角色物品列表' },
  { id: 'skills', label: '技能书', icon: <Scroll size={20} />, description: '查看当前主控角色技能列表' },
  { id: 'tasks', label: '任务记录', icon: <ClipboardList size={20} />, description: '查看任务结构中的任务条目' },
  { id: 'social', label: '人物志', icon: <UserRound size={20} />, description: '查看社交关系与记忆' },
  { id: 'team', label: '队伍', icon: <Users size={20} />, description: '查看房间玩家与队伍状态' },
  { id: 'story', label: '剧情追踪', icon: <BookOpen size={20} />, description: '查看章节、线索与事件状态' },
  { id: 'agreements', label: '约定列表', icon: <Handshake size={20} />, description: '查看约定结构条目' },
  { id: 'memory', label: '记忆回顾', icon: <Brain size={20} />, description: '查看即时/短期/中期/长期记忆' },
  { id: 'thinking', label: 'AI思考', icon: <Sparkles size={20} />, description: '查看 AI thinking 历史记录' },
  { id: 'reroll', label: '重Roll', icon: <RotateCcw size={20} />, description: '发起并确认重Roll投票' },
  { id: 'settings', label: '系统设置', icon: <Settings size={20} />, description: '调整显示、提示词和连接配置' },
];

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
}

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
    <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{value || '—'}</div>
  </div>
);

const resolveCurrentRole = (gameData: 游戏状态): 玩家角色 | null => {
  const currentId = gameData.角色.当前主控角色ID;
  return gameData.角色.玩家角色列表.find((role) => role.玩家ID === currentId || role.角色ID === currentId) || gameData.角色.玩家角色列表[0] || null;
};

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
  onCancelReroll
}: ActionMenuPanelProps) {
  const [page, setPage] = useState<MenuPage>('root');
  const [rerollPrompt, setRerollPrompt] = useState('');
  const [rerollMessage, setRerollMessage] = useState('');
  const [rerollSubmitting, setRerollSubmitting] = useState(false);

  const currentRole = useMemo(() => resolveCurrentRole(gameData), [gameData]);
  const rerollVote = roomState?.rerollVote || null;
  const rerollVoted = Boolean(
    rerollVote && (rerollVote.approvals?.includes(selfPlayerId) || rerollVote.rejections?.includes(selfPlayerId))
  );
  const isRerollRequester = Boolean(rerollVote && rerollVote.requesterId === selfPlayerId);

  const renderRoot = () => (
    <div className="grid grid-cols-1 gap-4">
      {menuOptions.map((option) => (
        <button
          key={String(option.id)}
          onClick={() => {
            if (option.id === 'settings') {
              onOpenSettings();
              return;
            }
            setPage(option.id);
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
  );

  const renderInventory = () => {
    const list = currentRole?.物品列表 || [];
    return (
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-sm text-zinc-500">当前主控角色暂无物品。</div>
        ) : (
          list.map((item, idx) => (
            <DataRow
              key={`${item.物品ID}-${idx}`}
              label={`${item.名称} x${item.数量}`}
              value={`${item.类型} / ${item.品质}\n${item.描述 || '无描述'}`}
            />
          ))
        )}
      </div>
    );
  };

  const renderSkills = () => {
    const list = currentRole?.技能列表 || [];
    return (
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-sm text-zinc-500">当前主控角色暂无技能。</div>
        ) : (
          list.map((skill, idx) => (
            <DataRow
              key={`${skill.技能ID}-${idx}`}
              label={skill.名称}
              value={`${skill.分类} / ${skill.伤害类型}\n${skill.描述 || '无描述'}`}
            />
          ))
        )}
      </div>
    );
  };

  const renderTasks = () => (
    <div className="space-y-3">
      {gameData.任务列表.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无任务。</div>
      ) : (
        gameData.任务列表.map((task) => (
          <DataRow
            key={task.任务ID}
            label={`${task.标题}（${task.当前状态}）`}
            value={`${task.描述}\n发布：${task.发布者} @ ${task.发布地点}`}
          />
        ))
      )}
    </div>
  );

  const renderSocial = () => (
    <div className="space-y-3">
      {gameData.社交.关系列表.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无社交关系记录。</div>
      ) : (
        gameData.社交.关系列表.map((item) => (
          <DataRow
            key={item.关系ID}
            label={`${item.对象名}（${item.关系状态}）`}
            value={`好感度 ${item.好感度} / 信任度 ${item.信任度}\n${item.简介 || '无简介'}`}
          />
        ))
      )}
    </div>
  );

  const renderStory = () => (
    <div className="space-y-3">
      <DataRow label="当前章节" value={`${gameData.剧情.当前章节.标题 || '未命名章节'}\n阶段：${gameData.剧情.当前章节.当前阶段 || '未设置'}`} />
      <DataRow label="主线目标" value={gameData.剧情.主线目标.最终目标 || '未设置'} />
      <DataRow label="当前回合总述" value={gameData.剧情.当前回合总述 || '暂无'} />
      <DataRow label="线索数量" value={`线索 ${gameData.剧情.线索列表.length} 条\n待触发事件 ${gameData.剧情.待触发事件.length} 条`} />
    </div>
  );

  const renderAgreements = () => (
    <div className="space-y-3">
      {gameData.约定列表.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无约定。</div>
      ) : (
        gameData.约定列表.map((item) => (
          <DataRow
            key={item.约定ID}
            label={`${item.标题}（${item.当前状态}）`}
            value={`${item.约定内容}\n对象：${item.对象名} / 地点：${item.约定地点}`}
          />
        ))
      )}
    </div>
  );

  const renderThinking = () => {
    const list = Array.isArray(roomState?.aiThinkingHistory) ? [...roomState.aiThinkingHistory].reverse() : [];
    return (
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-sm text-zinc-500">暂无 AI 思考历史。</div>
        ) : (
          list.map((item: any, idx: number) => (
            <DataRow
              key={`${item.round}-${idx}-${item.time || ''}`}
              label={`第${item.round || '?'}回合 · ${item.source === 'reroll' ? '重Roll' : '主剧情'} · ${item.time || ''}`}
              value={String(item.thinking || '').trim() || '（空）'}
            />
          ))
        )}
      </div>
    );
  };

  const renderReroll = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-400 leading-relaxed">
        重Roll会对“上一回合”使用同一组玩家行动重新生成剧情文本。需要全体在线玩家确认，不会再次执行状态结算。
      </div>

      {!rerollVote ? (
        <div className="space-y-3">
          <label className="text-sm text-zinc-400">重Roll提示词（可选）</label>
          <textarea
            value={rerollPrompt}
            onChange={(e) => setRerollPrompt(e.target.value)}
            className="w-full h-28 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-amber-500"
            placeholder="例如：增强环境描写，降低旁白密度，增加NPC对话张力。"
          />
          <button
            type="button"
            disabled={rerollSubmitting}
            onClick={async () => {
              setRerollSubmitting(true);
              const result = await onRequestReroll(rerollPrompt.trim());
              setRerollSubmitting(false);
              setRerollMessage(result.ok ? '重Roll投票已发起，等待全员确认。' : (result.error || '发起失败'));
            }}
            className="w-full py-2 rounded-lg border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 disabled:opacity-60"
          >
            {rerollSubmitting ? '发起中...' : '发起重Roll投票'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <DataRow label={`投票中 · 第${rerollVote.round}回合`} value={rerollVote.prompt || '（无额外提示词）'} />
          <div className="space-y-2">
            {(players || []).map((p: any) => {
              const status = rerollVote.approvals?.includes(p.id) ? '已同意' : rerollVote.rejections?.includes(p.id) ? '已拒绝' : '待确认';
              const color = status === '已同意' ? 'text-emerald-400' : status === '已拒绝' ? 'text-red-400' : 'text-zinc-400';
              return (
                <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 flex items-center justify-between">
                  <span className="text-sm text-zinc-200">{p.name}</span>
                  <span className={`text-xs ${color}`}>{status}</span>
                </div>
              );
            })}
          </div>
          {!rerollVoted && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  const result = await onRespondReroll(true);
                  setRerollMessage(result.ok ? '你已同意重Roll。' : (result.error || '提交失败'));
                }}
                className="py-2 rounded-lg border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
              >
                同意
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await onRespondReroll(false);
                  setRerollMessage(result.ok ? '你已拒绝重Roll。' : (result.error || '提交失败'));
                }}
                className="py-2 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/10"
              >
                拒绝
              </button>
            </div>
          )}
          {isRerollRequester && (
            <button
              type="button"
              onClick={onCancelReroll}
              className="w-full py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              取消投票
            </button>
          )}
        </div>
      )}

      {rerollMessage && (
        <div className="rounded-lg border border-cyan-700/50 bg-cyan-950/20 p-2 text-xs text-cyan-200">
          {rerollMessage}
        </div>
      )}
    </div>
  );

  const renderPageContent = () => {
    if (page === 'inventory') return renderInventory();
    if (page === 'skills') return renderSkills();
    if (page === 'tasks') return renderTasks();
    if (page === 'social') return renderSocial();
    if (page === 'team') return <TeamPanel players={players} />;
    if (page === 'story') return renderStory();
    if (page === 'agreements') return renderAgreements();
    if (page === 'memory') {
      return (
        <MemoryReviewPanel
          memorySystem={memorySystem}
          pendingTask={memoryPendingTask}
          summaryStage={memorySummaryStage}
          onOpenSummary={onOpenMemorySummary}
        />
      );
    }
    if (page === 'thinking') return renderThinking();
    if (page === 'reroll') return renderReroll();
    return null;
  };

  return (
    <div className="h-full bg-transparent border-l border-zinc-800 p-4 flex flex-col overflow-y-auto no-scrollbar relative">
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-2xl pointer-events-none"></div>

      <div className="text-xl font-bold text-zinc-300 mb-4 font-serif tracking-wider border-b border-zinc-800 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-8 bg-amber-500 rounded-sm"></span>
          {page === 'root' ? '功能菜单' : '功能详情'}
        </div>
        {page !== 'root' && (
          <button
            type="button"
            onClick={() => setPage('root')}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
          >
            <ChevronLeft size={14} />
            返回
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {page === 'root' ? (
          <motion.div key="menu-root" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }}>
            {renderRoot()}
          </motion.div>
        ) : (
          <motion.div key={`menu-${page}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} className="min-h-0">
            {renderPageContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

