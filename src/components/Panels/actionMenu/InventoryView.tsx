import type { 玩家角色 } from '../../../types/gameData';
import DataRow from './DataRow';

interface InventoryViewProps {
  currentRole: 玩家角色 | null;
}

export default function InventoryView({ currentRole }: InventoryViewProps) {
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
}
