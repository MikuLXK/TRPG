import type { 游戏状态 } from '../../../types/gameData';

interface AgreementsViewProps {
  gameData: 游戏状态;
}

const getStatusTone = (status?: string) => {
  const text = String(status || '');
  if (text.includes('完成') || text.includes('履行')) return 'text-emerald-300 border-emerald-500/40 bg-emerald-950/20';
  if (text.includes('违约') || text.includes('失败')) return 'text-red-300 border-red-500/40 bg-red-950/20';
  if (text.includes('进行') || text.includes('生效')) return 'text-amber-300 border-amber-500/40 bg-amber-950/20';
  return 'text-zinc-300 border-zinc-700 bg-zinc-900/60';
};

export default function AgreementsView({ gameData }: AgreementsViewProps) {
  const agreements = Array.isArray(gameData?.约定列表) ? gameData.约定列表 : [];

  if (agreements.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 text-sm text-zinc-500">
        暂无约定。
      </div>
    );
  }

  const activeCount = agreements.filter((item) => String(item?.当前状态 || '').includes('进行') || String(item?.当前状态 || '').includes('生效')).length;
  const doneCount = agreements.filter((item) => String(item?.当前状态 || '').includes('完成') || String(item?.当前状态 || '').includes('履行')).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-[11px] text-zinc-500">约定总数</div>
          <div className="text-lg font-bold text-zinc-100">{agreements.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-[11px] text-zinc-500">生效中</div>
          <div className="text-lg font-bold text-amber-300">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-[11px] text-zinc-500">已履行</div>
          <div className="text-lg font-bold text-emerald-300">{doneCount}</div>
        </div>
      </div>

      <div className="space-y-3">
        {agreements.map((item) => {
          const tone = getStatusTone(item?.当前状态);
          return (
            <div key={item.约定ID} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-zinc-100 tracking-wide">{item.标题}</div>
                  <div className="text-[11px] text-zinc-500">ID：{item.约定ID}</div>
                </div>
                <div className={`px-2 py-1 rounded-md border text-[11px] ${tone}`}>{item.当前状态 || '未定义'}</div>
              </div>

              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{item.约定内容 || '（无内容）'}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">性质：{item.性质 || '未定义'}</div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">对象：{item.对象名 || '未定义'}</div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">地点：{item.约定地点 || '未定义'}</div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">时间：{item.约定时间 || '未定义'}</div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/10 p-2 text-emerald-200/90">
                  履行奖励：{item.履行奖励 || '无'}
                </div>
                <div className="rounded-lg border border-red-900/60 bg-red-950/10 p-2 text-red-200/90">
                  违约后果：{item.违约后果 || '无'}
                </div>
                <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/10 p-2 text-cyan-200/90">
                  生效条件：{item.生效条件 || '无'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
