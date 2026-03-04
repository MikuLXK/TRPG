export interface 当前章节结构 {
  章节ID: string;
  序号: number;
  标题: string;
  背景: string;
  当前阶段: string;
  目标: string[];
  失败条件: string[];
}

export interface 主线阶段目标 {
  名称: string;
  进度: string;
  状态: string;
}

export interface 主线目标结构 {
  最终目标: string;
  当前进度: string;
  阶段目标: 主线阶段目标[];
}

export interface 分组叙事项 {
  分组ID: string;
  可见玩家ID: string[];
  标题: string;
  内容: string;
}

export interface 玩家行动提示项 {
  玩家ID: string;
  提示: string;
}

export type 线索状态 = '未发现' | '已发现' | '已验证';

export interface 线索项 {
  线索ID: string;
  标题: string;
  内容: string;
  来源: string;
  状态: 线索状态;
}

export interface 待触发事件项 {
  事件ID: string;
  名称: string;
  描述: string;
  触发条件: string;
  失效条件: string;
  状态: string;
}

export interface 已发生事件项 {
  事件ID: string;
  名称: string;
  内容: string;
  影响: string;
  时间: string;
}

export interface 历史卷宗项 {
  标题: string;
  结语: string;
  记录时间: string;
}

export interface 剧情结构 {
  当前章节: 当前章节结构;
  主线目标: 主线目标结构;
  当前回合总述: string;
  分组叙事: 分组叙事项[];
  玩家行动提示: 玩家行动提示项[];
  线索列表: 线索项[];
  待触发事件: 待触发事件项[];
  已发生事件: 已发生事件项[];
  历史卷宗: 历史卷宗项[];
}
