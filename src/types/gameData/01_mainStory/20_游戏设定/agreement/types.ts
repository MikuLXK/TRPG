export type 约定性质 = '盟约' | '交易' | '誓言' | '护送' | '停战' | '其他';
export type 约定状态 = '未生效' | '生效中' | '已履行' | '已违约' | '已失效';

export interface 约定条目 {
  约定ID: string;
  对象ID: string;
  对象名: string;
  性质: 约定性质;
  标题: string;
  约定内容: string;
  约定地点: string;
  约定时间: string;
  生效条件: string;
  当前状态: 约定状态;
  履行奖励: string;
  违约后果: string;
  背景备注: string;
}
