import { buildAuthHeaders, callChatCompletion, getModelsUrl, PROVIDER_DEFAULT_ENDPOINTS } from "./chatClient";
import {
  buildActionCollectorPromptEnvelope,
  buildMainStoryPromptEnvelope,
  buildStateProcessorPromptEnvelope,
  readPromptFile,
  safeJsonParse
} from "./prompting";
import {
  buildActionCollectorInput,
  buildMainStoryInput,
  buildStateProcessorInput,
  getActivePlayers,
  normalizeActionCollectorPayload,
  normalizeMainStoryPayload,
  normalizeStateProcessorPayload
} from "./pipelineHelpers";
import type {
  AIConnectionConfig,
  AIProviderType,
  AIFunctionType,
  ActionCollectorPayload,
  MainStoryPayload,
  PlayerAISettings,
  PlayerLike,
  PromptRole,
  RoomLike
} from "./types";

export type { ActionCollectorPayload, MainStoryPayload } from "./types";
export { buildAuthHeaders, getModelsUrl, readPromptFile, getActivePlayers, PROVIDER_DEFAULT_ENDPOINTS };

const FUNCTION_TYPES: AIFunctionType[] = ["actionCollector", "mainStory", "stateProcessor"];

const getProviderForConnection = (settings: PlayerAISettings, conn: AIConnectionConfig): AIProviderType => {
  return (conn.provider || settings.defaultProvider || "openaiCompatible") as AIProviderType;
};

const getEndpointForConnection = (provider: AIProviderType, settings: PlayerAISettings, conn: AIConnectionConfig): string => {
  return conn.endpoint || settings.defaultEndpoint || PROVIDER_DEFAULT_ENDPOINTS[provider] || "";
};

const getApiKeyForConnection = (settings: PlayerAISettings, conn: AIConnectionConfig): string => {
  return conn.apiKey || settings.defaultApiKey;
};

const getEffectiveConnection = (player: PlayerLike, functionType: AIFunctionType) => {
  const conn = player.aiSettings[functionType].connection;
  const provider = getProviderForConnection(player.aiSettings, conn);
  const endpoint = getEndpointForConnection(provider, player.aiSettings, conn);
  const apiKey = getApiKeyForConnection(player.aiSettings, conn);
  return { provider, endpoint, apiKey, model: conn.model };
};

const getFunctionProviders = (room: RoomLike, functionType: AIFunctionType) => {
  return getActivePlayers(room).filter((player) => player.apiFunctions[functionType]);
};

const pickProviderByRoundRobin = (room: RoomLike, functionType: AIFunctionType) => {
  const providers = getFunctionProviders(room, functionType);
  if (providers.length === 0) throw new Error(`功能 ${functionType} 没有玩家提供API`);
  const index = room.functionRotationIndex[functionType] % providers.length;
  const selected = providers[index];
  room.functionRotationIndex[functionType] += 1;
  return selected;
};

export const validateStartCondition = (room: RoomLike) => {
  return FUNCTION_TYPES.every((fn) => getFunctionProviders(room, fn).length > 0);
};

const getPromptSystemOverride = (player: PlayerLike, functionType: AIFunctionType) => {
  return player.aiSettings[functionType].prompt.systemPrompt?.trim() || "";
};

const getPromptUserOverride = (player: PlayerLike, functionType: AIFunctionType) => {
  return String((player.aiSettings[functionType].prompt as any)?.userPrompt || "").trim();
};

const getPromptModelOverride = (player: PlayerLike, functionType: AIFunctionType) => {
  return String((player.aiSettings[functionType].prompt as any)?.modelPrompt || "").trim();
};

export const runActionCollector = async (room: RoomLike): Promise<ActionCollectorPayload> => {
  const providerPlayer = pickProviderByRoundRobin(room, "actionCollector");
  const connection = getEffectiveConnection(providerPlayer, "actionCollector");
  const collectorInput = buildActionCollectorInput(room);
  const promptEnvelope = await buildActionCollectorPromptEnvelope({
    room,
    providerPlayer,
    systemPromptOverride: getPromptSystemOverride(providerPlayer, "actionCollector"),
    userPromptOverride: getPromptUserOverride(providerPlayer, "actionCollector"),
    modelPromptOverride: getPromptModelOverride(providerPlayer, "actionCollector"),
    actionCollectorInputJson: JSON.stringify(collectorInput, null, 2)
  });
  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.actionCollector.prompt.temperature,
    systemPrompt: promptEnvelope.systemPrompt,
    userPrompt: promptEnvelope.userPrompt,
    modelPrompt: promptEnvelope.modelPrompt
  });
  const parsed = safeJsonParse<{ groups?: unknown[]; rawActions?: unknown[] }>(output);
  return normalizeActionCollectorPayload(room, parsed, collectorInput.players);
};

export const runMainStory = async (
  room: RoomLike,
  groupedActions: ActionCollectorPayload,
  options?: { stream?: boolean; onStreamChunk?: (chunk: string) => void; rerollPrompt?: string }
): Promise<MainStoryPayload> => {
  const providerPlayer = pickProviderByRoundRobin(room, "mainStory");
  const connection = getEffectiveConnection(providerPlayer, "mainStory");
  const mainStoryInput = buildMainStoryInput(room, groupedActions, { rerollPrompt: options?.rerollPrompt });
  const promptEnvelope = await buildMainStoryPromptEnvelope({
    room,
    providerPlayer,
    systemPromptOverride: getPromptSystemOverride(providerPlayer, "mainStory"),
    userPromptOverride: getPromptUserOverride(providerPlayer, "mainStory"),
    modelPromptOverride: getPromptModelOverride(providerPlayer, "mainStory"),
    mainStoryInputJson: JSON.stringify(mainStoryInput, null, 2)
  });
  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.mainStory.prompt.temperature,
    systemPrompt: promptEnvelope.systemPrompt,
    userPrompt: promptEnvelope.userPrompt,
    modelPrompt: promptEnvelope.modelPrompt,
    stream: options?.stream,
    onStreamChunk: options?.onStreamChunk
  });
  const parsed = safeJsonParse<MainStoryPayload>(output);
  return normalizeMainStoryPayload(room, groupedActions, parsed);
};

export const runStateProcessor = async (room: RoomLike, storyPayload: MainStoryPayload, groupedActions: ActionCollectorPayload) => {
  const providerPlayer = pickProviderByRoundRobin(room, "stateProcessor");
  const connection = getEffectiveConnection(providerPlayer, "stateProcessor");
  const stateInput = buildStateProcessorInput(room, storyPayload, groupedActions);
  const promptEnvelope = await buildStateProcessorPromptEnvelope({
    room,
    providerPlayer,
    systemPromptOverride: getPromptSystemOverride(providerPlayer, "stateProcessor"),
    userPromptOverride: getPromptUserOverride(providerPlayer, "stateProcessor"),
    modelPromptOverride: getPromptModelOverride(providerPlayer, "stateProcessor"),
    stateProcessorInputJson: JSON.stringify(stateInput, null, 2)
  });
  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.stateProcessor.prompt.temperature,
    systemPrompt: promptEnvelope.systemPrompt,
    userPrompt: promptEnvelope.userPrompt,
    modelPrompt: promptEnvelope.modelPrompt
  });
  return normalizeStateProcessorPayload(room, safeJsonParse<{ changes?: unknown[] }>(output));
};

export const runMemorySummary = async (args: {
  room: RoomLike;
  requesterId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}) => {
  const activePlayers = getActivePlayers(args.room);
  const requester = activePlayers.find((player) => player.id === args.requesterId);
  if (!requester) {
    throw new Error("当前玩家不在房间中，无法执行记忆总结");
  }
  const isConnectionUsable = (player: PlayerLike) => {
    const conn = getEffectiveConnection(player, "mainStory");
    return Boolean(String(conn.endpoint || "").trim()) && Boolean(String(conn.model || "").trim());
  };
  const providerPlayer = isConnectionUsable(requester)
    ? requester
    : activePlayers.find((player) => player.apiFunctions.mainStory && isConnectionUsable(player)) || requester;
  const connection = getEffectiveConnection(providerPlayer, "mainStory");
  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: Number.isFinite(Number(args.temperature))
      ? Number(args.temperature)
      : providerPlayer.aiSettings.mainStory.prompt.temperature,
    systemPrompt: String(args.systemPrompt || "").trim(),
    userPrompt: String(args.userPrompt || "").trim(),
    modelPrompt: ""
  });
  return String(output || "").trim();
};
