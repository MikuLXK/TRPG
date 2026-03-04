import type { 游戏状态 } from '../../../types/gameData';
import DataRow from './DataRow';

interface StoryViewProps {
  gameData: 游戏状态;
}

export default function StoryView({ gameData }: StoryViewProps) {
  const chapter = gameData?.剧情?.当前章节;
  const mainGoal = gameData?.剧情?.主线目标;
  const clueList = Array.isArray(gameData?.剧情?.线索列表) ? gameData.剧情.线索列表 : [];
  const pendingEvents = Array.isArray(gameData?.剧情?.待触发事件) ? gameData.剧情.待触发事件 : [];
  const happenedEvents = Array.isArray(gameData?.剧情?.已发生事件) ? gameData.剧情.已发生事件 : [];
  const stageGoals = Array.isArray(mainGoal?.阶段目标) ? mainGoal.阶段目标 : [];

  return (
    <div className="space-y-3">
      <DataRow
        label="当前章节"
        value={[
          `${chapter?.标题 || '未命名章节'}（${chapter?.章节ID || '无ID'}）`,
          `阶段：${chapter?.当前阶段 || '未设置'}`,
          `目标：${Array.isArray(chapter?.目标) ? chapter!.目标.join('；') : '无'}`
        ].join('\n')}
      />
      <DataRow
        label="主线目标"
        value={[
          mainGoal?.最终目标 || '未设置',
          `当前进度：${mainGoal?.当前进度 || '未设置'}`,
          `阶段目标：${stageGoals.map((item) => `${item.名称} ${item.进度} (${item.状态})`).join('；') || '无'}`
        ].join('\n')}
      />
      <DataRow label="当前回合总述" value={gameData?.剧情?.当前回合总述 || '暂无'} />
      <DataRow
        label="线索与事件"
        value={[
          `线索：${clueList.length} 条（已发现 ${clueList.filter((item) => item.状态 !== '未发现').length}）`,
          `待触发事件：${pendingEvents.length} 条`,
          `已发生事件：${happenedEvents.length} 条`
        ].join('\n')}
      />
    </div>
  );
}
