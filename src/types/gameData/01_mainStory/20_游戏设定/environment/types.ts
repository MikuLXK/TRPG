export interface 环境天气 {
  类型: string;
  强度: string;
  // 时间格式：YYYY:MM:DD:HH:MM
  结束时间: string;
}

export interface 环境效果 {
  名称: string;
  描述: string;
  效果: string;
  剩余回合: number;
}

export interface 环境结构 {
  年: number;
  月: number;
  日: number;
  时: number;
  分: number;
  星期: string;
  游戏天数: number;
  当前回合: number;
  大地点: string;
  中地点: string;
  小地点: string;
  具体地点: string;
  天气: 环境天气 | null;
  场景标签: string[];
  环境效果: 环境效果[];
}
