export type 日志类型 = '独白' | '对话' | '旁白' | '判定' | '系统' | 'OOC';

export interface 角色属性 {
  力量: number;
  敏捷: number;
  体质: number;
  智力: number;
  感知: number;
  魅力: number;
}

export interface 游戏日志 {
  id: string;
  发送者: string;
  内容: string;
  类型: 日志类型;
  时间戳: string;
  回合?: number;
}
