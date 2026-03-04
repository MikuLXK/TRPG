import type { 玩家角色 } from '../../../types/gameData';
import DataRow from './DataRow';

interface SkillsViewProps {
  currentRole: 玩家角色 | null;
}

export default function SkillsView({ currentRole }: SkillsViewProps) {
  const list = Array.isArray(currentRole?.技能列表) ? currentRole.技能列表 : [];
  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <div className="text-sm text-zinc-500">当前主控角色暂无技能。</div>
      ) : (
        list.map((skill, idx) => (
          <DataRow
            key={`${skill.技能ID}-${idx}`}
            label={skill.名称}
            value={[
              `${skill.分类} / ${skill.伤害类型}｜ID：${skill.技能ID}`,
              `消耗：${skill.消耗类型} ${skill.消耗数值}｜冷却：${skill.当前冷却}/${skill.冷却回合}`,
              skill.描述 || '无描述'
            ].join('\n')}
          />
        ))
      )}
    </div>
  );
}
