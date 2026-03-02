import type { AIProviderType } from "./types";

export const PROVIDER_DEFAULT_ENDPOINTS: Record<AIProviderType, string> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com/v1",
  claude: "https://api.anthropic.com/v1",
  openaiCompatible: ""
};

const normalizeEndpoint = (endpoint: string) => endpoint.replace(/\/+$/, "");

const getChatCompletionsUrl = (provider: AIProviderType, endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  if (provider === "claude") return `${normalized}/messages`;
  return `${normalized}/chat/completions`;
};

export const getModelsUrl = (provider: AIProviderType, endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  if (provider === "gemini") return `${normalized}/models`;
  return `${normalized}/models`;
};

export const buildAuthHeaders = (provider: AIProviderType, apiKey: string): Record<string, string> => {
  if (!apiKey) return {};
  if (provider === "claude") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    };
  }
  if (provider === "gemini") {
    return {
      "x-goog-api-key": apiKey
    };
  }
  return {
    Authorization: `Bearer ${apiKey}`
  };
};

const extractTextFromResponse = (provider: AIProviderType, payload: any): string => {
  if (provider === "claude") {
    if (Array.isArray(payload?.content)) {
      return payload.content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n");
    }
    return "";
  }

  if (provider === "gemini") {
    const textByCandidates = Array.isArray(payload?.candidates)
      ? payload.candidates
          .map((c: any) => c?.content?.parts?.map((p: any) => p?.text ?? "").join("\n") ?? "")
          .join("\n")
      : "";
    if (textByCandidates) return textByCandidates;
  }

  const choice = payload?.choices?.[0];
  if (typeof choice?.message?.content === "string") {
    return choice.message.content;
  }
  if (Array.isArray(choice?.message?.content)) {
    return choice.message.content.map((part: any) => part?.text ?? "").join("\n");
  }
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }
  if (Array.isArray(payload?.content)) {
    return payload.content.map((part: any) => part?.text ?? "").join("\n");
  }
  return "";
};

const extractTextFromStreamPayload = (provider: AIProviderType, payload: any): string => {
  if (provider === "claude") {
    const deltaText = payload?.delta?.text;
    if (typeof deltaText === "string") return deltaText;
    return "";
  }

  if (provider === "gemini") {
    return extractTextFromResponse("gemini", payload);
  }

  const choice = payload?.choices?.[0];
  if (typeof choice?.delta?.content === "string") return choice.delta.content;
  if (Array.isArray(choice?.delta?.content)) {
    return choice.delta.content.map((part: any) => part?.text ?? "").join("\n");
  }
  return "";
};

const consumeSSE = async (
  response: Response,
  provider: AIProviderType,
  onChunk?: (chunk: string) => void
) => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const payload = JSON.parse(data);
        const text = extractTextFromStreamPayload(provider, payload);
        if (!text) continue;
        fullText += text;
        onChunk?.(text);
      } catch {
        // ignore malformed SSE frame
      }
    }
  }

  return fullText;
};

const callNonStreamingCompletion = async (args: {
  provider: AIProviderType;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  modelPrompt: string;
}) => {
  if (args.provider === "gemini") {
    const geminiUrl = `${normalizeEndpoint(args.endpoint)}/models/${args.model}:generateContent`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders("gemini", args.apiKey)
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: args.systemPrompt }]
        },
        generationConfig: {
          temperature: args.temperature
        },
        contents: [
          {
            role: "user",
            parts: [{ text: args.userPrompt }]
          },
          {
            role: "model",
            parts: [{ text: args.modelPrompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini 请求失败(${response.status}): ${errText}`);
    }

    const payload = await response.json();
    return extractTextFromResponse("gemini", payload);
  }

  const url = getChatCompletionsUrl(args.provider, args.endpoint);
  const openAIMessages = [
    { role: "system", content: args.systemPrompt },
    { role: "user", content: args.userPrompt },
    { role: "assistant", content: args.modelPrompt }
  ];
  const claudeMessages = [
    { role: "user", content: args.userPrompt },
    { role: "assistant", content: args.modelPrompt }
  ];
  const body = args.provider === "claude"
    ? {
        model: args.model,
        temperature: args.temperature,
        max_tokens: 2048,
        system: args.systemPrompt,
        messages: claudeMessages
      }
    : {
        model: args.model,
        temperature: args.temperature,
        messages: openAIMessages
      };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(args.provider, args.apiKey)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI请求失败(${response.status}): ${errText}`);
  }

  const payload = await response.json();
  return extractTextFromResponse(args.provider, payload);
};

const callStreamingCompletion = async (args: {
  provider: AIProviderType;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  modelPrompt: string;
  onStreamChunk?: (chunk: string) => void;
}) => {
  if (args.provider === "gemini") {
    const geminiUrl = `${normalizeEndpoint(args.endpoint)}/models/${args.model}:streamGenerateContent?alt=sse`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...buildAuthHeaders("gemini", args.apiKey)
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: args.systemPrompt }]
        },
        generationConfig: {
          temperature: args.temperature
        },
        contents: [
          {
            role: "user",
            parts: [{ text: args.userPrompt }]
          },
          {
            role: "model",
            parts: [{ text: args.modelPrompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini流式请求失败(${response.status}): ${errText}`);
    }
    return consumeSSE(response, "gemini", args.onStreamChunk);
  }

  const url = getChatCompletionsUrl(args.provider, args.endpoint);
  const openAIMessages = [
    { role: "system", content: args.systemPrompt },
    { role: "user", content: args.userPrompt },
    { role: "assistant", content: args.modelPrompt }
  ];
  const claudeMessages = [
    { role: "user", content: args.userPrompt },
    { role: "assistant", content: args.modelPrompt }
  ];

  const body = args.provider === "claude"
    ? {
        model: args.model,
        temperature: args.temperature,
        max_tokens: 2048,
        stream: true,
        system: args.systemPrompt,
        messages: claudeMessages
      }
    : {
        model: args.model,
        temperature: args.temperature,
        stream: true,
        messages: openAIMessages
      };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...buildAuthHeaders(args.provider, args.apiKey)
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI流式请求失败(${response.status}): ${errText}`);
  }

  return consumeSSE(response, args.provider, args.onStreamChunk);
};

export const callChatCompletion = async (args: {
  provider: AIProviderType;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  modelPrompt: string;
  stream?: boolean;
  onStreamChunk?: (chunk: string) => void;
}) => {
  if (!args.endpoint) {
    throw new Error("Endpoint 不能为空");
  }

  if (args.stream && args.onStreamChunk) {
    let hasStreamed = false;
    try {
      return await callStreamingCompletion({
        ...args,
        onStreamChunk: (chunk) => {
          hasStreamed = true;
          args.onStreamChunk?.(chunk);
        }
      });
    } catch (error) {
      if (hasStreamed) {
        throw error;
      }
      console.warn(`流式请求失败，回退非流式: ${String((error as Error)?.message ?? error)}`);
    }
  }

  return callNonStreamingCompletion(args);
};
