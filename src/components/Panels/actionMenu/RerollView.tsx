import { useState } from 'react';
import DataRow from './DataRow';

interface RerollViewProps {
  players: any[];
  rerollVote: any;
  selfPlayerId: string;
  onRequestReroll: (prompt: string) => Promise<{ ok: boolean; error?: string }>;
  onRespondReroll: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelReroll: () => void;
}

export default function RerollView({
  players,
  rerollVote,
  selfPlayerId,
  onRequestReroll,
  onRespondReroll,
  onCancelReroll
}: RerollViewProps) {
  const [rerollPrompt, setRerollPrompt] = useState('');
  const [rerollMessage, setRerollMessage] = useState('');
  const [rerollSubmitting, setRerollSubmitting] = useState(false);

  const rerollVoted = Boolean(
    rerollVote && (rerollVote.approvals?.includes(selfPlayerId) || rerollVote.rejections?.includes(selfPlayerId))
  );
  const isRerollRequester = Boolean(rerollVote && rerollVote.requesterId === selfPlayerId);

  return (
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
}
