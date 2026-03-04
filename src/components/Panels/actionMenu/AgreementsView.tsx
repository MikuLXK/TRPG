import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface AgreementsViewProps {
  gameData: 游戏状态;
}

export default function AgreementsView({ gameData }: AgreementsViewProps) {
  return (
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
}
