import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface SocialViewProps {
  gameData: 游戏状态;
}

export default function SocialView({ gameData }: SocialViewProps) {
  const relations = Array.isArray(gameData?.社交?.关系列表) ? gameData.社交.关系列表 : [];
  return (
    <div className="space-y-3">
      {relations.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无社交关系记录。</div>
      ) : (
        relations.map((item) => (
          <DataRow
            key={item.关系ID}
            label={`${item.对象名}（${item.关系状态}）`}
            value={[
              `ID：${item.关系ID}｜类型：${item.对象类型}${item.是否队友 ? '｜队友' : ''}`,
              `好感度 ${item.好感度} / 信任度 ${item.信任度} / 态度 ${item.态度 || '未知'}`,
              `地点：${item.当前地点 || '未知地点'}｜记忆条数：${item.记忆?.length || 0}`,
              item.简介 || '无简介'
            ].join('\n')}
          />
        ))
      )}
    </div>
  );
}
