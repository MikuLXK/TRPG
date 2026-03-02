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

export interface PlayerLike {
  id: string;
  name: string;
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
}

export interface ActionCollectorRawAction {
  playerId: string;
  playerName: string;
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
  globalSummary?: string;
  segments?: MainStorySegment[];
  nextHints?: MainStoryHint[];
}

export interface StateProcessorPayload {
  changes: Array<{
    playerId: string;
    fields: Record<string, unknown>;
    reason: string;
  }>;
}

