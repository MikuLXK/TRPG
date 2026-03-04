import { motion } from 'motion/react';
import { User, Heart, Zap, ChevronLeft, Users, BadgeInfo } from 'lucide-react';
import type { 游戏状态, 玩家角色 } from '../../types/gameData';

interface TeamPanelProps {
  roomPlayers: any[];
  gameData: 游戏状态;
  selfPlayerId?: string;
  onBack?: () => void;
}

type TeamMember = {
  id: string;
  source: 'player' | 'npc';
  name: string;
  title: string;
  subTitle: string;
  levelText: string;
  playerSlot?: number;
  hp: number | null;
  maxHp: number | null;
  mp: number | null;
  maxMp: number | null;
  status: string[];
  location: string;
  online?: boolean;
  isSelf?: boolean;
};

const clampPercent = (current: number | null, total: number | null) => {
  if (current === null || total === null || total <= 0) return 0;
  return Math.max(0, Math.min(100, (current / total) * 100));
};

const toSafeNumber = (value: unknown): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.floor(num));
};

const resolveTeamMembers = (args: {
  roomPlayers: any[];
  gameData: 游戏状态;
  selfPlayerId?: string;
}): TeamMember[] => {
  const roomMapById = new Map((args.roomPlayers || []).map((p) => [String(p.id || ''), p]));
  const roomMapByName = new Map((args.roomPlayers || []).map((p) => [String(p.name || ''), p]));
  const playerRolesFromList = Array.isArray(args.gameData?.角色?.玩家角色列表)
    ? args.gameData.角色.玩家角色列表
    : [];
  const playerRolesFromSlots: 玩家角色[] = [args.gameData?.玩家1, args.gameData?.玩家2, args.gameData?.玩家3, args.gameData?.玩家4].filter(
    (role): role is 玩家角色 => Boolean(role)
  );

  const roleMap = new Map<string, 玩家角色>();
  [...playerRolesFromList, ...playerRolesFromSlots].forEach((role, index) => {
    const key = String(role?.玩家ID || role?.角色ID || role?.玩家序号 || `idx-${index}`);
    if (!roleMap.has(key)) roleMap.set(key, role);
  });

  const playerMembers: TeamMember[] = Array.from(roleMap.values())
    .map((role, index) => {
      const roomPlayer = roomMapById.get(role.玩家ID) || roomMapByName.get(role.玩家名);
      const playerSlot = Number(role.玩家序号 || roomPlayer?.playerSlot || index + 1);
      return {
        id: String(role.玩家ID || role.角色ID || `player-${role.玩家序号}`),
        source: 'player' as const,
        name: role.角色名 || role.玩家名 || `玩家${role.玩家序号}`,
        title: '玩家角色',
        subTitle: `玩家${playerSlot} · ${role.玩家名 || roomPlayer?.name || '未命名玩家'}`,
        levelText: `Lv.${role.等级} ${role.职业 || '未分配职业'}`,
        playerSlot,
        hp: toSafeNumber(role.当前生命值),
        maxHp: toSafeNumber(role.最大生命值),
        mp: toSafeNumber(role.当前法力值),
        maxMp: toSafeNumber(role.最大法力值),
        status: Array.isArray(role.状态效果) ? role.状态效果 : [],
        location: role.位置 || '未知地点',
        online: roomPlayer ? roomPlayer.isOnline !== false : args.roomPlayers.length === 0 ? true : false,
        isSelf: Boolean(
          args.selfPlayerId &&
            (String(role.玩家ID || '') === String(args.selfPlayerId) ||
              String(role.角色ID || '') === String(args.selfPlayerId) ||
              (roomPlayer && String(roomPlayer.id || '') === String(args.selfPlayerId)))
        )
      };
    })
    .sort((a, b) => {
      const slotA = Number(a.playerSlot || 999);
      const slotB = Number(b.playerSlot || 999);
      return slotA - slotB;
    });

  const knownPlayerIds = new Set<string>(
    playerMembers.flatMap((member) => [member.id, member.name]).filter(Boolean).map((v) => String(v))
  );
  (args.roomPlayers || []).forEach((roomPlayer, index) => {
    const roomId = String(roomPlayer?.id || '');
    const roomName = String(roomPlayer?.name || '');
    if ((roomId && knownPlayerIds.has(roomId)) || (roomName && knownPlayerIds.has(roomName))) return;

    const slot = Number(roomPlayer?.playerSlot || index + 1);
    playerMembers.push({
      id: roomId || `room-player-${slot}`,
      source: 'player' as const,
      name: roomName || `玩家${slot}`,
      title: '玩家角色',
      subTitle: `玩家${slot} · ${roomName || '未命名玩家'}`,
      levelText: 'Lv.-- 未创建角色',
      playerSlot: slot,
      hp: toSafeNumber(roomPlayer?.currentHP),
      maxHp: toSafeNumber(roomPlayer?.maxHP),
      mp: toSafeNumber(roomPlayer?.currentMP),
      maxMp: toSafeNumber(roomPlayer?.maxMP),
      status: Array.isArray(roomPlayer?.statusEffects) ? roomPlayer.statusEffects : [],
      location: String(roomPlayer?.location || '未知地点'),
      online: roomPlayer?.isOnline !== false,
      isSelf: Boolean(args.selfPlayerId && String(roomId) === String(args.selfPlayerId))
    });
  });
  playerMembers.sort((a, b) => Number(a.playerSlot || 999) - Number(b.playerSlot || 999));

  const battleNpcMap = new Map(
    (args.gameData?.战斗?.玩家方 || [])
      .filter((unit) => unit.类型 === 'NPC')
      .map((unit) => [String(unit.单位ID || unit.名称 || ''), unit])
  );
  (args.gameData?.战斗?.玩家方 || [])
    .filter((unit) => unit.类型 === 'NPC')
    .forEach((unit) => {
      if (!battleNpcMap.has(String(unit.名称 || ''))) {
        battleNpcMap.set(String(unit.名称 || ''), unit);
      }
    });

  const npcMembers: TeamMember[] = (args.gameData?.社交?.关系列表 || [])
    .filter((item) => item.对象类型 === 'NPC' && item.是否队友)
    .map((item) => {
      const battleUnit = battleNpcMap.get(item.对象ID) || battleNpcMap.get(item.对象名);
      return {
        id: String(item.对象ID || item.关系ID || item.对象名),
        source: 'npc',
        name: item.对象名 || '未命名NPC',
        title: 'NPC队友',
        subTitle: `${item.关系状态 || '队友'} · 好感 ${item.好感度} / 信任 ${item.信任度}`,
        levelText: battleUnit ? `战斗中 · ${battleUnit.位置 || item.当前地点 || '未知地点'}` : `探索中 · ${item.当前地点 || '未知地点'}`,
        hp: battleUnit ? toSafeNumber(battleUnit.当前生命值) : null,
        maxHp: battleUnit ? toSafeNumber(battleUnit.最大生命值) : null,
        mp: battleUnit ? toSafeNumber(battleUnit.当前法力值) : null,
        maxMp: battleUnit ? toSafeNumber(battleUnit.最大法力值) : null,
        status: battleUnit ? (Array.isArray(battleUnit.状态效果) ? battleUnit.状态效果 : []) : [item.态度 || '正常'],
        location: battleUnit?.位置 || item.当前地点 || '未知地点'
      };
    });

  return [...playerMembers, ...npcMembers];
};

export default function TeamPanel({ roomPlayers, gameData, selfPlayerId = '', onBack }: TeamPanelProps) {
  const members = resolveTeamMembers({ roomPlayers, gameData, selfPlayerId });

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Users size={14} /> 队伍成员 ({members.length})
        </h3>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => {
          const hpPercent = clampPercent(member.hp, member.maxHp);
          const mpPercent = clampPercent(member.mp, member.maxMp);

          return (
            <motion.div
              key={`${member.source}-${member.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-zinc-900/50 border rounded-xl p-3 transition-colors ${
                member.isSelf ? 'border-cyan-600/60 hover:border-cyan-500/80' : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-700">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-zinc-200 truncate text-sm flex items-center gap-1">
                      {member.name}
                      {member.source === 'player' && member.online === false && (
                        <span className="text-[10px] text-red-400">离线</span>
                      )}
                      {member.isSelf && (
                        <span className="text-[10px] text-cyan-300">你</span>
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                      {member.levelText}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{member.subTitle}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${hpPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${mpPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-950/50 px-2 py-1 rounded">
                  <Heart size={12} className="text-emerald-500" />
                  <span>
                    HP: {member.hp ?? '--'}/{member.maxHp ?? '--'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-950/50 px-2 py-1 rounded">
                  <Zap size={12} className="text-indigo-500" />
                  <span>
                    MP: {member.mp ?? '--'}/{member.maxMp ?? '--'}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-zinc-500 flex items-center gap-1">
                <BadgeInfo size={11} />
                位置：{member.location}
              </div>

              {member.status.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {member.status.map((status: string, i: number) => (
                    <span key={`${member.id}-${i}`} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                      {status}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

