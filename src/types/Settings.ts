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
  temperature: number;
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
}

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
        systemPrompt: ''
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
        systemPrompt: ''
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
        systemPrompt: ''
      }
    }
  }
};
