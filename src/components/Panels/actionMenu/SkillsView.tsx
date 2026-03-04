import type { 玩家角色 } from '../../../types/gameData';
import DataRow from './DataRow';

interface SkillsViewProps {
  currentRole: 玩家角色 | null;
}

export default function SkillsView({ currentRole }: SkillsViewProps) {
  const list = currentRole?.技能列表 || [];
  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <div className="text-sm text-zinc-500">当前主控角色暂无技能。</div>
      ) : (
        list.map((skill, idx) => (
          <DataRow
            key={`${skill.技能ID}-${idx}`}
            label={skill.名称}
            value={`${skill.分类} / ${skill.伤害类型}\n${skill.描述 || '无描述'}`}
          />
        ))
      )}
    </div>
  );
}
