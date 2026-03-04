export const IMMEDIATE_SHORT_SEPARATOR = "\n<<SHORT_TERM_SYNC>>\n";

export interface RoomMemoryConfig {
  immediateLimit: number;
  shortThreshold: number;
  midThreshold: number;
  immediateInjectCount: number;
  shortInjectCount: number;
  shortToMidPrompt: string;
  midToLongPrompt: string;
}

export interface RoomMemoryRecall {
  名称: string;
  概括: string;
  原文: string;
  回合: number;
  记录时间: string;
}

export interface RoomMemorySystem {
  回忆档案: RoomMemoryRecall[];
  即时记忆: string[];
  短期记忆: string[];
  中期记忆: string[];
  长期记忆: string[];
}

export interface RoomMemoryTask {
  id: string;
  来源层: "短期" | "中期";
  目标层: "中期" | "长期";
  批次: string[];
  批次条数: number;
  起始时间: string;
  结束时间: string;
}

const extractTimeList = (text: string): string[] => {
  const source = String(text || "");
  return source.match(/\d{1,6}:\d{2}:\d{2}:\d{2}:\d{2}/g) || [];
};

const extractTimeRangeFromBatch = (batch: string[]): { startTime: string; endTime: string } => {
  const times = batch.flatMap((item) => extractTimeList(item)).filter(Boolean);
  if (times.length === 0) {
    return { startTime: "未知时间", endTime: "未知时间" };
  }
  return {
    startTime: times[0],
    endTime: times[times.length - 1]
  };
};

const splitImmediateAndShort = (entry: string): { immediateText: string; shortText: string } => {
  const text = String(entry || "").trim();
  if (!text) return { immediateText: "", shortText: "" };
  const splitAt = text.lastIndexOf(IMMEDIATE_SHORT_SEPARATOR);
  if (splitAt < 0) return { immediateText: text, shortText: "" };
  return {
    immediateText: text.slice(0, splitAt).trim(),
    shortText: text.slice(splitAt + IMMEDIATE_SHORT_SEPARATOR.length).trim()
  };
};

const mergeImmediateAndShort = (immediateText: string, shortText: string) => {
  const full = String(immediateText || "").trim();
  const summary = String(shortText || "").trim();
  if (!summary) return full;
  return `${full}${IMMEDIATE_SHORT_SEPARATOR}${summary}`;
};

const buildTaskId = (sourceLayer: "短期" | "中期", batch: string[], startTime: string, endTime: string) => {
  const head = String(batch[0] || "").slice(0, 80);
  return `${sourceLayer}|${batch.length}|${startTime}|${endTime}|${head}`;
};

export const createDefaultRoomMemoryConfig = (): RoomMemoryConfig => ({
  immediateLimit: 10,
  shortThreshold: 30,
  midThreshold: 50,
  immediateInjectCount: 8,
  shortInjectCount: 12,
  shortToMidPrompt: `你负责将“短期记忆”压缩为“中期记忆”。
要求：
1. 保留关键事实：地点变化、人物关系变化、关键冲突、阶段性结果。
2. 使用上帝视角总结，避免重复细节。
3. 输出 120~220 字中文摘要，不要使用列表。`,
  midToLongPrompt: `你负责将“中期记忆”压缩为“长期记忆”。
要求：
1. 提炼长期有效的信息：主线推进、关键人物关系、世界状态变化、后续伏笔。
2. 删除短期噪声，强调因果与影响。
3. 输出 120~260 字中文摘要，不要使用列表。`
});

export const normalizeRoomMemoryConfig = (raw?: Partial<RoomMemoryConfig> | null): RoomMemoryConfig => {
  const defaults = createDefaultRoomMemoryConfig();
  const source = (raw || {}) as Record<string, unknown>;
  const immediateRaw = source.immediateLimit ?? source["即时记忆上限"];
  const shortRaw = source.shortThreshold ?? source["短期记忆阈值"];
  const midRaw = source.midThreshold ?? source["中期记忆阈值"];
  const immediateInjectRaw = source.immediateInjectCount ?? source["即时记忆注入条数"];
  const shortInjectRaw = source.shortInjectCount ?? source["短期记忆注入条数"];
  const shortPromptRaw = source.shortToMidPrompt ?? source["短期转中期提示词"];
  const midPromptRaw = source.midToLongPrompt ?? source["中期转长期提示词"];
  return {
    immediateLimit: Math.max(3, Number(immediateRaw) || defaults.immediateLimit),
    shortThreshold: Math.max(5, Number(shortRaw) || defaults.shortThreshold),
    midThreshold: Math.max(20, Number(midRaw) || defaults.midThreshold),
    immediateInjectCount: Math.max(0, Math.min(30, Number(immediateInjectRaw) || defaults.immediateInjectCount)),
    shortInjectCount: Math.max(0, Math.min(40, Number(shortInjectRaw) || defaults.shortInjectCount)),
    shortToMidPrompt: String(shortPromptRaw || defaults.shortToMidPrompt).trim(),
    midToLongPrompt: String(midPromptRaw || defaults.midToLongPrompt).trim()
  };
};

export const createEmptyRoomMemorySystem = (): RoomMemorySystem => ({
  回忆档案: [],
  即时记忆: [],
  短期记忆: [],
  中期记忆: [],
  长期记忆: []
});

export const normalizeRoomMemorySystem = (raw?: Partial<RoomMemorySystem> | null): RoomMemorySystem => ({
  回忆档案: Array.isArray(raw?.回忆档案) ? [...raw!.回忆档案] : [],
  即时记忆: Array.isArray(raw?.即时记忆) ? [...raw!.即时记忆] : [],
  短期记忆: Array.isArray(raw?.短期记忆) ? [...raw!.短期记忆] : [],
  中期记忆: Array.isArray(raw?.中期记忆) ? [...raw!.中期记忆] : [],
  长期记忆: Array.isArray(raw?.长期记忆) ? [...raw!.长期记忆] : []
});

export const writeRoomMemory = (args: {
  memory: RoomMemorySystem;
  config: RoomMemoryConfig;
  immediateEntry: string;
  shortEntry: string;
  recordTime: string;
  round: number;
}) => {
  const next = normalizeRoomMemorySystem(args.memory);
  const full = String(args.immediateEntry || "").trim();
  const summary = String(args.shortEntry || "").trim();
  if (!full && !summary) return next;

  if (full) {
    next.即时记忆.push(mergeImmediateAndShort(full, summary));
  } else if (summary) {
    next.短期记忆.push(summary);
  }

  next.回忆档案.push({
    名称: `【回忆${String(Math.max(1, args.round)).padStart(3, "0")}】`,
    概括: summary,
    原文: full,
    回合: Math.max(1, args.round),
    记录时间: args.recordTime || "未知时间"
  });

  while (next.即时记忆.length > args.config.immediateLimit) {
    const shifted = next.即时记忆.shift();
    if (!shifted) continue;
    const { shortText } = splitImmediateAndShort(shifted);
    if (shortText) next.短期记忆.push(shortText);
  }

  return next;
};

export const buildMemoryTask = (memoryBase: RoomMemorySystem, configBase: RoomMemoryConfig): RoomMemoryTask | null => {
  const memory = normalizeRoomMemorySystem(memoryBase);
  const config = normalizeRoomMemoryConfig(configBase);

  if (memory.短期记忆.length > config.shortThreshold) {
    const batch = memory.短期记忆.slice(0, config.shortThreshold);
    const { startTime, endTime } = extractTimeRangeFromBatch(batch);
    return {
      id: buildTaskId("短期", batch, startTime, endTime),
      来源层: "短期",
      目标层: "中期",
      批次: batch,
      批次条数: batch.length,
      起始时间: startTime,
      结束时间: endTime
    };
  }

  if (memory.中期记忆.length > config.midThreshold) {
    const batch = memory.中期记忆.slice(0, config.midThreshold);
    const { startTime, endTime } = extractTimeRangeFromBatch(batch);
    return {
      id: buildTaskId("中期", batch, startTime, endTime),
      来源层: "中期",
      目标层: "长期",
      批次: batch,
      批次条数: batch.length,
      起始时间: startTime,
      结束时间: endTime
    };
  }

  return null;
};

export const applyMemorySummary = (args: {
  memory: RoomMemorySystem;
  task: RoomMemoryTask;
  summaryText: string;
}) => {
  const next = normalizeRoomMemorySystem(args.memory);
  const sourceList = args.task.来源层 === "短期" ? next.短期记忆 : next.中期记忆;
  const targetList = args.task.目标层 === "中期" ? next.中期记忆 : next.长期记忆;
  const removeCount = Math.max(1, Number(args.task.批次条数) || args.task.批次.length || 1);
  sourceList.splice(0, Math.min(removeCount, sourceList.length));
  const summary = String(args.summaryText || "").trim();
  if (summary) targetList.push(summary);
  return next;
};

export const buildMemorySummaryUserPrompt = (task: RoomMemoryTask, config: RoomMemoryConfig) => {
  const template = task.来源层 === "短期" ? config.shortToMidPrompt : config.midToLongPrompt;
  const sourceLabel = task.来源层 === "短期" ? "短期记忆" : "中期记忆";
  const targetLabel = task.目标层 === "中期" ? "中期记忆" : "长期记忆";
  const batchText = task.批次.map((item, index) => `${index + 1}. ${item}`).join("\n");
  return [
    template,
    "",
    `请将以下${sourceLabel}压缩为1条${targetLabel}摘要：`,
    `时间范围：${task.起始时间} - ${task.结束时间}`,
    `条目数量：${task.批次条数}`,
    "",
    batchText
  ].join("\n").trim();
};

export const cleanupSummaryOutput = (rawText: string) => {
  const text = String(rawText || "").trim();
  if (!text.startsWith("```")) return text;
  return text.replace(/^```(?:text|markdown|md)?/i, "").replace(/```$/i, "").trim();
};

const toCanonicalGameTime = (env: any) => {
  const year = Number(env?.年);
  const month = Number(env?.月);
  const day = Number(env?.日);
  const hour = Number(env?.时);
  const minute = Number(env?.分);
  if (![year, month, day, hour, minute].every((item) => Number.isFinite(item))) return "";
  return `${Math.floor(year)}:${String(Math.floor(month)).padStart(2, "0")}:${String(Math.floor(day)).padStart(2, "0")}:${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor(minute)).padStart(2, "0")}`;
};

const toNowCanonical = () => {
  const now = new Date();
  return `${now.getFullYear()}:${String(now.getMonth() + 1).padStart(2, "0")}:${String(now.getDate()).padStart(2, "0")}:${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

export const buildRoundMemoryEntries = (args: {
  room: any;
  storyPayload: {
    globalSummary?: string;
    shortTerm?: string;
  };
}) => {
  const round = Number(args.room?.currentRound) || 1;
  const openingTime = toCanonicalGameTime((args.room as any)?.script?.opening?.initialState?.环境 || {});
  const timeText = round <= 1 ? (openingTime || toNowCanonical()) : toNowCanonical();
  const globalSummary = String(args.storyPayload?.globalSummary || "").trim();
  const shortTerm = String(args.storyPayload?.shortTerm || "").trim();
  const fallbackSummary = "本回合剧情已推进。";

  const immediateEntry = [
    `【${timeText}】第${round}回合`,
    `剧情总述：${globalSummary || fallbackSummary}`
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  const shortEntryBase = shortTerm || globalSummary || fallbackSummary;
  const shortEntry = `【${timeText}】${shortEntryBase.replace(/\s+/g, " ").trim()}`.trim();

  return { immediateEntry, shortEntry, round, timeText };
};
