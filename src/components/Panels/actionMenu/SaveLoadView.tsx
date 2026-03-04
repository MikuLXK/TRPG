import { useEffect, useMemo, useState } from 'react';

interface SaveSlot {
  slotId: string;
  slotType: 'manual' | 'auto';
  slotIndex: number;
  label: string;
  updatedAt: number | null;
  round: number | null;
  savedBy: string;
  note: string;
  snapshot: unknown;
}

interface SaveSlotsPayload {
  manual: SaveSlot[];
  auto: SaveSlot[];
}

interface SaveLoadViewProps {
  saveSlots: SaveSlotsPayload | null;
  loadVote: any;
  onSaveToSlot: (slotIndex: number, note?: string) => Promise<{ ok: boolean; error?: string }>;
  onRequestSaveSlots: () => void;
  onRequestLoadVote: (slotType: 'manual' | 'auto', slotIndex: number) => Promise<{ ok: boolean; error?: string }>;
}

const SLOT_COUNT = 5;

const createFallbackSlot = (slotType: 'manual' | 'auto', slotIndex: number): SaveSlot => ({
  slotId: `${slotType}-${slotIndex}`,
  slotType,
  slotIndex,
  label: slotType === 'manual' ? `手动存档 ${slotIndex}` : `自动存档 ${slotIndex}`,
  updatedAt: null,
  round: null,
  savedBy: '',
  note: '',
  snapshot: null
});

const toTimeText = (ts: number | null) => {
  if (!ts || !Number.isFinite(ts)) return '空槽位';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '时间未知';
  }
};

const ensureSlots = (slots: SaveSlot[] | undefined, type: 'manual' | 'auto') => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return Array.from({ length: SLOT_COUNT }, (_, i) => createFallbackSlot(type, i + 1));
  }
  const next = Array.from({ length: SLOT_COUNT }, (_, i) => createFallbackSlot(type, i + 1));
  slots.forEach((slot) => {
    const idx = Math.max(1, Math.min(SLOT_COUNT, Number(slot?.slotIndex) || 1)) - 1;
    next[idx] = {
      ...next[idx],
      ...slot,
      slotType: type,
      slotIndex: idx + 1
    };
  });
  return next;
};

export default function SaveLoadView({
  saveSlots,
  loadVote,
  onSaveToSlot,
  onRequestSaveSlots,
  onRequestLoadVote
}: SaveLoadViewProps) {
  const [message, setMessage] = useState('');
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [loadingKey, setLoadingKey] = useState('');
  const [manualNotes, setManualNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    onRequestSaveSlots();
  }, [onRequestSaveSlots]);

  const manualSlots = useMemo(() => ensureSlots(saveSlots?.manual, 'manual'), [saveSlots]);
  const autoSlots = useMemo(() => ensureSlots(saveSlots?.auto, 'auto'), [saveSlots]);

  const totalUsed = [...manualSlots, ...autoSlots].filter((slot) => Boolean(slot.snapshot)).length;

  const renderSlot = (slot: SaveSlot, allowSave: boolean) => {
    const hasSnapshot = Boolean(slot?.snapshot);
    const loadLocked = Boolean(loadVote);
    const loadingId = `${slot.slotType}-${slot.slotIndex}`;

    return (
      <div key={slot.slotId} className="rounded-2xl border border-zinc-800 bg-zinc-950/75 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-zinc-100">{slot.label}</div>
            <div className="text-[11px] text-zinc-500">回合：{slot.round || '—'}</div>
          </div>
          <div className={`px-2 py-1 rounded-md border text-[11px] ${hasSnapshot ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}>
            {hasSnapshot ? '已保存' : '空槽位'}
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <div className="text-zinc-500">时间：{toTimeText(slot.updatedAt)}</div>
          <div className="text-zinc-400">保存者：{slot.savedBy || '—'}</div>
          <div className="text-zinc-400 whitespace-pre-wrap">备注：{slot.note || '—'}</div>
        </div>

        {allowSave && (
          <input
            value={manualNotes[slot.slotIndex] ?? ''}
            onChange={(e) => setManualNotes((prev) => ({ ...prev, [slot.slotIndex]: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
            placeholder="输入本次存档备注（可选）"
          />
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          {allowSave ? (
            <button
              type="button"
              disabled={savingSlot === slot.slotIndex}
              onClick={async () => {
                setSavingSlot(slot.slotIndex);
                const result = await onSaveToSlot(slot.slotIndex, (manualNotes[slot.slotIndex] || '').trim());
                setSavingSlot(null);
                if (result.ok) {
                  setMessage(`手动槽位 ${slot.slotIndex} 保存成功`);
                  onRequestSaveSlots();
                } else {
                  setMessage(result.error || '保存失败');
                }
              }}
              className="py-1.5 rounded-lg border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 disabled:opacity-60"
            >
              {savingSlot === slot.slotIndex ? '保存中...' : '覆盖保存'}
            </button>
          ) : (
            <div className="py-1.5 text-center text-[11px] text-zinc-600 border border-zinc-800 rounded-lg">自动轮转槽位</div>
          )}

          <button
            type="button"
            disabled={!hasSnapshot || loadLocked || loadingKey === loadingId}
            onClick={async () => {
              setLoadingKey(loadingId);
              const result = await onRequestLoadVote(slot.slotType, slot.slotIndex);
              setLoadingKey('');
              setMessage(result.ok ? `已发起读档投票：${slot.label}` : (result.error || '读档发起失败'));
            }}
            className="py-1.5 rounded-lg border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40"
          >
            发起读档
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-zinc-100">档案中枢</div>
            <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
              采用 5 手动 + 5 自动双轨存档。任何读档都必须进入全员投票，出现一票拒绝即失败。
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestSaveSlots}
            className="px-2 py-1 text-[11px] rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            刷新槽位
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
            <div className="text-zinc-500">手动槽位</div>
            <div className="text-amber-300 font-bold">{manualSlots.length}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
            <div className="text-zinc-500">自动槽位</div>
            <div className="text-cyan-300 font-bold">{autoSlots.length}</div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2">
            <div className="text-zinc-500">已占用</div>
            <div className="text-emerald-300 font-bold">{totalUsed}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold text-amber-300">手动存档区</div>
        <div className="grid grid-cols-1 gap-2">
          {manualSlots.map((slot) => renderSlot(slot, true))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-bold text-cyan-300">自动存档区</div>
        <div className="grid grid-cols-1 gap-2">
          {autoSlots.map((slot) => renderSlot(slot, false))}
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-cyan-700/50 bg-cyan-950/20 p-2 text-xs text-cyan-200">
          {message}
        </div>
      )}
    </div>
  );
}
