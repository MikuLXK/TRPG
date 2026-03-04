import type { 记忆系统结构, 记忆压缩任务, 记忆压缩来源层 } from '../types/gameData';
import type { MemorySettingsConfig } from '../types/Settings';

export const 即时短期分隔标记 = '\n<<SHORT_TERM_SYNC>>\n';

export const 创建空记忆系统 = (): 记忆系统结构 => ({
  回忆档案: [],
  即时记忆: [],
  短期记忆: [],
  中期记忆: [],
  长期记忆: []
});

export const 规范化记忆系统 = (raw?: Partial<记忆系统结构> | null): 记忆系统结构 => ({
  回忆档案: Array.isArray(raw?.回忆档案) ? [...raw!.回忆档案] : [],
  即时记忆: Array.isArray(raw?.即时记忆) ? [...raw!.即时记忆] : [],
  短期记忆: Array.isArray(raw?.短期记忆) ? [...raw!.短期记忆] : [],
  中期记忆: Array.isArray(raw?.中期记忆) ? [...raw!.中期记忆] : [],
  长期记忆: Array.isArray(raw?.长期记忆) ? [...raw!.长期记忆] : []
});

export const 规范化记忆任务 = (raw?: Partial<记忆压缩任务> | null): 记忆压缩任务 | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const 来源层 = raw.来源层 === '中期' ? '中期' : raw.来源层 === '短期' ? '短期' : null;
  const 目标层 = raw.目标层 === '长期' ? '长期' : raw.目标层 === '中期' ? '中期' : null;
  const 批次 = Array.isArray(raw.批次) ? raw.批次.map((item) => String(item || '').trim()).filter(Boolean) : [];
  const 批次条数 = Math.max(1, Number(raw.批次条数) || 批次.length || 1);
  const 起始时间 = String(raw.起始时间 || '').trim() || '未知时间';
  const 结束时间 = String(raw.结束时间 || '').trim() || '未知时间';
  if (!id || !来源层 || !目标层 || 批次.length === 0) return null;
  return { id, 来源层, 目标层, 批次, 批次条数, 起始时间, 结束时间 };
};

export const 规范化记忆配置 = (raw?: Partial<MemorySettingsConfig> | null): MemorySettingsConfig => ({
  即时记忆上限: Math.max(3, Number(raw?.即时记忆上限) || 10),
  短期记忆阈值: Math.max(5, Number(raw?.短期记忆阈值) || 30),
  中期记忆阈值: Math.max(20, Number(raw?.中期记忆阈值) || 50),
  即时记忆注入条数: Math.max(0, Math.min(30, Number(raw?.即时记忆注入条数) || 8)),
  短期记忆注入条数: Math.max(0, Math.min(40, Number(raw?.短期记忆注入条数) || 12)),
  短期转中期提示词: String(raw?.短期转中期提示词 || '').trim(),
  中期转长期提示词: String(raw?.中期转长期提示词 || '').trim()
});

export const 拆分即时与短期 = (entry: string): { 即时内容: string; 短期摘要: string } => {
  const raw = String(entry || '').trim();
  if (!raw) return { 即时内容: '', 短期摘要: '' };
  const splitAt = raw.lastIndexOf(即时短期分隔标记);
  if (splitAt < 0) return { 即时内容: raw, 短期摘要: '' };
  return {
    即时内容: raw.slice(0, splitAt).trim(),
    短期摘要: raw.slice(splitAt + 即时短期分隔标记.length).trim()
  };
};

export const 记忆层标签 = (layer: 记忆压缩来源层 | '长期') => {
  if (layer === '短期') return '短期记忆';
  if (layer === '中期') return '中期记忆';
  return '长期记忆';
};

export const 构建记忆总结用户提示词 = (task: 记忆压缩任务, config: MemorySettingsConfig) => {
  const sourceLabel = 记忆层标签(task.来源层);
  const targetLabel = 记忆层标签(task.目标层);
  const template = task.来源层 === '短期' ? config.短期转中期提示词 : config.中期转长期提示词;
  const batchText = task.批次.map((item, index) => `${index + 1}. ${item}`).join('\n');
  return [
    template,
    '',
    `请将以下${sourceLabel}压缩为1条${targetLabel}摘要：`,
    `时间范围：${task.起始时间} - ${task.结束时间}`,
    `条目数量：${task.批次条数}`,
    '',
    batchText
  ].join('\n').trim();
};

export const 清理记忆总结输出 = (rawText: string) => {
  const text = String(rawText || '').trim();
  if (!text.startsWith('```')) return text;
  return text.replace(/^```(?:text|markdown|md)?/i, '').replace(/```$/i, '').trim();
};

