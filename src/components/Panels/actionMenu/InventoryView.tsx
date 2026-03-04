import { Package, Coins, Shield, Weight, Wrench } from 'lucide-react';
import type { 玩家角色 } from '../../../types/gameData';

interface InventoryViewProps {
  currentRole: 玩家角色 | null;
}

const qualityColor = (quality: string) => {
  if (quality.includes('传说')) return 'border-amber-400/50 bg-amber-500/10 text-amber-200';
  if (quality.includes('史诗')) return 'border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-200';
  if (quality.includes('稀有')) return 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200';
  return 'border-zinc-700 bg-zinc-800/60 text-zinc-200';
};

export default function InventoryView({ currentRole }: InventoryViewProps) {
  const list = Array.isArray(currentRole?.物品列表) ? currentRole.物品列表 : [];
  const totalWeight = list.reduce((sum, item) => sum + (Number(item.重量) || 0) * Math.max(1, Number(item.数量) || 1), 0);
  const totalValue = list.reduce((sum, item) => sum + (Number(item.价值) || 0) * Math.max(1, Number(item.数量) || 1), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <Package size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-100">{currentRole?.角色名 || '当前角色'} 的背包</div>
              <div className="text-xs text-zinc-500">共 {list.length} 种物品</div>
            </div>
          </div>
          <div className="text-right text-xs text-zinc-400">
            <div className="inline-flex items-center gap-1"><Weight size={12} /> {totalWeight.toFixed(1)}</div>
            <div className="inline-flex items-center gap-1 ml-3"><Coins size={12} /> {totalValue}</div>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          背包空空如也，去探索世界并获得战利品。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {list.map((item, idx) => (
            <div key={`${item.物品ID}-${idx}`} className={`rounded-xl border p-3 ${qualityColor(String(item.品质 || '普通'))}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{item.名称} <span className="text-xs opacity-80">x{item.数量}</span></div>
                  <div className="text-[11px] opacity-80 mt-1">{item.类型} · {item.品质} · ID {item.物品ID}</div>
                </div>
                <div className="text-[11px] opacity-80 text-right space-y-1">
                  <div className="inline-flex items-center gap-1"><Coins size={11} /> {item.价值}</div>
                  <div className="inline-flex items-center gap-1 ml-2"><Weight size={11} /> {item.重量}</div>
                </div>
              </div>

              <div className="mt-2 text-xs opacity-90 whitespace-pre-wrap">{item.描述 || '暂无描述'}</div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/40 px-2 py-1 inline-flex items-center gap-1">
                  <Wrench size={11} /> 耐久 {item.当前耐久}/{item.最大耐久}
                </div>
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/40 px-2 py-1 inline-flex items-center gap-1">
                  <Shield size={11} /> 可用次数 {item.可用次数}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
