export type 任务类型 = '主线' | '支线' | '委托' | '探索' | '隐藏';
export type 任务状态 = '未接取' | '进行中' | '已完成' | '已失败' | '已放弃';

export interface 任务目标项 {
  目标ID: string;
  描述: string;
  进度: number;
  目标值: number;
  状态: string;
}

export interface 任务奖励 {
  经验: number;
  金币: number;
  物品: string[];
  声望: number;
}

export interface 任务条目 {
  任务ID: string;
  标题: string;
  描述: string;
  类型: 任务类型;
  发布者: string;
  发布地点: string;
  推荐等级: string;
  当前状态: 任务状态;
  目标列表: 任务目标项[];
  奖励: 任务奖励;
  截止时间: string | null;
  关联章节ID: string | null;
  备注: string;
}
