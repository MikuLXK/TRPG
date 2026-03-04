import { CheckCircle2, Circle, ClipboardList, MapPin, Target, Trophy } from 'lucide-react';
import type { 游戏状态 } from '../../../types/gameData';

interface TasksViewProps {
  gameData: 游戏状态;
}

const statusColor = (status: string) => {
  if (status.includes('完成')) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  if (status.includes('失败')) return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (status.includes('进行')) return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-zinc-700 bg-zinc-900/50 text-zinc-300';
};

export default function TasksView({ gameData }: TasksViewProps) {
  const tasks = Array.isArray(gameData?.任务列表) ? gameData.任务列表 : [];
  const completed = tasks.filter((task) => String(task.当前状态).includes('完成')).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300"><ClipboardList size={16} /></div>
          <div>
            <div className="text-sm font-bold text-zinc-100">任务日志 / Quest Journal</div>
            <div className="text-xs text-zinc-500">RPG 化任务视图：目标、进度、章节归属</div>
          </div>
        </div>
        <div className="text-xs text-zinc-400 inline-flex items-center gap-1"><Trophy size={12} /> {completed}/{tasks.length || 0}</div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          暂无任务。剧情推进后会自动生成任务。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tasks.map((task) => (
            <div key={task.任务ID} className={`rounded-xl border p-3 ${statusColor(String(task.当前状态 || '未知'))}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{task.标题}</div>
                  <div className="text-[11px] opacity-80">ID {task.任务ID} · 类型 {task.类型} · 章节 {task.关联章节ID || '无'}</div>
                </div>
                <div className="text-xs rounded-md border px-2 py-1 border-current/40 bg-black/20">
                  {task.当前状态 || '未知'}
                </div>
              </div>

              <div className="mt-2 text-xs whitespace-pre-wrap opacity-90">{task.描述 || '暂无描述'}</div>

              <div className="mt-2 text-[11px] opacity-80 flex items-center gap-1">
                <MapPin size={11} /> 发布者 {task.发布者} @ {task.发布地点}
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-xs font-bold inline-flex items-center gap-1"><Target size={12} /> 任务目标</div>
                {Array.isArray(task.目标列表) && task.目标列表.length > 0 ? task.目标列表.map((obj, idx) => {
                  const done = Number(obj.进度) >= Number(obj.目标值);
                  return (
                    <div key={`${task.任务ID}-obj-${idx}`} className="rounded-md border border-zinc-700/60 bg-zinc-900/40 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="inline-flex items-center gap-1">
                          {done ? <CheckCircle2 size={12} className="text-emerald-300" /> : <Circle size={12} className="text-zinc-500" />}
                          <span>{obj.描述}</span>
                        </div>
                        <span className="text-[11px] text-zinc-500">{obj.进度}/{obj.目标值}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-[11px] text-zinc-500">无目标条目</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
