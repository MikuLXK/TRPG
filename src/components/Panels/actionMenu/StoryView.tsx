import { BookOpen, Goal, Compass, Footprints, Sparkles } from 'lucide-react';
import type { 游戏状态 } from '../../../types/gameData';

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

  const discoveredClueCount = clueList.filter((item) => item.状态 !== '未发现').length;
  const completedStage = stageGoals.filter((item) => String(item.状态).includes('完成')).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"><BookOpen size={16} /></div>
            <div>
              <div className="text-sm font-bold text-zinc-100">剧情追踪面板</div>
              <div className="text-xs text-zinc-500">章节推进 · 主线阶段 · 事件线索</div>
            </div>
          </div>
          <div className="text-xs text-zinc-400">阶段 {completedStage}/{stageGoals.length || 0}</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
        <div className="text-sm font-bold text-zinc-100">{chapter?.标题 || '未命名章节'}</div>
        <div className="text-[11px] text-zinc-500">章节ID：{chapter?.章节ID || '无'} · 当前阶段：{chapter?.当前阶段 || '未设置'}</div>
        <div className="text-xs text-zinc-300 whitespace-pre-wrap">{chapter?.背景 || '暂无章节背景。'}</div>
        <div className="text-xs text-zinc-400 inline-flex items-center gap-1"><Compass size={12} /> 章节目标：{Array.isArray(chapter?.目标) ? chapter!.目标.join(' / ') : '无'}</div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
        <div className="text-sm font-bold text-zinc-100 inline-flex items-center gap-1"><Goal size={14} /> 主线目标</div>
        <div className="text-xs text-zinc-300">{mainGoal?.最终目标 || '未设置'}</div>
        <div className="text-[11px] text-zinc-500">当前进度：{mainGoal?.当前进度 || '未设置'}</div>
        <div className="space-y-1">
          {stageGoals.length === 0 ? (
            <div className="text-[11px] text-zinc-500">暂无阶段目标</div>
          ) : stageGoals.map((item, idx) => (
            <div key={`${item.名称}-${idx}`} className="rounded-md border border-zinc-700/60 bg-zinc-900/50 px-2 py-1 text-[11px] text-zinc-300 flex items-center justify-between gap-2">
              <span>{item.名称}</span>
              <span className="text-zinc-500">{item.进度} · {item.状态}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
        <div className="text-sm font-bold text-zinc-100 inline-flex items-center gap-1"><Sparkles size={14} /> 回合总述</div>
        <div className="text-xs text-zinc-300 whitespace-pre-wrap mt-1">{gameData?.剧情?.当前回合总述 || '暂无'}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-center">
          <div className="text-lg font-bold text-cyan-300">{discoveredClueCount}/{clueList.length}</div>
          <div className="text-[11px] text-zinc-500">已发现线索</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-center">
          <div className="text-lg font-bold text-amber-300">{pendingEvents.length}</div>
          <div className="text-[11px] text-zinc-500">待触发事件</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-center">
          <div className="text-lg font-bold text-emerald-300">{happenedEvents.length}</div>
          <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1"><Footprints size={11} /> 已发生</div>
        </div>
      </div>
    </div>
  );
}
