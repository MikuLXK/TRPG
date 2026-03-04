import type { 角色属性 } from '../shared/common';

export interface 角色物品 {
  物品ID: string;
  名称: string;
  描述: string;
  类型: string;
  品质: string;
  数量: number;
  是否可堆叠: boolean;
  重量: number;
  价值: number;
  当前耐久: number;
  最大耐久: number;
  可用次数: number;
  装备槽位: string | null;
  使用效果: string[];
  标签: string[];
}

export type 技能分类 = '法术' | '战技' | '被动' | '职业技能' | '种族特性';
export type 技能消耗类型 = '法力' | '体力' | '次数' | '无';

export interface 角色技能 {
  技能ID: string;
  名称: string;
  描述: string;
  分类: 技能分类;
  品质: string;
  等级需求: number;
  消耗类型: 技能消耗类型;
  消耗数值: number;
  冷却回合: number;
  当前冷却: number;
  施放距离: string;
  目标类型: string;
  判定属性: string;
  基础效果: string;
  伤害类型: string;
  伤害公式: string;
  附加效果: string[];
  标签: string[];
}

export type BUFF类型 = '增益' | '减益' | '中性';

export interface 玩家BUFF {
  BUFFID: string;
  名称: string;
  来源: string;
  类型: BUFF类型;
  描述: string;
  层数: number;
  持续回合: number;
  剩余回合: number;
  效果: string;
  可驱散: boolean;
  到期行为: string;
}

export interface 角色装备 {
  头部: string;
  胸部: string;
  手部: string;
  腿部: string;
  足部: string;
  主手: string;
  副手: string;
  饰品: string;
}

export interface 玩家角色 {
  玩家序号: number;
  角色ID: string;
  玩家ID: string;
  玩家名: string;
  角色名: string;
  职业: string;
  种族: string;
  性别: string;
  背景: string;
  等级: number;
  当前经验: number;
  升级经验: number;
  位置: string;
  当前生命值: number;
  最大生命值: number;
  当前法力值: number;
  最大法力值: number;
  属性: 角色属性;
  状态效果: string[];
  装备: 角色装备;
  物品列表: 角色物品[];
  技能列表: 角色技能[];
  玩家BUFF: 玩家BUFF[];
}

export interface 角色结构 {
  玩家角色列表: 玩家角色[];
  当前主控角色ID: string;
}
