import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface SocialViewProps {
  gameData: 游戏状态;
}

export default function SocialView({ gameData }: SocialViewProps) {
  return (
    <div className="space-y-3">
      {gameData.社交.关系列表.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无社交关系记录。</div>
      ) : (
        gameData.社交.关系列表.map((item) => (
          <DataRow
            key={item.关系ID}
            label={`${item.对象名}（${item.关系状态}）`}
            value={`好感度 ${item.好感度} / 信任度 ${item.信任度}\n${item.简介 || '无简介'}`}
          />
        ))
      )}
    </div>
  );
}
