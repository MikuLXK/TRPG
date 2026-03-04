export type 记忆压缩来源层 = '短期' | '中期';
export type 记忆压缩目标层 = '中期' | '长期';

export interface 回忆档案条目 {
  名称: string;
  概括: string;
  原文: string;
  回合: number;
  记录时间: string;
}

export interface 记忆系统结构 {
  回忆档案: 回忆档案条目[];
  即时记忆: string[];
  短期记忆: string[];
  中期记忆: string[];
  长期记忆: string[];
}

export interface 记忆压缩任务 {
  id: string;
  来源层: 记忆压缩来源层;
  目标层: 记忆压缩目标层;
  批次: string[];
  批次条数: number;
  起始时间: string;
  结束时间: string;
}

