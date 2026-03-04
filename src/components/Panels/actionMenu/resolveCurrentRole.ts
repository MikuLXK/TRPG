import type { 游戏状态, 玩家角色 } from '../../../types/gameData';

export const resolveCurrentRole = (gameData: 游戏状态): 玩家角色 | null => {
  const currentId = gameData.角色.当前主控角色ID;
  return gameData.角色.玩家角色列表.find((role) => role.玩家ID === currentId || role.角色ID === currentId) || gameData.角色.玩家角色列表[0] || null;
};
