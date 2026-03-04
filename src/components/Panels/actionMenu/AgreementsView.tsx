import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface AgreementsViewProps {
  gameData: 游戏状态;
}

export default function AgreementsView({ gameData }: AgreementsViewProps) {
  const agreements = Array.isArray(gameData?.约定列表) ? gameData.约定列表 : [];
  return (
    <div className="space-y-3">
      {agreements.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无约定。</div>
      ) : (
        agreements.map((item) => (
          <DataRow
            key={item.约定ID}
            label={`${item.标题}（${item.当前状态}）`}
            value={[
              item.约定内容,
              `ID：${item.约定ID}｜性质：${item.性质}`,
              `对象：${item.对象名}｜地点：${item.约定地点}`,
              `时间：${item.约定时间}｜生效条件：${item.生效条件 || '无'}`,
              `履行奖励：${item.履行奖励 || '无'}｜违约后果：${item.违约后果 || '无'}`
            ].join('\n')}
          />
        ))
      )}
    </div>
  );
}
