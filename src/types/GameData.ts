export interface 角色属性 {
  力量: number;
  敏捷: number;
  智力: number;
  体质: number;
  魅力: number;
  感知: number;
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

export interface 游戏日志 {
  id: string;
  发送者: string;
  内容: string;
  类型: '独白' | '对话' | '旁白' | '判定' | '系统' | 'OOC';
  时间戳: string;
}

export interface 游戏世界观 {
  名称: string;
  描述: string;
  当前时间: string;
  当前地点: string;
  当前章节: string;
  当前回合: number;
}

export interface 游戏状态 {
  玩家: 角色信息;
  世界: 游戏世界观;
  日志列表: 游戏日志[];
}

export const 初始游戏状态: 游戏状态 = {
  玩家: {
    姓名: "",
    职业: "",
    等级: 1,
    生命值: 0,
    最大生命值: 1,
    法力值: 0,
    最大法力值: 1,
    属性: {
      力量: 0,
      敏捷: 0,
      智力: 0,
      体质: 0,
      魅力: 0,
      感知: 0
    },
    状态: [],
    背景故事: ""
  },
  世界: {
    名称: "",
    描述: "",
    当前时间: "",
    当前地点: "",
    当前章节: "",
    当前回合: 1
  },
  日志列表: []
};
