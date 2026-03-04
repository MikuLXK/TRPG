import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface TasksViewProps {
  gameData: 游戏状态;
}

export default function TasksView({ gameData }: TasksViewProps) {
  const tasks = Array.isArray(gameData?.任务列表) ? gameData.任务列表 : [];
  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <div className="text-sm text-zinc-500">暂无任务。</div>
      ) : (
        tasks.map((task) => (
          <DataRow
            key={task.任务ID}
            label={`${task.标题}（${task.当前状态}）`}
            value={[
              task.描述,
              `ID：${task.任务ID}｜类型：${task.类型}`,
              `发布：${task.发布者} @ ${task.发布地点}`,
              `目标：${task.目标列表.map((obj) => `${obj.描述} ${obj.进度}/${obj.目标值}`).join('；') || '无'}`,
              `关联章节：${task.关联章节ID || '无'}`
            ].join('\n')}
          />
        ))
      )}
    </div>
  );
}
