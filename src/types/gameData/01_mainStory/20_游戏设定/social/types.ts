export type 社交对象类型 = '玩家' | 'NPC' | '势力';

export interface 社交记忆 {
  内容: string;
  时间: string;
  来源: string;
}

export interface 社交关系 {
  关系ID: string;
  对象ID: string;
  对象名: string;
  对象类型: 社交对象类型;
  是否队友: boolean;
  关系状态: string;
  好感度: number;
  信任度: number;
  态度: string;
  当前地点: string;
  简介: string;
  已知信息: string[];
  记忆: 社交记忆[];
}

export interface 社交结构 {
  关系列表: 社交关系[];
}
