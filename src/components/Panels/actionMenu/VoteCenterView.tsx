import { useMemo, useState } from 'react';

interface VoteCenterViewProps {
  players: any[];
  rerollVote: any;
  loadVote: any;
  selfPlayerId: string;
  onRequestReroll: (prompt: string) => Promise<{ ok: boolean; error?: string }>;
  onRespondReroll: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelReroll: () => void;
  onRespondLoadVote: (approve: boolean) => Promise<{ ok: boolean; error?: string }>;
  onCancelLoadVote: () => void;
}

type VoteType = 'reroll' | 'load';

export default function VoteCenterView({
  players,
  rerollVote,
  loadVote,
  selfPlayerId,
  onRequestReroll,
  onRespondReroll,
  onCancelReroll,
  onRespondLoadVote,
  onCancelLoadVote
}: VoteCenterViewProps) {
  const [rerollPrompt, setRerollPrompt] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeVoteType: VoteType | null = rerollVote ? 'reroll' : loadVote ? 'load' : null;
  const activeVote = rerollVote || loadVote || null;

  const voted = Boolean(
    activeVote && (activeVote.approvals?.includes(selfPlayerId) || activeVote.rejections?.includes(selfPlayerId))
  );
  const isRequester = Boolean(activeVote && activeVote.requesterId === selfPlayerId);

  const statusRows = useMemo(() => {
    if (!activeVote) return [];
    return (players || []).map((p: any) => {
      const status = activeVote.approvals?.includes(p.id)
        ? '已同意'
        : activeVote.rejections?.includes(p.id)
          ? '已拒绝'
          : '待确认';
      const tone = status === '已同意' ? 'text-emerald-300 border-emerald-600/40 bg-emerald-950/20' : status === '已拒绝' ? 'text-red-300 border-red-600/40 bg-red-950/20' : 'text-zinc-300 border-zinc-700 bg-zinc-900/60';
      return { id: p.id, name: p.name, status, tone };
    });
  }, [activeVote, players]);

  const approvalsCount = Number(activeVote?.approvals?.length || 0);
  const rejectionsCount = Number(activeVote?.rejections?.length || 0);
  const pendingCount = Math.max(0, (players || []).length - approvalsCount - rejectionsCount);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
        <div className="text-sm font-bold text-zinc-100">投票中心</div>
        <div className="text-xs text-zinc-400 leading-relaxed">
          统一管理重Roll投票与读档投票。规则：任意玩家拒绝即失败；仅当全部在线玩家同意时通过。
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`rounded-lg border p-2 ${rerollVote ? 'border-amber-500/40 bg-amber-950/20 text-amber-200' : 'border-zinc-800 bg-zinc-900/70 text-zinc-400'}`}>
            重Roll投票：{rerollVote ? '进行中' : '空闲'}
          </div>
          <div className={`rounded-lg border p-2 ${loadVote ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200' : 'border-zinc-800 bg-zinc-900/70 text-zinc-400'}`}>
            读档投票：{loadVote ? '进行中' : '空闲'}
          </div>
        </div>
      </div>

      {!activeVote && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4 space-y-3">
          <div className="text-sm font-bold text-amber-300">发起重Roll投票</div>
          <textarea
            value={rerollPrompt}
            onChange={(e) => setRerollPrompt(e.target.value)}
            className="w-full h-28 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 resize-none focus:outline-none focus:border-amber-500"
            placeholder="例如：增强环境压迫感，增加NPC冲突台词，减少旁白。"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              const result = await onRequestReroll(rerollPrompt.trim());
              setSubmitting(false);
              setMessage(result.ok ? '重Roll投票已发起。' : (result.error || '发起失败'));
            }}
            className="w-full py-2 rounded-lg border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 disabled:opacity-60"
          >
            {submitting ? '发起中...' : '发起投票'}
          </button>
        </div>
      )}

      {activeVote && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-zinc-100">
                  {activeVoteType === 'reroll' ? `重Roll 投票 · 第${activeVote.round || '-'}回合` : '读档投票'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {activeVoteType === 'reroll'
                    ? (activeVote.prompt || '（无额外提示词）')
                    : `目标槽位：${String(activeVote.slotType || 'manual')}-${String(activeVote.slotIndex || '-')}`}
                </div>
              </div>
              <div className={`px-2 py-1 rounded-md border text-[11px] ${activeVoteType === 'reroll' ? 'border-amber-500/40 bg-amber-950/20 text-amber-300' : 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300'}`}>
                进行中
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-2 text-emerald-300">同意：{approvalsCount}</div>
              <div className="rounded-lg border border-red-700/30 bg-red-950/10 p-2 text-red-300">拒绝：{rejectionsCount}</div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">待确认：{pendingCount}</div>
            </div>

            <div className="space-y-2">
              {statusRows.map((row) => (
                <div key={row.id} className={`rounded-lg border p-2 flex items-center justify-between ${row.tone}`}>
                  <span className="text-sm">{row.name}</span>
                  <span className="text-xs">{row.status}</span>
                </div>
              ))}
            </div>
          </div>

          {!voted && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  const result = activeVoteType === 'reroll' ? await onRespondReroll(true) : await onRespondLoadVote(true);
                  setMessage(result.ok ? '你已同意。' : (result.error || '提交失败'));
                }}
                className="py-2 rounded-lg border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
              >
                同意
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = activeVoteType === 'reroll' ? await onRespondReroll(false) : await onRespondLoadVote(false);
                  setMessage(result.ok ? '你已拒绝。' : (result.error || '提交失败'));
                }}
                className="py-2 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/10"
              >
                拒绝
              </button>
            </div>
          )}

          {isRequester && (
            <button
              type="button"
              onClick={activeVoteType === 'reroll' ? onCancelReroll : onCancelLoadVote}
              className="w-full py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              取消当前投票
            </button>
          )}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-cyan-700/50 bg-cyan-950/20 p-2 text-xs text-cyan-200">
          {message}
        </div>
      )}
    </div>
  );
}
