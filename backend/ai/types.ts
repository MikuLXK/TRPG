export type AIFunctionType = "actionCollector" | "mainStory" | "stateProcessor";
export type PromptRole = "system" | "user" | "model";
export type CorePromptType = "identity" | "cotPseudo" | "data" | "cot" | "format";
export type AIProviderType = "openai" | "gemini" | "deepseek" | "claude" | "openaiCompatible";

export interface AIConnectionConfig {
  provider: AIProviderType | "";
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface AIPromptConfig {
  systemPrompt: string;
  userPrompt?: string;
  modelPrompt?: string;
  temperature: number;
}

export interface PlayerAISettings {
  defaultProvider: AIProviderType;
  defaultEndpoint: string;
  defaultApiKey: string;
  actionCollector: { connection: AIConnectionConfig; prompt: AIPromptConfig };
  mainStory: { connection: AIConnectionConfig; prompt: AIPromptConfig };
  stateProcessor: { connection: AIConnectionConfig; prompt: AIPromptConfig };
}

export interface ScriptLike {
  title?: string;
  description?: string;
  finalGoal?: string;
  settingPrompt?: string;
}

export interface RoomMemoryConfigLike {
  immediateLimit: number;
  shortThreshold: number;
  midThreshold: number;
  shortToMidPrompt: string;
  midToLongPrompt: string;
}

export interface RoomMemorySystemLike {
  回忆档案: Array<{
    名称: string;
    概括: string;
    原文: string;
    回合: number;
    记录时间: string;
  }>;
  即时记忆: string[];
  短期记忆: string[];
  中期记忆: string[];
  长期记忆: string[];
}

export interface RoomMemoryTaskLike {
  id: string;
  来源层: "短期" | "中期";
  目标层: "中期" | "长期";
  批次: string[];
  批次条数: number;
  起始时间: string;
  结束时间: string;
}

export interface PlayerLike {
  id: string;
  name: string;
  playerSlot?: number;
  isOnline?: boolean;
  action: string;
  location: string;
  currentHP: number;
  currentMP: number;
  statusEffects: string[];
  aiSettings: PlayerAISettings;
  apiFunctions: Record<AIFunctionType, boolean>;
}

export interface RoomLike {
  id: string;
  name: string;
  intro?: string;
  currentRound: number;
  logs: Array<Record<string, unknown>>;
  players: PlayerLike[];
  functionRotationIndex: Record<AIFunctionType, number>;
  script?: ScriptLike;
  memoryConfig?: Partial<RoomMemoryConfigLike>;
  memorySystem?: Partial<RoomMemorySystemLike>;
  memoryPendingTask?: RoomMemoryTaskLike | null;
  aiThinkingHistory?: Array<{
    round: number;
    thinking: string;
    time: string;
    source?: "mainStory" | "reroll";
  }>;
  lastTurnSnapshot?: {
    round: number;
    groupedActions: ActionCollectorPayload;
  } | null;
  rerollVote?: {
    id: string;
    round: number;
    prompt: string;
    requesterId: string;
    approvals: string[];
    rejections: string[];
  } | null;
}

export interface ActionCollectorRawAction {
  playerId: string;
  playerName: string;
  playerSlot?: number;
  location: string;
  action: string;
}

export interface ActionCollectorGroup {
  groupId: string;
  groupType: "together" | "solo";
  location: string;
  playerIds: string[];
  reason: string;
}

export interface ActionCollectorPayload {
  groups: ActionCollectorGroup[];
  rawActions: ActionCollectorRawAction[];
  groupNarratives: string[];
}

export interface MainStorySegment {
  groupId: string;
  visibleToPlayerIds: string[];
  title: string;
  content: string;
}

export interface MainStoryHint {
  playerId: string;
  hint: string;
}

export interface MainStoryPayload {
  thinking?: string;
  globalSummary?: string;
  shortTerm?: string;
  publicLines?: Array<{ speaker: string; text: string }>;
  segments?: MainStorySegment[];
  nextHints?: MainStoryHint[];
}

export interface StateProcessorPayload {
  changes: Array<{
    playerId: string;
    playerSlot?: number;
    fields: Record<string, unknown>;
    reason: string;
  }>;
}
