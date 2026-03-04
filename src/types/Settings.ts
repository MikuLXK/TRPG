export type AIProviderType = 'openai' | 'gemini' | 'deepseek' | 'claude' | 'openaiCompatible';

export interface AIConnectionConfig {
  provider: AIProviderType | '';
  endpoint: string;
  apiKey: string;
  model: string;
}

export type AIFunctionType = 'actionCollector' | 'mainStory' | 'stateProcessor';

export interface AIFunctionProvidersConfig {
  actionCollector: string[];
  mainStory: string[];
  stateProcessor: string[];
}

export interface AIPromptConfig {
  systemPrompt: string;
  userPrompt?: string;
  modelPrompt?: string;
  temperature: number;
}

export interface MemorySettingsConfig {
  即时记忆上限: number;
  短期记忆阈值: number;
  中期记忆阈值: number;
  短期转中期提示词: string;
  中期转长期提示词: string;
}

export interface GameSettings {
  visual: {
    fontSize: 'small' | 'medium' | 'large';
    scale: string;
    dynamicBackground: boolean;
    typingEffect: boolean;
    uiGlow: boolean;
  };
  ai: {
    defaultProvider: AIProviderType;
    defaultEndpoint: string;
    defaultApiKey: string;
    actionCollector: {
      connection: AIConnectionConfig;
      prompt: AIPromptConfig;
    };
    mainStory: {
      connection: AIConnectionConfig;
      prompt: AIPromptConfig;
    };
    stateProcessor: {
      connection: AIConnectionConfig;
      prompt: AIPromptConfig;
    };
  };
  memory: MemorySettingsConfig;
}

export const defaultMemoryPrompts = {
  短期转中期提示词: `你负责将“短期记忆”压缩为“中期记忆”。
要求：
1. 保留关键事实：地点变化、人物关系变化、关键冲突、阶段性结果。
2. 使用上帝视角总结，避免重复细节。
3. 输出 120~220 字中文摘要，不要使用列表。`,
  中期转长期提示词: `你负责将“中期记忆”压缩为“长期记忆”。
要求：
1. 提炼长期有效的信息：主线推进、关键人物关系、世界状态变化、后续伏笔。
2. 删除短期噪声，强调因果与影响。
3. 输出 120~260 字中文摘要，不要使用列表。`
};

export const defaultSettings: GameSettings = {
  visual: {
    fontSize: 'medium',
    scale: '100%',
    dynamicBackground: true,
    typingEffect: true,
    uiGlow: true,
  },
  ai: {
    defaultProvider: 'openaiCompatible',
    defaultEndpoint: '',
    defaultApiKey: '',
    actionCollector: {
      connection: {
        provider: '',
        endpoint: '',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      prompt: {
        temperature: 0.3,
        systemPrompt: '',
        userPrompt: '',
        modelPrompt: ''
      }
    },
    mainStory: {
      connection: {
        provider: '',
        endpoint: '',
        apiKey: '',
        model: 'gpt-4o',
      },
      prompt: {
        temperature: 0.7,
        systemPrompt: '',
        userPrompt: '',
        modelPrompt: ''
      }
    },
    stateProcessor: {
      connection: {
        provider: '',
        endpoint: '',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      prompt: {
        temperature: 0.1,
        systemPrompt: '',
        userPrompt: '',
        modelPrompt: ''
      }
    }
  },
  memory: {
    即时记忆上限: 10,
    短期记忆阈值: 30,
    中期记忆阈值: 50,
    短期转中期提示词: defaultMemoryPrompts.短期转中期提示词,
    中期转长期提示词: defaultMemoryPrompts.中期转长期提示词
  }
};
