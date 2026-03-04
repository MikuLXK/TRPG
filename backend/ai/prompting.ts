import path from "path";
import { promises as fs } from "fs";
import type { AIFunctionType, PromptRole, RoomLike, PlayerLike } from "./types";

const CONTEXT_TEXT_LIMIT = 1200;
const PROMPT_ROOT = path.resolve(process.cwd(), "src", "prompts");

const FUNCTION_AI_ROLE_NAMES: Record<AIFunctionType, string> = {
  actionCollector: "行动统筹官·玄枢",
  mainStory: "无界叙事官·玄霄",
  stateProcessor: "状态结算官·玄衡"
};

const FUNCTION_PROMPT_ROOT: Record<AIFunctionType, string> = {
  mainStory: path.resolve(PROMPT_ROOT, "01_mainStory"),
  actionCollector: path.resolve(PROMPT_ROOT, "02_actionCollector"),
  stateProcessor: path.resolve(PROMPT_ROOT, "03_stateProcessor")
};

const SYSTEM_CATEGORY_SEQUENCE: Record<AIFunctionType, string[]> = {
  mainStory: ["00_身份", "10_世界观", "20_游戏设定", "30_数值设定_无变量操作", "40_COT", "99_其他"],
  actionCollector: ["00_身份", "10_任务定义", "20_输出格式", "30_分类COT", "99_其他"],
  stateProcessor: ["00_身份", "10_世界观", "20_游戏设定", "30_数值设定_含变量操作", "40_COT", "99_其他"]
};

const ACTION_COLLECTOR_USER_TEMPLATE_CATEGORY = "40_玩家输入模板";

const DEFAULT_ACTION_COLLECTOR_USER_TEMPLATE = `请根据以下玩家输入内容执行行动划分，并仅输出JSON。

{{actionCollectorInputJson}}`;

const DEFAULT_MAIN_STORY_USER_TEMPLATE = `请根据以下主剧情输入推进剧情，并仅输出JSON。

{{mainStoryInputJson}}`;

const DEFAULT_STATE_PROCESSOR_USER_TEMPLATE = `请根据以下状态结算输入进行数值与状态处理，并仅输出JSON。

{{stateProcessorInputJson}}`;

const readTextFileTrim = async (filePath: string) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.trim();
  } catch {
    return "";
  }
};

const listTxtFilesRecursive = async (dirPath: string): Promise<string[]> => {
  let entries: Awaited<ReturnType<typeof fs.readdir>> = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await listTxtFilesRecursive(fullPath);
      files.push(...subFiles);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".txt")) continue;
    files.push(fullPath);
  }
  files.sort((a, b) => a.localeCompare(b, "zh-CN"));
  return files;
};

const mergePromptBlocks = (parts: string[]) => parts.map((item) => item.trim()).filter(Boolean).join("\n\n");

export const fillTemplate = (template: string, values: Record<string, string>) => {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  return text;
};

export const toSingleLine = (value: string, fallback = "未命名") => {
  const normalized = String(value || "").replace(/[\r\n]+/g, " ").trim();
  return normalized || fallback;
};

export const trimTextForContext = (value: unknown, limit = CONTEXT_TEXT_LIMIT) => {
  const source = String(value || "").trim();
  if (!source) return "";
  if (source.length <= limit) return source;
  return `${source.slice(0, limit)}...(已截断)`;
};

export const stripMarkdownJsonFence = (text: string) => {
  const source = String(text || "").trim();
  if (!source.startsWith("```")) return source;
  return source.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
};

export const safeJsonParse = <T>(text: string): T | null => {
  const normalized = stripMarkdownJsonFence(text);
  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
};

const buildTemplateValues = (args: {
  room?: RoomLike;
  providerPlayer?: PlayerLike;
  functionType: AIFunctionType;
}) => {
  const { room, providerPlayer, functionType } = args;
  return {
    aiRoleName: FUNCTION_AI_ROLE_NAMES[functionType],
    playerName: toSingleLine(providerPlayer?.name || "", "默认提供者"),
    roomName: toSingleLine(room?.name || "", room?.id || "默认房间"),
    round: String(room?.currentRound ?? 0),
    functionType
  };
};

const extractCategoryTitle = (categoryDirName: string) => {
  return categoryDirName.replace(/^\d+_/, "").trim() || categoryDirName;
};

const wrapSection = (title: string, body: string) => {
  const content = body.trim();
  if (!content) return "";
  return `【${title}】\n${content}`;
};

const buildIdentityFallback = (functionType: AIFunctionType, templateValues: Record<string, string>) => {
  return [
    `你是${FUNCTION_AI_ROLE_NAMES[functionType]}。`,
    `当前提供者：${templateValues.playerName}。`,
    `当前房间：${templateValues.roomName}。`,
    `当前回合：${templateValues.round}。`,
    `当前功能：${functionType}。`
  ].join("\n");
};

const loadCategoryText = async (categoryPath: string, templateValues: Record<string, string>) => {
  const files = await listTxtFilesRecursive(categoryPath);
  if (files.length === 0) return "";
  const chunks = await Promise.all(files.map((filePath) => readTextFileTrim(filePath)));
  const renderedChunks = chunks.map((chunk) => fillTemplate(chunk, templateValues)).filter(Boolean);
  return mergePromptBlocks(renderedChunks);
};

const buildSystemPromptForFunction = async (args: {
  room: RoomLike;
  providerPlayer: PlayerLike;
  functionType: AIFunctionType;
  systemPromptOverride?: string;
}) => {
  const functionRoot = FUNCTION_PROMPT_ROOT[args.functionType];
  const categories = SYSTEM_CATEGORY_SEQUENCE[args.functionType];
  const templateValues = buildTemplateValues(args);
  const scriptSettingPrompt = trimTextForContext(args.room.script?.settingPrompt || "", 1200);
  const systemPromptOverride = String(args.systemPromptOverride || "").trim();
  const sections: string[] = [];

  for (const category of categories) {
    const categoryPath = path.resolve(functionRoot, category);
    const categoryTitle = extractCategoryTitle(category);
    const categoryText = await loadCategoryText(categoryPath, templateValues);
    const parts: string[] = [];

    if (category.startsWith("00_身份")) {
      parts.push(categoryText || buildIdentityFallback(args.functionType, templateValues));
    } else if (category.includes("世界观")) {
      // 世界观改为严格跟随所选剧本，不再注入内置世界观文本。
      if (scriptSettingPrompt) {
        parts.push(scriptSettingPrompt);
      } else {
        parts.push("当前剧本未提供世界观设定，请基于运行时上下文与既有状态谨慎推进。\n禁止臆造超出已知范围的世界观硬设定。");
      }
    } else if (category.startsWith("99_")) {
      parts.push(categoryText);
      if (systemPromptOverride) parts.push(systemPromptOverride);
    } else {
      parts.push(categoryText);
    }

    const merged = mergePromptBlocks(parts);
    if (!merged) continue;
    sections.push(wrapSection(categoryTitle, merged));
  }

  return mergePromptBlocks(sections);
};

const loadActionCollectorUserTemplate = async (args: {
  room: RoomLike;
  providerPlayer: PlayerLike;
}) => {
  const functionRoot = FUNCTION_PROMPT_ROOT.actionCollector;
  const categoryPath = path.resolve(functionRoot, ACTION_COLLECTOR_USER_TEMPLATE_CATEGORY);
  const templateValues = buildTemplateValues({
    room: args.room,
    providerPlayer: args.providerPlayer,
    functionType: "actionCollector"
  });
  const template = await loadCategoryText(categoryPath, templateValues);
  return template || DEFAULT_ACTION_COLLECTOR_USER_TEMPLATE;
};

export const buildActionCollectorPromptEnvelope = async (args: {
  room: RoomLike;
  providerPlayer: PlayerLike;
  systemPromptOverride?: string;
  userPromptOverride?: string;
  modelPromptOverride?: string;
  actionCollectorInputJson: string;
}) => {
  const userTemplate = String(args.userPromptOverride || "").trim() || await loadActionCollectorUserTemplate(args);
  const userPrompt = fillTemplate(userTemplate, {
    ...buildTemplateValues({ room: args.room, providerPlayer: args.providerPlayer, functionType: "actionCollector" }),
    actionCollectorInputJson: args.actionCollectorInputJson
  });
  const modelPromptTemplate = String(args.modelPromptOverride || "").trim();
  const systemPrompt = await buildSystemPromptForFunction({
    room: args.room,
    providerPlayer: args.providerPlayer,
    functionType: "actionCollector",
    systemPromptOverride: args.systemPromptOverride
  });

  return {
    systemPrompt,
    userPrompt,
    modelPrompt: fillTemplate(modelPromptTemplate, buildTemplateValues({ room: args.room, providerPlayer: args.providerPlayer, functionType: "actionCollector" }))
  };
};

export const buildMainStoryPromptEnvelope = async (args: {
  room: RoomLike;
  providerPlayer: PlayerLike;
  systemPromptOverride?: string;
  userPromptOverride?: string;
  modelPromptOverride?: string;
  mainStoryInputJson: string;
}) => {
  const systemPrompt = await buildSystemPromptForFunction({
    room: args.room,
    providerPlayer: args.providerPlayer,
    functionType: "mainStory",
    systemPromptOverride: args.systemPromptOverride
  });
  const userTemplate = String(args.userPromptOverride || "").trim() || DEFAULT_MAIN_STORY_USER_TEMPLATE;
  const userPrompt = fillTemplate(userTemplate, {
    ...buildTemplateValues({ room: args.room, providerPlayer: args.providerPlayer, functionType: "mainStory" }),
    mainStoryInputJson: args.mainStoryInputJson
  });
  const modelPromptTemplate = String(args.modelPromptOverride || "").trim();

  return {
    systemPrompt,
    userPrompt,
    modelPrompt: fillTemplate(modelPromptTemplate, buildTemplateValues({ room: args.room, providerPlayer: args.providerPlayer, functionType: "mainStory" }))
  };
};

export const buildStateProcessorPromptEnvelope = async (args: {
  room: RoomLike;
  providerPlayer: PlayerLike;
  systemPromptOverride?: string;
  userPromptOverride?: string;
  modelPromptOverride?: string;
  stateProcessorInputJson: string;
}) => {
  const systemPrompt = await buildSystemPromptForFunction({
    room: args.room,
    providerPlayer: args.providerPlayer,
    functionType: "stateProcessor",
    systemPromptOverride: args.systemPromptOverride
  });
  const userTemplate = String(args.userPromptOverride || "").trim() || DEFAULT_STATE_PROCESSOR_USER_TEMPLATE;
  const userPrompt = fillTemplate(userTemplate, {
    ...buildTemplateValues({ room: args.room, providerPlayer: args.providerPlayer, functionType: "stateProcessor" }),
    stateProcessorInputJson: args.stateProcessorInputJson
  });
  const modelPromptTemplate = String(args.modelPromptOverride || "").trim();

  return {
    systemPrompt,
    userPrompt,
    modelPrompt: fillTemplate(modelPromptTemplate, buildTemplateValues({ room: args.room, providerPlayer: args.providerPlayer, functionType: "stateProcessor" }))
  };
};

const getDefaultTemplateRoom = (): RoomLike => ({
  id: "default-room",
  name: "默认房间",
  intro: "",
  currentRound: 0,
  logs: [],
  players: [],
  functionRotationIndex: {
    actionCollector: 0,
    mainStory: 0,
    stateProcessor: 0
  },
  script: {}
});

const getDefaultTemplateProvider = (): PlayerLike => ({
  id: "default-player",
  name: "默认提供者",
  action: "",
  location: "",
  currentHP: 0,
  currentMP: 0,
  statusEffects: [],
  aiSettings: {
    defaultProvider: "openaiCompatible",
    defaultEndpoint: "",
    defaultApiKey: "",
    actionCollector: {
      connection: { provider: "", endpoint: "", apiKey: "", model: "" },
      prompt: { systemPrompt: "", temperature: 0.3 }
    },
    mainStory: {
      connection: { provider: "", endpoint: "", apiKey: "", model: "" },
      prompt: { systemPrompt: "", temperature: 0.7 }
    },
    stateProcessor: {
      connection: { provider: "", endpoint: "", apiKey: "", model: "" },
      prompt: { systemPrompt: "", temperature: 0.1 }
    }
  },
  apiFunctions: {
    actionCollector: true,
    mainStory: true,
    stateProcessor: true
  }
});

export const readPromptFile = async (functionType: AIFunctionType, role: PromptRole): Promise<string> => {
  const defaultRoom = getDefaultTemplateRoom();
  const defaultProvider = getDefaultTemplateProvider();

  if (role === "model") return "";
  if (role === "user") {
    if (functionType === "actionCollector") {
      return loadActionCollectorUserTemplate({
        room: defaultRoom,
        providerPlayer: defaultProvider
      });
    }
    if (functionType === "mainStory") return DEFAULT_MAIN_STORY_USER_TEMPLATE;
    return DEFAULT_STATE_PROCESSOR_USER_TEMPLATE;
  }

  return buildSystemPromptForFunction({
    room: defaultRoom,
    providerPlayer: defaultProvider,
    functionType
  });
};
