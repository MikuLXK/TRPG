import type { 环境结构 } from '../environment/types';
import type { 玩家角色, 角色结构 } from '../character/types';
import type { 社交结构 } from '../social/types';
import type { 战斗结构 } from '../combat/types';
import type { 剧情结构 } from '../story/types';
import type { 任务条目 } from '../task/types';
import type { 约定条目 } from '../agreement/types';
import type { 记忆系统结构 } from '../memory/types';
import type { 游戏日志, 角色属性 } from '../shared/common';

export interface TRPGSaveData {
  环境: 环境结构;
  角色: 角色结构;
  玩家1: 玩家角色 | null;
  玩家2: 玩家角色 | null;
  玩家3: 玩家角色 | null;
  玩家4: 玩家角色 | null;
  社交: 社交结构;
  战斗: 战斗结构;
  剧情: 剧情结构;
  记忆系统: 记忆系统结构;
  任务列表: 任务条目[];
  约定列表: 约定条目[];
  日志列表: 游戏日志[];
}

export interface 角色信息 {
  姓名: string;
  职业: string;
  等级: number;
  生命值: number;
  最大生命值: number;
  法力值: number;
  最大法力值: number;
  属性: 角色属性;
  状态: string[];
  背景故事: string;
}

export interface 游戏世界观 {
  名称: string;
  描述: string;
  当前时间: string;
  当前地点: string;
  当前章节: string;
  当前回合: number;
}

export interface 游戏状态 extends TRPGSaveData {
  玩家: 角色信息;
  世界: 游戏世界观;
}

const 空属性 = (): 角色属性 => ({
  力量: 0,
  敏捷: 0,
  体质: 0,
  智力: 0,
  感知: 0,
  魅力: 0
});

const 空角色信息 = (): 角色信息 => ({
  姓名: '',
  职业: '',
  等级: 1,
  生命值: 0,
  最大生命值: 1,
  法力值: 0,
  最大法力值: 1,
  属性: 空属性(),
  状态: [],
  背景故事: ''
});

const 空游戏世界观 = (): 游戏世界观 => ({
  名称: '',
  描述: '',
  当前时间: '',
  当前地点: '',
  当前章节: '',
  当前回合: 1
});

export const 初始游戏状态: 游戏状态 = {
  环境: {
    年: 1,
    月: 1,
    日: 1,
    时: 8,
    分: 0,
    星期: '',
    游戏天数: 1,
    当前回合: 1,
    大地点: '',
    中地点: '',
    小地点: '',
    具体地点: '',
    天气: null,
    场景标签: [],
    环境效果: []
  },
  角色: {
    玩家角色列表: [],
    当前主控角色ID: ''
  },
  玩家1: null,
  玩家2: null,
  玩家3: null,
  玩家4: null,
  社交: {
    关系列表: []
  },
  战斗: {
    是否战斗中: false,
    战斗ID: null,
    战斗名称: '',
    阶段: '未开始',
    当前回合: 0,
    战场: {
      地点: '',
      地形: '',
      特殊规则: []
    },
    玩家方: [],
    敌方: [],
    中立方: [],
    行动队列: [],
    回合日志: [],
    胜负状态: '未分胜负'
  },
  剧情: {
    当前章节: {
      章节ID: '',
      序号: 1,
      标题: '',
      背景: '',
      当前阶段: '',
      目标: [],
      失败条件: []
    },
    主线目标: {
      最终目标: '',
      当前进度: '',
      阶段目标: []
    },
    当前回合总述: '',
    分组叙事: [],
    玩家行动提示: [],
    线索列表: [],
    待触发事件: [],
    已发生事件: [],
    历史卷宗: []
  },
  记忆系统: {
    回忆档案: [],
    即时记忆: [],
    短期记忆: [],
    中期记忆: [],
    长期记忆: []
  },
  任务列表: [],
  约定列表: [],
  日志列表: [],
  玩家: 空角色信息(),
  世界: 空游戏世界观()
};
