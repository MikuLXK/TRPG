import type { 游戏状态, 玩家角色 } from '../../../types/gameData';

export const resolveCurrentRole = (gameData: 游戏状态): 玩家角色 | null => {
  const currentId = gameData.角色.当前主控角色ID;
  const list = Array.isArray(gameData.角色.玩家角色列表) ? gameData.角色.玩家角色列表 : [];
  const slotRoles = [gameData.玩家1, gameData.玩家2, gameData.玩家3, gameData.玩家4].filter(Boolean) as 玩家角色[];
  const merged = [...list, ...slotRoles];
  const map = new Map<string, 玩家角色>();
  merged.forEach((role, index) => {
    const key = String(role.玩家ID || role.角色ID || role.玩家序号 || `idx-${index}`);
    if (!map.has(key)) map.set(key, role);
  });
  const roles = Array.from(map.values());
  return roles.find((role) => role.玩家ID === currentId || role.角色ID === currentId) || roles[0] || null;
};
