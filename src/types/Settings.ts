export interface AIConnectionConfig {
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
    // Global defaults
    defaultEndpoint: string;
    defaultApiKey: string;
    
    // Per-agent configurations
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
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultApiKey: '',
    
    actionCollector: {
      connection: {
        endpoint: '', // Empty means use default
        apiKey: '',   // Empty means use default
        model: 'gpt-4o-mini',
      },
      prompt: {
        temperature: 0.3,
        systemPrompt: `你是一个TRPG游戏的行动收集AI。
你的任务是接收所有玩家的行动描述，并判断哪些玩家是在一起行动的，哪些是单独行动的。
请输出JSON格式，包含分组信息和每个玩家的原始输入。`
      }
    },
    mainStory: {
      connection: {
        endpoint: '',
        apiKey: '',
        model: 'gpt-4o',
      },
      prompt: {
        temperature: 0.7,
        systemPrompt: `你是一个TRPG游戏的主剧情AI（DM）。
你的任务是根据玩家的分组行动，生成精彩的剧情描述。
请分别为每个分组生成剧情，并以【玩家名】开头标识。`
      }
    },
    stateProcessor: {
      connection: {
        endpoint: '',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      prompt: {
        temperature: 0.1,
        systemPrompt: `你是一个TRPG游戏的数据处理AI。
你的任务是分析剧情文本，判断玩家的状态变化（如生命值、物品、位置等）。
请输出JSON格式的变更指令。`
      }
    }
  }
};
