import path from "path";
import { promises as fs } from "fs";
import type { AIFunctionType, CorePromptType, PromptRole, RoomLike, PlayerLike } from "./types";

const CORE_PROMPT_SEQUENCE: CorePromptType[] = ["data", "cot", "format"];
const CONTEXT_TEXT_LIMIT = 1200;

const FUNCTION_AI_ROLE_NAMES: Record<AIFunctionType, string> = {
  actionCollector: "行动统筹官·玄枢",
  mainStory: "无界叙事官·玄霄",
  stateProcessor: "状态结算官·玄衡"
};

const getPromptPath = (functionType: AIFunctionType, role: PromptRole) => {
  return path.resolve(process.cwd(), "src", "prompts", functionType, `${role}.txt`);
};

const getCorePromptPath = (name: CorePromptType) => {
  return path.resolve(process.cwd(), "src", "prompts", "core", `${name}.txt`);
};

export const readPromptFile = async (functionType: AIFunctionType, role: PromptRole): Promise<string> => {
  const promptPath = getPromptPath(functionType, role);
  try {
    const content = await fs.readFile(promptPath, "utf-8");
    return content.trim();
  } catch {
    return "";
  }
};

const readCorePromptFile = async (name: CorePromptType): Promise<string> => {
  const promptPath = getCorePromptPath(name);
  try {
    const content = await fs.readFile(promptPath, "utf-8");
    return content.trim();
  } catch {
    return "";
  }
};

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

const loadSharedCorePromptText = async () => {
  const promptList = await Promise.all(CORE_PROMPT_SEQUENCE.map((name) => readCorePromptFile(name)));
  return promptList.filter(Boolean).join("\n\n");
};

const buildIdentityPrompt = async (room: RoomLike, providerPlayer: PlayerLike, functionType: AIFunctionType) => {
  const identityTemplate = await readCorePromptFile("identity");
  if (!identityTemplate) return "";
  return fillTemplate(identityTemplate, {
    aiRoleName: FUNCTION_AI_ROLE_NAMES[functionType],
    playerName: toSingleLine(providerPlayer.name, "未命名"),
    roomName: toSingleLine(room.name, room.id),
    round: String(room.currentRound),
    functionType
  });
};

export const buildPromptEnvelope = async (args: {
  room: RoomLike;
  providerPlayer: PlayerLike;
  functionType: AIFunctionType;
  systemPromptBase: string;
  userPromptBody: string;
  modelPromptBody: string;
}) => {
  const [identityPrompt, corePromptText, cotPseudoPrompt] = await Promise.all([
    buildIdentityPrompt(args.room, args.providerPlayer, args.functionType),
    loadSharedCorePromptText(),
    readCorePromptFile("cotPseudo")
  ]);

  return {
    systemPrompt: [identityPrompt, args.systemPromptBase, corePromptText].filter(Boolean).join("\n\n"),
    userPrompt: [args.userPromptBody, cotPseudoPrompt].filter(Boolean).join("\n\n"),
    modelPrompt: args.modelPromptBody
  };
};
