import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface StoryViewProps {
  gameData: 游戏状态;
}

export default function StoryView({ gameData }: StoryViewProps) {
  return (
    <div className="space-y-3">
      <DataRow label="当前章节" value={`${gameData.剧情.当前章节.标题 || '未命名章节'}\n阶段：${gameData.剧情.当前章节.当前阶段 || '未设置'}`} />
      <DataRow label="主线目标" value={gameData.剧情.主线目标.最终目标 || '未设置'} />
      <DataRow label="当前回合总述" value={gameData.剧情.当前回合总述 || '暂无'} />
      <DataRow label="线索数量" value={`线索 ${gameData.剧情.线索列表.length} 条\n待触发事件 ${gameData.剧情.待触发事件.length} 条`} />
    </div>
  );
}
