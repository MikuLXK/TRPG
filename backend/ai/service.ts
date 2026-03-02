import { buildAuthHeaders, callChatCompletion, getModelsUrl, PROVIDER_DEFAULT_ENDPOINTS } from "./chatClient";
import { buildPromptEnvelope, fillTemplate, readPromptFile, safeJsonParse, trimTextForContext } from "./prompting";
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

const getPromptSystemOverride = async (player: PlayerLike, functionType: AIFunctionType) => {
  const override = player.aiSettings[functionType].prompt.systemPrompt?.trim();
  if (override) return override;
  return readPromptFile(functionType, "system");
};

export const runActionCollector = async (room: RoomLike): Promise<ActionCollectorPayload> => {
  const providerPlayer = pickProviderByRoundRobin(room, "actionCollector");
  const connection = getEffectiveConnection(providerPlayer, "actionCollector");
  const [userTemplate, modelTemplate, systemPromptBase] = await Promise.all([
    readPromptFile("actionCollector", "user"),
    readPromptFile("actionCollector", "model"),
    getPromptSystemOverride(providerPlayer, "actionCollector")
  ]);

  const collectorInput = buildActionCollectorInput(room);
  const userPromptBody = fillTemplate(userTemplate, { actionCollectorInputJson: JSON.stringify(collectorInput, null, 2) });
  const promptEnvelope = await buildPromptEnvelope({
    room,
    providerPlayer,
    functionType: "actionCollector",
    systemPromptBase,
    userPromptBody,
    modelPromptBody: modelTemplate
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

export const runMainStory = async (room: RoomLike, groupedActions: ActionCollectorPayload): Promise<MainStoryPayload> => {
  const providerPlayer = pickProviderByRoundRobin(room, "mainStory");
  const connection = getEffectiveConnection(providerPlayer, "mainStory");
  const [userTemplate, modelTemplate, systemPromptBase] = await Promise.all([
    readPromptFile("mainStory", "user"),
    readPromptFile("mainStory", "model"),
    getPromptSystemOverride(providerPlayer, "mainStory")
  ]);

  const settingPrompt = trimTextForContext(room.script?.settingPrompt || "", 1200);
  const systemPromptWithSetting = settingPrompt ? `${settingPrompt}\n\n${systemPromptBase}` : systemPromptBase;
  const mainStoryInput = buildMainStoryInput(room, groupedActions);
  const userPromptBody = fillTemplate(userTemplate, { mainStoryInputJson: JSON.stringify(mainStoryInput, null, 2) });
  const promptEnvelope = await buildPromptEnvelope({
    room,
    providerPlayer,
    functionType: "mainStory",
    systemPromptBase: systemPromptWithSetting,
    userPromptBody,
    modelPromptBody: modelTemplate
  });
  const output = await callChatCompletion({
    provider: connection.provider,
    endpoint: connection.endpoint,
    apiKey: connection.apiKey,
    model: connection.model,
    temperature: providerPlayer.aiSettings.mainStory.prompt.temperature,
    systemPrompt: promptEnvelope.systemPrompt,
    userPrompt: promptEnvelope.userPrompt,
    modelPrompt: promptEnvelope.modelPrompt
  });
  const parsed = safeJsonParse<MainStoryPayload>(output);
  return normalizeMainStoryPayload(room, groupedActions, parsed);
};

export const runStateProcessor = async (room: RoomLike, storyPayload: MainStoryPayload, groupedActions: ActionCollectorPayload) => {
  const providerPlayer = pickProviderByRoundRobin(room, "stateProcessor");
  const connection = getEffectiveConnection(providerPlayer, "stateProcessor");
  const [userTemplate, modelTemplate, systemPromptBase] = await Promise.all([
    readPromptFile("stateProcessor", "user"),
    readPromptFile("stateProcessor", "model"),
    getPromptSystemOverride(providerPlayer, "stateProcessor")
  ]);

  const stateInput = buildStateProcessorInput(room, storyPayload, groupedActions);
  const userPromptBody = fillTemplate(userTemplate, { stateProcessorInputJson: JSON.stringify(stateInput, null, 2) });
  const promptEnvelope = await buildPromptEnvelope({
    room,
    providerPlayer,
    functionType: "stateProcessor",
    systemPromptBase,
    userPromptBody,
    modelPromptBody: modelTemplate
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
