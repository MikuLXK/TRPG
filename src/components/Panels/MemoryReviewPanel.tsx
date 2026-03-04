import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layers, Sparkles, Clock3 } from 'lucide-react';
import type { 记忆系统结构, 记忆压缩任务 } from '../../types/gameData';
import { 拆分即时与短期 } from '../../utils/memory';

type MemoryTab = '即时' | '短期' | '中期' | '长期';

interface MemoryReviewPanelProps {
  memorySystem: 记忆系统结构;
  pendingTask: 记忆压缩任务 | null;
  summaryStage: 'idle' | 'remind' | 'processing' | 'review';
  onOpenSummary: () => void;
}

const tabs: Array<{ id: MemoryTab; label: string }> = [
  { id: '即时', label: '即时记忆' },
  { id: '短期', label: '短期记忆' },
  { id: '中期', label: '中期记忆' },
  { id: '长期', label: '长期记忆' }
];

const layerTitle = (layer: '短期' | '中期' | '长期') => (layer === '短期' ? '短期记忆' : layer === '中期' ? '中期记忆' : '长期记忆');

export default function MemoryReviewPanel({
  memorySystem,
  pendingTask,
  summaryStage,
  onOpenSummary
}: MemoryReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<MemoryTab>('即时');

  const list = useMemo(() => {
    if (activeTab === '即时') {
      return memorySystem.即时记忆
        .map((item, index) => ({ id: `immediate-${index}`, ...拆分即时与短期(item) }))
        .reverse();
    }
    if (activeTab === '短期') {
      return memorySystem.短期记忆.map((item, index) => ({ id: `short-${index}`, text: item })).reverse();
    }
    if (activeTab === '中期') {
      return memorySystem.中期记忆.map((item, index) => ({ id: `mid-${index}`, text: item })).reverse();
    }
    return memorySystem.长期记忆.map((item, index) => ({ id: `long-${index}`, text: item })).reverse();
  }, [activeTab, memorySystem]);

  return (
    <div className="h-full bg-transparent border-l border-zinc-800 p-4 flex flex-col overflow-hidden relative">
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-2xl pointer-events-none"></div>

      <div className="flex items-center justify-between gap-2 mb-4 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-zinc-200">
          <span className="w-2 h-8 bg-cyan-500 rounded-sm"></span>
          <h2 className="text-lg font-bold tracking-wider">记忆回顾</h2>
        </div>
        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
          <Layers size={12} />
          {memorySystem.即时记忆.length}/{memorySystem.短期记忆.length}/{memorySystem.中期记忆.length}/{memorySystem.长期记忆.length}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-2 rounded-lg text-xs font-bold border transition-colors ${
              activeTab === tab.id
                ? 'bg-cyan-900/35 border-cyan-500/60 text-cyan-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {pendingTask && (
        <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-950/20 p-3 text-xs text-amber-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="font-bold flex items-center gap-1">
              <Sparkles size={13} />
              记忆压缩任务待处理
            </div>
            <button
              type="button"
              onClick={onOpenSummary}
              className="px-2 py-1 rounded-md border border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
            >
              打开
            </button>
          </div>
          <div>方向：{layerTitle(pendingTask.来源层)} → {layerTitle(pendingTask.目标层)}</div>
          <div>范围：{pendingTask.起始时间} - {pendingTask.结束时间}</div>
          <div className="mt-1 text-amber-200/80 flex items-center gap-1">
            <Clock3 size={12} />
            当前阶段：{summaryStage === 'processing' ? '生成中' : summaryStage === 'review' ? '待确认' : '待开始'}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
        <AnimatePresence>
          {list.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex items-center justify-center text-sm text-zinc-500"
            >
              当前层暂无记忆
            </motion.div>
          )}
          {activeTab === '即时' && list.map((item: any, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: Math.min(idx, 6) * 0.03 }}
              className="rounded-xl border border-cyan-800/45 bg-zinc-900/70 p-3"
            >
              <div className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{item.即时内容 || '（空）'}</div>
              {item.短期摘要 && (
                <div className="mt-2 border-t border-cyan-900/40 pt-2">
                  <div className="text-[10px] uppercase tracking-wider text-cyan-300/70">短期摘要</div>
                  <div className="text-xs text-cyan-100/85 whitespace-pre-wrap leading-relaxed">{item.短期摘要}</div>
                </div>
              )}
            </motion.div>
          ))}
          {activeTab !== '即时' && list.map((item: any, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: Math.min(idx, 6) * 0.03 }}
              className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-3 text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed"
            >
              {item.text || '（空）'}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

