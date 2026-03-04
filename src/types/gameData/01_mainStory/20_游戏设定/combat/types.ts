export type 战斗阶段 = '未开始' | '准备' | '进行中' | '结算';
export type 战斗胜负状态 = '未分胜负' | '玩家胜利' | '玩家失败' | '撤离' | '中断';
export type 战斗阵营 = '玩家方' | '敌方' | '中立方';
export type 战斗单位类型 = '玩家' | 'NPC' | '怪物';

export interface 战斗单位 {
  单位ID: string;
  名称: string;
  阵营: 战斗阵营;
  类型: 战斗单位类型;
  位置: string;
  当前生命值: number;
  最大生命值: number;
  当前法力值: number;
  最大法力值: number;
  护甲值: number;
  抗性: string[];
  易伤: string[];
  免疫: string[];
  状态效果: string[];
  可用技能ID列表: string[];
  备注: string;
}

export interface 战斗行动队列项 {
  单位ID: string;
  先攻值: number;
  是否已行动: boolean;
}

export interface 战斗回合日志项 {
  回合: number;
  事件: string;
  结果: string;
}

export interface 战斗结构 {
  是否战斗中: boolean;
  战斗ID: string | null;
  战斗名称: string;
  阶段: 战斗阶段;
  当前回合: number;
  战场: {
    地点: string;
    地形: string;
    特殊规则: string[];
  };
  玩家方: 战斗单位[];
  敌方: 战斗单位[];
  中立方: 战斗单位[];
  行动队列: 战斗行动队列项[];
  回合日志: 战斗回合日志项[];
  胜负状态: 战斗胜负状态;
}
