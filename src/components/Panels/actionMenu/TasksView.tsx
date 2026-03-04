import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface TasksViewProps {
  gameData: 游戏状态;
}

export default function TasksView({ gameData }: TasksViewProps) {
  return (
    <div className="space-y-3">
      {gameData.任务列表.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无任务。</div>
      ) : (
        gameData.任务列表.map((task) => (
          <DataRow
            key={task.任务ID}
            label={`${task.标题}（${task.当前状态}）`}
            value={`${task.描述}\n发布：${task.发布者} @ ${task.发布地点}`}
          />
        ))
      )}
    </div>
  );
}
