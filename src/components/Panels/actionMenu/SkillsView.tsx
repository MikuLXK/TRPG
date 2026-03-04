import type { 玩家角色 } from '../../../types/gameData';

interface SkillsViewProps {
  currentRole: 玩家角色 | null;
}

const getTypeTone = (type?: string) => {
  const text = String(type || '').toLowerCase();
  if (text.includes('火') || text.includes('炎')) return 'text-orange-300 border-orange-500/40 bg-orange-950/20';
  if (text.includes('冰') || text.includes('寒')) return 'text-cyan-300 border-cyan-500/40 bg-cyan-950/20';
  if (text.includes('雷')) return 'text-violet-300 border-violet-500/40 bg-violet-950/20';
  if (text.includes('毒')) return 'text-emerald-300 border-emerald-500/40 bg-emerald-950/20';
  if (text.includes('神圣') || text.includes('光')) return 'text-amber-200 border-amber-500/40 bg-amber-950/20';
  return 'text-zinc-300 border-zinc-700 bg-zinc-900/60';
};

export default function SkillsView({ currentRole }: SkillsViewProps) {
  const list = Array.isArray(currentRole?.技能列表) ? currentRole.技能列表 : [];

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 text-sm text-zinc-500">
        当前主控角色暂无技能。
      </div>
    );
  }

  const totalCooldown = list.reduce((sum, skill) => sum + Math.max(0, Number(skill?.冷却回合) || 0), 0);
  const cooling = list.filter((skill) => (Number(skill?.当前冷却) || 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-[11px] text-zinc-500">技能总数</div>
          <div className="text-lg font-bold text-zinc-100">{list.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-[11px] text-zinc-500">冷却中</div>
          <div className="text-lg font-bold text-amber-300">{cooling}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-[11px] text-zinc-500">总冷却值</div>
          <div className="text-lg font-bold text-cyan-300">{totalCooldown}</div>
        </div>
      </div>

      <div className="space-y-3">
        {list.map((skill, idx) => {
          const currentCd = Number(skill?.当前冷却) || 0;
          const maxCd = Math.max(0, Number(skill?.冷却回合) || 0);
          const ratio = maxCd > 0 ? Math.min(100, Math.round((currentCd / maxCd) * 100)) : 0;
          const tone = getTypeTone(skill?.伤害类型);

          return (
            <div key={`${skill.技能ID}-${idx}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-zinc-100 tracking-wide">{skill.名称}</div>
                  <div className="text-[11px] text-zinc-500">{skill.技能ID}</div>
                </div>
                <div className={`px-2 py-1 rounded-md border text-[11px] ${tone}`}>
                  {skill.分类 || '未分类'} · {skill.伤害类型 || '未定义'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">
                  消耗：{skill.消耗类型 || '无'} {Number(skill.消耗数值) || 0}
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-300">
                  冷却：{currentCd}/{maxCd}
                </div>
              </div>

              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-400"
                  style={{ width: `${ratio}%` }}
                />
              </div>

              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {skill.描述 || '无描述'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
