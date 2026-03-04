import type { 记忆压缩任务 } from '../../types/gameData';

type Stage = 'idle' | 'remind' | 'processing' | 'review';

interface MemorySummaryFlowModalProps {
  open: boolean;
  stage: Stage;
  task: 记忆压缩任务 | null;
  draft: string;
  error: string;
  onStart: () => void;
  onCancel: () => void;
  onBack: () => void;
  onDraftChange: (text: string) => void;
  onApply: () => void;
}

const label = (layer: '短期' | '中期' | '长期') => {
  if (layer === '短期') return '短期记忆';
  if (layer === '中期') return '中期记忆';
  return '长期记忆';
};

export default function MemorySummaryFlowModal({
  open,
  stage,
  task,
  draft,
  error,
  onStart,
  onCancel,
  onBack,
  onDraftChange,
  onApply
}: MemorySummaryFlowModalProps) {
  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-amber-500/35 bg-zinc-950 shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="text-amber-400 font-bold tracking-wider">记忆总结流程</div>
          {stage !== 'processing' && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 text-xs rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              关闭
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-zinc-400 leading-relaxed">
            当前任务：{label(task.来源层)} → {label(task.目标层)}，共 {task.批次条数} 条，时间范围 {task.起始时间} - {task.结束时间}
          </div>

          {stage === 'remind' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-cyan-500/35 bg-cyan-950/20 p-3 text-sm text-zinc-200">
                检测到记忆达到压缩阈值，需要先执行总结，再写入下一层记忆。
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-xs rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  稍后处理
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  className="px-4 py-2 text-xs rounded border border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                >
                  确认并开始总结
                </button>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="py-10 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin"></div>
              <div className="text-sm text-zinc-200">正在生成记忆总结，请稍候...</div>
            </div>
          )}

          {stage === 'review' && (
            <div className="space-y-3">
              {error && (
                <div className="rounded border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-300 whitespace-pre-wrap">
                  {error}
                </div>
              )}
              <textarea
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-200 leading-relaxed font-mono resize-none outline-none focus:border-amber-500"
                placeholder="这里是总结结果。你可以直接修改，然后点击“确认写入”。"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3 py-2 text-xs rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  返回提醒
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  className="px-3 py-2 text-xs rounded border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                >
                  重新生成
                </button>
                <button
                  type="button"
                  onClick={onApply}
                  className="px-3 py-2 text-xs rounded border border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                >
                  确认写入
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

