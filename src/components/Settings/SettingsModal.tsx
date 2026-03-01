import React, { useState, useEffect } from 'react';
import { X, Monitor, MessageSquare, Server, Database, Save, Trash2, RefreshCw, LogOut, Cpu, BookOpen, Calculator, Link, Key, Box, Download } from 'lucide-react';
import { dbService } from '../../services/dbService';
import { GameSettings, defaultSettings, AIFunctionType, AIProviderType } from '../../types/Settings';
import { socketService } from '../../services/socketService';
import ConfirmDialog from '../UI/ConfirmDialog';
import Toast, { ToastType } from '../UI/Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: Tab;
  onExitToHome?: () => void;
  roomId?: string;
  accountUsername?: string;
}

type Tab = 'visual' | 'prompt' | 'api' | 'storage';

type PromptDefaults = Record<AIFunctionType, { system: string; user: string; model: string }>;

const AI_KEYS: AIFunctionType[] = ['actionCollector', 'mainStory', 'stateProcessor'];

const PROVIDER_OPTIONS: Array<{ value: AIProviderType; label: string; endpoint: string }> = [
  { value: 'openaiCompatible', label: 'OpenAI自定义', endpoint: '' },
  { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  { value: 'gemini', label: 'Gemini(原生)', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1' },
  { value: 'claude', label: 'Claude', endpoint: 'https://api.anthropic.com/v1' },
];

const providerEndpointMap: Record<AIProviderType, string> = {
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  claude: 'https://api.anthropic.com/v1',
  openaiCompatible: '',
};

const deepCloneSettings = (settings: GameSettings): GameSettings =>
  JSON.parse(JSON.stringify(settings)) as GameSettings;

const mergeSettings = (base: GameSettings, saved: Partial<GameSettings>): GameSettings => {
  const merged = deepCloneSettings(base);

  if (saved.visual) {
    merged.visual = {
      ...merged.visual,
      ...saved.visual,
    };
  }

  if (saved.ai) {
    merged.ai.defaultProvider = saved.ai.defaultProvider ?? merged.ai.defaultProvider;
    merged.ai.defaultEndpoint = saved.ai.defaultEndpoint ?? merged.ai.defaultEndpoint;
    merged.ai.defaultApiKey = saved.ai.defaultApiKey ?? merged.ai.defaultApiKey;

    AI_KEYS.forEach((key) => {
      const savedAI = saved.ai?.[key];
      if (!savedAI) return;

      const savedSystemPrompt = savedAI.prompt?.systemPrompt;

      merged.ai[key] = {
        connection: {
          ...merged.ai[key].connection,
          ...(savedAI.connection || {}),
        },
        prompt: {
          ...merged.ai[key].prompt,
          ...(savedAI.prompt || {}),
          systemPrompt:
            typeof savedSystemPrompt === 'string' && savedSystemPrompt.trim().length > 0
              ? savedSystemPrompt
              : merged.ai[key].prompt.systemPrompt,
        },
      };
    });
  }

  return merged;
};

const getDefaultEndpointByProvider = (provider: AIProviderType) => providerEndpointMap[provider] ?? '';

export default function SettingsModal({ isOpen, onClose, initialTab = 'visual', onExitToHome, roomId, accountUsername = '' }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [settings, setSettings] = useState<GameSettings>(deepCloneSettings(defaultSettings));
  const [promptDefaults, setPromptDefaults] = useState<PromptDefaults | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      void loadSettings();
    }
  }, [isOpen, initialTab, accountUsername]);

  const loadSettings = async () => {
    try {
      let nextSettings = deepCloneSettings(defaultSettings);

      try {
        const defaults = await socketService.fetchPromptDefaults();
        setPromptDefaults(defaults as PromptDefaults);

        AI_KEYS.forEach((key) => {
          const prompt = defaults?.[key]?.system;
          if (typeof prompt === 'string' && prompt.trim().length > 0) {
            nextSettings.ai[key].prompt.systemPrompt = prompt;
          }
        });
      } catch {
        setPromptDefaults(null);
      }

      const savedSettings = accountUsername
        ? await dbService.getUserSetting(accountUsername, 'gameSettings')
        : await dbService.getSetting('gameSettings');
      if (savedSettings) {
        nextSettings = mergeSettings(nextSettings, savedSettings as Partial<GameSettings>);
      }

      setSettings(nextSettings);
    } catch {
      showToast('加载设置失败，已使用默认配置', 'error');
      setSettings(deepCloneSettings(defaultSettings));
    }
  };

  const saveSettings = async (successText: string) => {
    try {
      if (accountUsername) {
        await dbService.saveUserSetting(accountUsername, 'gameSettings', settings);
      } else {
        await dbService.saveSetting('gameSettings', settings);
      }
      if (roomId) {
        socketService.updatePlayerAIConfig(roomId, settings.ai);
      }
      showToast(successText, 'success');
    } catch {
      showToast('保存失败', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onCancel={() => setConfirmDialog(null)}
          type={confirmDialog.type}
        />
      )}

      <div className="w-full max-w-5xl h-[85vh] bg-zinc-950 border-2 border-amber-500/50 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-amber-500 rounded-sm"></div>
            <h2 className="text-xl font-bold text-amber-500 tracking-widest font-serif">系统设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-amber-500 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 bg-zinc-900/30 border-r border-zinc-800 flex flex-col p-4 gap-2">
            <TabButton active={activeTab === 'visual'} onClick={() => setActiveTab('visual')} icon={<Monitor size={18} />} label="视觉与显示" />
            <TabButton active={activeTab === 'prompt'} onClick={() => setActiveTab('prompt')} icon={<MessageSquare size={18} />} label="AI 提示词管理" />
            <TabButton active={activeTab === 'api'} onClick={() => setActiveTab('api')} icon={<Server size={18} />} label="API 连接配置" />
            <TabButton active={activeTab === 'storage'} onClick={() => setActiveTab('storage')} icon={<Database size={18} />} label="本地存储概览" />

            {onExitToHome && (
              <div className="mt-auto pt-4 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: '确认退出',
                      message: '确定要返回主页吗？未保存的进度可能会丢失。',
                      onConfirm: () => {
                        onExitToHome();
                        onClose();
                      },
                      type: 'warning'
                    });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                >
                  <LogOut size={18} />
                  <span>返回主页</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-8 overflow-y-auto no-scrollbar bg-zinc-950/50">
            {activeTab === 'visual' && <VisualSettings settings={settings} onChange={setSettings} />}
            {activeTab === 'prompt' && (
              <PromptSettings
                settings={settings}
                onChange={setSettings}
                onSave={() => void saveSettings('提示词配置已保存')}
                promptDefaults={promptDefaults}
              />
            )}
            {activeTab === 'api' && (
              <ApiSettings
                settings={settings}
                onChange={setSettings}
                onSave={() => void saveSettings('API 连接配置已保存')}
                showToast={showToast}
              />
            )}
            {activeTab === 'storage' && (
              <StorageSettings
                showToast={showToast}
                setConfirmDialog={setConfirmDialog}
                accountUsername={accountUsername}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium w-full text-left
        ${active
          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function VisualSettings({ settings, onChange }: { settings: GameSettings; onChange: React.Dispatch<React.SetStateAction<GameSettings>> }) {
  return (
    <div className="space-y-8">
      <Section title="显示设置">
        <div className="grid grid-cols-2 gap-4">
          <SettingItem label="字体大小">
            <select
              value={settings.visual.fontSize}
              onChange={(e) => {
                const v = e.target.value as GameSettings['visual']['fontSize'];
                onChange((prev) => ({ ...prev, visual: { ...prev.visual, fontSize: v } }));
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-amber-500 outline-none"
            >
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
          </SettingItem>
          <SettingItem label="界面缩放">
            <select
              value={settings.visual.scale}
              onChange={(e) => onChange((prev) => ({ ...prev, visual: { ...prev.visual, scale: e.target.value } }))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-amber-500 outline-none"
            >
              <option>100%</option>
              <option>125%</option>
              <option>150%</option>
            </select>
          </SettingItem>
        </div>
      </Section>

      <Section title="视觉效果">
        <div className="space-y-4">
          <ToggleItem
            label="启用动态背景"
            description="在背景中显示微妙的粒子效果"
            checked={settings.visual.dynamicBackground}
            onToggle={(checked) => onChange((prev) => ({ ...prev, visual: { ...prev.visual, dynamicBackground: checked } }))}
          />
          <ToggleItem
            label="启用文字打字机效果"
            description="消息逐字显示"
            checked={settings.visual.typingEffect}
            onToggle={(checked) => onChange((prev) => ({ ...prev, visual: { ...prev.visual, typingEffect: checked } }))}
          />
          <ToggleItem
            label="启用界面光晕"
            description="为边框和重要元素添加发光效果"
            checked={settings.visual.uiGlow}
            onToggle={(checked) => onChange((prev) => ({ ...prev, visual: { ...prev.visual, uiGlow: checked } }))}
          />
        </div>
      </Section>
    </div>
  );
}

function PromptSettings({
  settings,
  onChange,
  onSave,
  promptDefaults,
}: {
  settings: GameSettings;
  onChange: React.Dispatch<React.SetStateAction<GameSettings>>;
  onSave: () => void;
  promptDefaults: PromptDefaults | null;
}) {
  const [activeAI, setActiveAI] = useState<AIFunctionType>('mainStory');

  const getAIPrompt = (type: AIFunctionType) => settings.ai[type].prompt;

  const resetSystemPrompt = () => {
    const fallback = promptDefaults?.[activeAI]?.system || '';
    onChange((prev) => ({
      ...prev,
      ai: {
        ...prev.ai,
        [activeAI]: {
          ...prev.ai[activeAI],
          prompt: {
            ...prev.ai[activeAI].prompt,
            systemPrompt: fallback,
          },
        },
      },
    }));
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <h3 className="text-zinc-200 font-bold">AI 提示词配置</h3>
        <button onClick={resetSystemPrompt} className="flex items-center gap-2 text-xs text-amber-500 hover:text-amber-400 transition-colors">
          <RefreshCw size={14} /> 重置默认
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
        <button onClick={() => setActiveAI('actionCollector')} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeAI === 'actionCollector' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Cpu size={14} /> 行动收集 AI</button>
        <button onClick={() => setActiveAI('mainStory')} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeAI === 'mainStory' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><BookOpen size={14} /> 主剧情 AI</button>
        <button onClick={() => setActiveAI('stateProcessor')} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeAI === 'stateProcessor' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Calculator size={14} /> 数据处理 AI</button>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <SettingItem label="温度 (Temperature)">
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={getAIPrompt(activeAI).temperature}
            onChange={(e) => {
              const value = Number(e.target.value);
              onChange((prev) => ({
                ...prev,
                ai: {
                  ...prev.ai,
                  [activeAI]: {
                    ...prev.ai[activeAI],
                    prompt: {
                      ...prev.ai[activeAI].prompt,
                      temperature: Number.isFinite(value) ? value : prev.ai[activeAI].prompt.temperature,
                    },
                  },
                },
              }));
            }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-amber-500 outline-none font-mono text-xs"
          />
        </SettingItem>

        <div className="flex-1 flex flex-col gap-2">
          <label className="text-sm text-zinc-400">系统提示词 (System Prompt)</label>
          <textarea
            className="flex-1 w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-zinc-300 font-mono text-sm focus:border-amber-500 outline-none resize-none custom-scrollbar leading-relaxed"
            value={getAIPrompt(activeAI).systemPrompt}
            onChange={(e) => {
              const value = e.target.value;
              onChange((prev) => ({
                ...prev,
                ai: {
                  ...prev.ai,
                  [activeAI]: {
                    ...prev.ai[activeAI],
                    prompt: {
                      ...prev.ai[activeAI].prompt,
                      systemPrompt: value,
                    },
                  },
                },
              }));
            }}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <button onClick={onSave} className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded-lg font-bold transition-colors shadow-lg shadow-amber-900/20">
          <Save size={16} /> 保存配置
        </button>
      </div>
    </div>
  );
}

function ApiSettings({ settings, onChange, onSave, showToast }: { settings: GameSettings; onChange: React.Dispatch<React.SetStateAction<GameSettings>>; onSave: () => void; showToast: (msg: string, type?: ToastType) => void }) {
  const [activeAI, setActiveAI] = useState<AIFunctionType>('mainStory');
  const [modelOptions, setModelOptions] = useState<Record<AIFunctionType, Array<{ id: string; name: string }>>>({
    actionCollector: [],
    mainStory: [],
    stateProcessor: [],
  });
  const [loadingModels, setLoadingModels] = useState(false);

  const getAIConnection = (type: AIFunctionType) => settings.ai[type].connection;

  const getResolvedProvider = (type: AIFunctionType): AIProviderType => {
    return (getAIConnection(type).provider || settings.ai.defaultProvider) as AIProviderType;
  };

  const getResolvedEndpoint = (type: AIFunctionType) => {
    const conn = getAIConnection(type);
    const provider = getResolvedProvider(type);
    return conn.endpoint || settings.ai.defaultEndpoint || getDefaultEndpointByProvider(provider);
  };

  const getResolvedApiKey = (type: AIFunctionType) => {
    const conn = getAIConnection(type);
    return conn.apiKey || settings.ai.defaultApiKey;
  };

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      const provider = getResolvedProvider(activeAI);
      const endpoint = getResolvedEndpoint(activeAI);
      const apiKey = getResolvedApiKey(activeAI);

      const result = await socketService.fetchModels({ provider, endpoint, apiKey });
      setModelOptions((prev) => ({ ...prev, [activeAI]: result.models }));
      showToast(`已获取 ${result.models.length} 个模型`, 'success');
    } catch (error) {
      showToast(String((error as Error)?.message || '获取模型失败'), 'error');
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <h3 className="text-zinc-200 font-bold">API 连接配置</h3>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>系统在线</span>
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 space-y-4">
        <h4 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><Server size={16} /> 全局默认设置</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SettingItem label="默认提供商">
            <select
              value={settings.ai.defaultProvider}
              onChange={(e) => {
                const provider = e.target.value as AIProviderType;
                const defaultEndpoint = provider === 'openaiCompatible' ? '' : getDefaultEndpointByProvider(provider);
                onChange((prev) => ({
                  ...prev,
                  ai: {
                    ...prev.ai,
                    defaultProvider: provider,
                    defaultEndpoint,
                  },
                }));
              }}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-amber-500 outline-none text-xs"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </SettingItem>
          <SettingItem label="默认 API Endpoint">
            <div className="relative">
              <Link size={14} className="absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                value={settings.ai.defaultEndpoint}
                onChange={(e) => onChange((prev) => ({ ...prev, ai: { ...prev.ai, defaultEndpoint: e.target.value } }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-9 pr-2 text-zinc-200 focus:border-amber-500 outline-none font-mono text-xs"
                placeholder={settings.ai.defaultProvider === 'openaiCompatible' ? '请填写自定义服务地址' : 'https://api.openai.com/v1'}
              />
            </div>
          </SettingItem>
          <SettingItem label="默认 API Key">
            <div className="relative">
              <Key size={14} className="absolute left-3 top-3 text-zinc-500" />
              <input
                type="password"
                value={settings.ai.defaultApiKey}
                onChange={(e) => onChange((prev) => ({ ...prev, ai: { ...prev.ai, defaultApiKey: e.target.value } }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-9 pr-2 text-zinc-200 focus:border-amber-500 outline-none font-mono text-xs"
                placeholder="sk-..."
              />
            </div>
          </SettingItem>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <h4 className="text-sm font-bold text-zinc-400 flex items-center gap-2"><Cpu size={16} /> 独立 AI 配置</h4>

        <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
          <button onClick={() => setActiveAI('actionCollector')} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeAI === 'actionCollector' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Cpu size={14} /> 行动收集 AI</button>
          <button onClick={() => setActiveAI('mainStory')} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeAI === 'mainStory' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><BookOpen size={14} /> 主剧情 AI</button>
          <button onClick={() => setActiveAI('stateProcessor')} className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${activeAI === 'stateProcessor' ? 'bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Calculator size={14} /> 数据处理 AI</button>
        </div>

        <div className="flex-1 bg-zinc-900/30 rounded-xl border border-zinc-800 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingItem label="提供商 (Provider)">
              <select
                value={getAIConnection(activeAI).provider}
                onChange={(e) => {
                  const provider = e.target.value as AIProviderType | '';
                  onChange((prev) => ({
                    ...prev,
                    ai: {
                      ...prev.ai,
                      [activeAI]: {
                        ...prev.ai[activeAI],
                        connection: {
                          ...prev.ai[activeAI].connection,
                          provider,
                          endpoint:
                            provider && provider !== 'openaiCompatible'
                              ? getDefaultEndpointByProvider(provider)
                              : '',
                        },
                      },
                    },
                  }));
                }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:border-amber-500 outline-none text-xs"
              >
                <option value="">跟随全局</option>
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SettingItem>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SettingItem label="模型选择 (Model)">
                  <div className="space-y-2">
                    <div className="relative">
                      <Box size={14} className="absolute left-3 top-3 text-zinc-500" />
                      <input
                        type="text"
                        value={getAIConnection(activeAI).model}
                        onChange={(e) => {
                          const model = e.target.value;
                          onChange((prev) => ({
                            ...prev,
                            ai: {
                              ...prev.ai,
                              [activeAI]: {
                                ...prev.ai[activeAI],
                                connection: {
                                  ...prev.ai[activeAI].connection,
                                  model,
                                },
                              },
                            },
                          }));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-9 pr-2 text-zinc-200 focus:border-amber-500 outline-none font-mono text-xs"
                        placeholder="gpt-4o"
                      />
                    </div>
                    {modelOptions[activeAI].length > 0 && (
                      <select
                        value={getAIConnection(activeAI).model}
                        onChange={(e) => {
                          const model = e.target.value;
                          onChange((prev) => ({
                            ...prev,
                            ai: {
                              ...prev.ai,
                              [activeAI]: {
                                ...prev.ai[activeAI],
                                connection: {
                                  ...prev.ai[activeAI].connection,
                                  model,
                                },
                              },
                            },
                          }));
                        }}
                        className="w-full bg-zinc-950 border border-amber-500/40 rounded-lg py-2 px-2 text-zinc-200 focus:border-amber-500 outline-none text-xs"
                      >
                        {modelOptions[activeAI].map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </SettingItem>
              </div>
              <button
                onClick={() => void fetchModels()}
                disabled={loadingModels}
                className="h-[34px] px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg flex items-center gap-2 text-xs transition-colors whitespace-nowrap mb-[1px] disabled:opacity-60"
              >
                <Download size={14} />
                {loadingModels ? '获取中...' : '获取模型列表'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2 border-t border-zinc-800/50">
            <SettingItem label="自定义 Endpoint (留空则使用全局默认)">
              <div className="relative">
                <Link size={14} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  value={getAIConnection(activeAI).endpoint}
                  onChange={(e) => {
                    const endpoint = e.target.value;
                    onChange((prev) => ({
                      ...prev,
                      ai: {
                        ...prev.ai,
                        [activeAI]: {
                          ...prev.ai[activeAI],
                          connection: {
                            ...prev.ai[activeAI].connection,
                            endpoint,
                          },
                        },
                      },
                    }));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-9 pr-2 text-zinc-200 focus:border-amber-500 outline-none font-mono text-xs placeholder:text-zinc-700"
                  placeholder={getResolvedProvider(activeAI) === 'openaiCompatible' ? '请填写自定义服务地址' : getResolvedEndpoint(activeAI)}
                />
              </div>
            </SettingItem>
            <SettingItem label="自定义 API Key (留空则使用全局默认)">
              <div className="relative">
                <Key size={14} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  type="password"
                  value={getAIConnection(activeAI).apiKey}
                  onChange={(e) => {
                    const apiKey = e.target.value;
                    onChange((prev) => ({
                      ...prev,
                      ai: {
                        ...prev.ai,
                        [activeAI]: {
                          ...prev.ai[activeAI],
                          connection: {
                            ...prev.ai[activeAI].connection,
                            apiKey,
                          },
                        },
                      },
                    }));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-9 pr-2 text-zinc-200 focus:border-amber-500 outline-none font-mono text-xs placeholder:text-zinc-700"
                  placeholder="使用全局 Key"
                />
              </div>
            </SettingItem>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <button onClick={onSave} className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded-lg font-bold transition-colors shadow-lg shadow-amber-900/20">
          <Save size={16} /> 保存连接配置
        </button>
      </div>
    </div>
  );
}

function StorageSettings({ showToast, setConfirmDialog, accountUsername }: { showToast: (msg: string, type: ToastType) => void, setConfirmDialog: any, accountUsername?: string }) {
  const [selectedSaveId, setSelectedSaveId] = useState('');
  const [usage, setUsage] = useState({ usage: 0, quota: 0 });
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    void loadStorageInfo();
  }, [accountUsername]);

  const loadStorageInfo = async () => {
    const info = await dbService.getStorageUsage();
    setUsage(info);
    const saves = accountUsername ? await dbService.getAllUserSaves(accountUsername) : await dbService.getAllSaves();
    setSaveCount(saves.length);
    if (!selectedSaveId && saves.length > 0) {
      setSelectedSaveId(saves[0].id);
    }
  };

  const handleClearData = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '清除所有数据',
      message: '确定要清除所有数据吗？此操作不可逆！',
      type: 'danger',
      onConfirm: async () => {
        await dbService.clearAllData();
        await loadStorageInfo();
        showToast('所有数据已清除', 'success');
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePercent = usage.quota > 0 ? (usage.usage / usage.quota) * 100 : 0;

  return (
    <div className="space-y-8">
      <Section title="存储概览 (IndexedDB)">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">已用空间</span>
            <span className="text-zinc-200">{formatSize(usage.usage)} / {formatSize(usage.quota)}</span>
          </div>
          <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(usagePercent, 1)}%` }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-zinc-500 text-right">存档数量: {saveCount}</div>
        </div>
      </Section>

      <Section title="数据管理">
        <div className="grid grid-cols-1 gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
            <div>
              <div className="text-zinc-200 font-bold">游戏存档共享到房间</div>
              <div className="text-zinc-500 text-xs">选择一个本地存档并分享到当前房间，其他玩家可下载到各自本地</div>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedSaveId}
                onChange={(e) => setSelectedSaveId(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
              >
                <option value="">请选择存档</option>
                <option value="__latest__">最新存档</option>
              </select>
              <button
                type="button"
                onClick={async () => {
                  const roomId = localStorage.getItem('trpg_current_room_id') || '';
                  if (!roomId) {
                    showToast('当前不在房间中，无法共享存档', 'error');
                    return;
                  }

                  const all = accountUsername ? await dbService.getAllUserSaves(accountUsername) : await dbService.getAllSaves();
                  if (!all.length) {
                    showToast('本地没有可共享存档', 'error');
                    return;
                  }

                  const save = selectedSaveId && selectedSaveId !== '__latest__'
                    ? all.find((s: any) => s.id === selectedSaveId)
                    : all.sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

                  if (!save) {
                    showToast('未找到所选存档', 'error');
                    return;
                  }

                  socketService.publishSharedAsset({
                    roomId,
                    assetType: 'save',
                    id: save.id,
                    name: save.name,
                    updatedAt: save.timestamp,
                    payload: save,
                  });

                  showToast('存档已发布到房间，可供其他玩家下载', 'success');
                }}
                className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm transition-colors"
              >
                共享存档
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div>
              <div className="text-zinc-200 font-bold">清除所有数据</div>
              <div className="text-zinc-500 text-xs text-red-400/70">此操作不可逆，请谨慎操作</div>
            </div>
            <button onClick={() => void handleClearData()} className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-400 rounded-lg text-sm transition-colors">
              <Trash2 size={16} /> 清除
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function SettingItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function ToggleItem({ label, description, checked, onToggle }: { label: string; description: string; checked?: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
      <div>
        <div className="text-zinc-200 text-sm font-medium">{label}</div>
        <div className="text-zinc-500 text-xs">{description}</div>
      </div>
      <button
        onClick={() => onToggle(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-amber-600' : 'bg-zinc-700'}`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-7' : 'left-1'}`}></div>
      </button>
    </div>
  );
}
