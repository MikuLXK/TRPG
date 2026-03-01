import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Users, Copy, Check, Play, LogOut, User, Server, ScrollText, Archive, Sparkles, UserPlus } from 'lucide-react';
import { socketService } from '../../services/socketService';
import ChatPanel from '../Panels/ChatPanel';
import { 游戏日志 } from '../../types/GameData';
import type { AIFunctionType } from '../../types/Settings';
import type { CharacterAttributeBlock, PlayerCharacterProfile } from '../../types/Script';

interface WaitingRoomProps {
  roomState: any;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

const FUNCTION_LABELS: Record<AIFunctionType, string> = {
  actionCollector: '行动收集 AI',
  mainStory: '主剧情 AI',
  stateProcessor: '数据处理 AI',
};

const FUNCTION_TYPES: AIFunctionType[] = ['actionCollector', 'mainStory', 'stateProcessor'];
const ATTRIBUTE_KEYS: Array<keyof CharacterAttributeBlock> = ['力量', '敏捷', '体质', '智力', '感知', '魅力'];

export default function WaitingRoom({ roomState, onStartGame, onLeaveRoom }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [chatLogs, setChatLogs] = useState<游戏日志[]>([]);
  const [characterNameInput, setCharacterNameInput] = useState('');
  const [isComposingCharacterName, setIsComposingCharacterName] = useState(false);

  const players = roomState.players || [];
  const selfId = socketService.socket?.id;
  const script = roomState.script;
  const roleTemplates = script?.roleTemplates || [];
  const savedCharacters = roomState.savedCharacters || [];
  const gameSetupMode: 'new_game' | 'load_save' = roomState.gameSetupMode || 'new_game';

  useEffect(() => {
    const socket = socketService.socket;
    if (socket) {
      setIsHost(roomState.hostId === socket.id);

      const onNewLog = (log: 游戏日志) => {
        if (log.类型 === 'OOC') {
          setChatLogs((prev) => [...prev, log]);
        }
      };

      socket.on('new_log', onNewLog);

      return () => {
        socket.off('new_log', onNewLog);
      };
    }
  }, [roomState]);

  useEffect(() => {
    if (roomState?.status && roomState.status !== 'waiting') {
      onStartGame();
    }
  }, [roomState?.status, onStartGame]);

  const selfPlayer = useMemo(() => players.find((p: any) => p.id === selfId), [players, selfId]);

  const selectedTemplate = useMemo(() => {
    return roleTemplates.find((t: any) => t.id === selfPlayer?.selectedRoleTemplateId) || roleTemplates[0];
  }, [roleTemplates, selfPlayer?.selectedRoleTemplateId]);

  const selfProfile: PlayerCharacterProfile | null = selfPlayer?.characterProfile || null;
  const isLoadMode = gameSetupMode === 'load_save';
  const selfCanCreateCustomCharacter = Boolean(selfPlayer?.canCreateCustomCharacter);
  const selfSelectedSavedCharacterId = selfPlayer?.selectedSavedCharacterId || null;
  const canEditCustomCharacter = !isLoadMode || selfCanCreateCustomCharacter;

  useEffect(() => {
    setCharacterNameInput(selfProfile?.characterName || '');
  }, [selfProfile?.characterName]);

  const selectedClass = selectedTemplate?.classOptions?.find((o: any) => o.id === selfProfile?.selectedClassId);
  const selectedGender = selectedTemplate?.genderOptions?.find((o: any) => o.id === selfProfile?.selectedGenderId);
  const selectedRace = selectedTemplate?.raceOptions?.find((o: any) => o.id === selfProfile?.selectedRaceId);
  const selectedBackground = selectedTemplate?.backgroundOptions?.find((o: any) => o.id === selfProfile?.selectedBackgroundId);

  const totalAvailablePoints = ATTRIBUTE_KEYS.reduce(
    (sum, key) => sum + (selectedTemplate?.allocationPointsByAttribute?.[key] || 0),
    0,
  );
  const usedPoints = ATTRIBUTE_KEYS.reduce((sum, key) => sum + (selfProfile?.allocatedPoints?.[key] || 0), 0);
  const remainingPoints = Math.max(0, totalAvailablePoints - usedPoints);

  const optionBonusByAttribute: CharacterAttributeBlock = {
    力量:
      (selectedClass?.attributeBonuses?.力量 || 0) +
      (selectedGender?.attributeBonuses?.力量 || 0) +
      (selectedRace?.attributeBonuses?.力量 || 0) +
      (selectedBackground?.attributeBonuses?.力量 || 0),
    敏捷:
      (selectedClass?.attributeBonuses?.敏捷 || 0) +
      (selectedGender?.attributeBonuses?.敏捷 || 0) +
      (selectedRace?.attributeBonuses?.敏捷 || 0) +
      (selectedBackground?.attributeBonuses?.敏捷 || 0),
    体质:
      (selectedClass?.attributeBonuses?.体质 || 0) +
      (selectedGender?.attributeBonuses?.体质 || 0) +
      (selectedRace?.attributeBonuses?.体质 || 0) +
      (selectedBackground?.attributeBonuses?.体质 || 0),
    智力:
      (selectedClass?.attributeBonuses?.智力 || 0) +
      (selectedGender?.attributeBonuses?.智力 || 0) +
      (selectedRace?.attributeBonuses?.智力 || 0) +
      (selectedBackground?.attributeBonuses?.智力 || 0),
    感知:
      (selectedClass?.attributeBonuses?.感知 || 0) +
      (selectedGender?.attributeBonuses?.感知 || 0) +
      (selectedRace?.attributeBonuses?.感知 || 0) +
      (selectedBackground?.attributeBonuses?.感知 || 0),
    魅力:
      (selectedClass?.attributeBonuses?.魅力 || 0) +
      (selectedGender?.attributeBonuses?.魅力 || 0) +
      (selectedRace?.attributeBonuses?.魅力 || 0) +
      (selectedBackground?.attributeBonuses?.魅力 || 0),
  };

  const previewFinalAttributes: CharacterAttributeBlock = {
    力量: (selectedTemplate?.baseAttributes?.力量 || 0) + (selfProfile?.allocatedPoints?.力量 || 0) + optionBonusByAttribute.力量,
    敏捷: (selectedTemplate?.baseAttributes?.敏捷 || 0) + (selfProfile?.allocatedPoints?.敏捷 || 0) + optionBonusByAttribute.敏捷,
    体质: (selectedTemplate?.baseAttributes?.体质 || 0) + (selfProfile?.allocatedPoints?.体质 || 0) + optionBonusByAttribute.体质,
    智力: (selectedTemplate?.baseAttributes?.智力 || 0) + (selfProfile?.allocatedPoints?.智力 || 0) + optionBonusByAttribute.智力,
    感知: (selectedTemplate?.baseAttributes?.感知 || 0) + (selfProfile?.allocatedPoints?.感知 || 0) + optionBonusByAttribute.感知,
    魅力: (selectedTemplate?.baseAttributes?.魅力 || 0) + (selfProfile?.allocatedPoints?.魅力 || 0) + optionBonusByAttribute.魅力,
  };

  const finalAttributes = selfProfile?.calculatedAttributes || previewFinalAttributes;

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomState.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    socketService.startGame(roomState.id);
  };

  const handleSendChat = (text: string) => {
    socketService.sendChat(roomState.id, text);
  };

  const getFunctionProviders = (functionType: AIFunctionType) => {
    return players.filter((p: any) => Boolean(p.apiFunctions?.[functionType]));
  };

  const isFunctionSelectedByPlayer = (player: any, functionType: AIFunctionType) => {
    return Boolean(player.apiFunctions?.[functionType]);
  };

  const toggleFunction = (functionType: AIFunctionType) => {
    if (!roomState?.id) return;
    socketService.togglePlayerAIFunction(roomState.id, functionType);
  };

  const updateProfile = (patch: Partial<PlayerCharacterProfile>) => {
    if (!roomState?.id) return;
    socketService.updateCharacterProfile(roomState.id, patch);
  };

  const selectRoleTemplate = (roleTemplateId: string) => {
    if (!roomState?.id) return;
    socketService.selectRoleTemplate(roomState.id, roleTemplateId);
  };

  const setGameSetupMode = (mode: 'new_game' | 'load_save') => {
    if (!roomState?.id || !isHost) return;
    socketService.setGameSetupMode(roomState.id, mode);
  };

  const claimSavedCharacter = (characterId: string) => {
    if (!roomState?.id) return;
    socketService.claimSavedCharacter(roomState.id, characterId);
  };

  const setCustomCharacterMode = (enabled: boolean) => {
    if (!roomState?.id) return;
    socketService.setCustomCharacterMode(roomState.id, enabled);
  };

  const updateAttributePoint = (key: keyof CharacterAttributeBlock, value: number) => {
    const current = selfProfile?.allocatedPoints || {
      力量: 0,
      敏捷: 0,
      体质: 0,
      智力: 0,
      感知: 0,
      魅力: 0,
    };

    const maxForThisAttribute = Math.min(10, (current[key] || 0) + remainingPoints);

    updateProfile({
      allocatedPoints: {
        ...current,
        [key]: Math.max(0, Math.min(maxForThisAttribute, value)),
      },
    });
  };

  const toggleStarterItem = (itemId: string) => {
    const selected = selfProfile?.selectedStarterItemIds || [];
    const has = selected.includes(itemId);
    let next = selected;

    if (has) {
      next = selected.filter((id) => id !== itemId);
    } else {
      const max = selectedTemplate?.maxStarterItems || 0;
      if (selected.length >= max) return;
      next = [...selected, itemId];
    }

    updateProfile({ selectedStarterItemIds: next });
  };

  const activePlayers = players.filter((p: any) => p.isOnline !== false);
  const allFunctionsCovered = FUNCTION_TYPES.every((type) => getFunctionProviders(type).length > 0);
  const hasUnassignedLoadModePlayers =
    isLoadMode &&
    activePlayers.some((player: any) => !player.selectedSavedCharacterId && !player.canCreateCustomCharacter);

  const renderProviderSelector = (player: any) => {
    if (player.id !== selfId) {
      const selected = FUNCTION_TYPES.filter((type) => isFunctionSelectedByPlayer(player, type));
      return (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Server size={14} />
          <span>{selected.length > 0 ? selected.map((type) => FUNCTION_LABELS[type]).join(' / ') : '未选择功能'}</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-xs text-zinc-500">点击选择你负责提供的 AI 功能（可多选）</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FUNCTION_TYPES.map((type) => {
            const checked = isFunctionSelectedByPlayer(player, type);
            const providerCount = getFunctionProviders(type).length;
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleFunction(type)}
                className={`text-left px-3 py-2 rounded-lg border transition-all pointer-events-auto ${
                  checked
                    ? 'border-amber-500/70 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <div className="text-xs font-semibold">{FUNCTION_LABELS[type]}</div>
                <div className="text-[10px] mt-1 text-zinc-500">
                  {providerCount > 1 ? `当前 ${providerCount} 人提供，将交替使用` : providerCount === 1 ? '当前 1 人提供' : '当前无人提供'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-200 font-sans">
      <div className="w-full max-w-7xl bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-[90vh]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

        <header className="flex justify-between items-start mb-4 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-amber-500 mb-2 font-serif tracking-wider">等待大厅</h1>
            <div className="flex flex-wrap items-center gap-3 text-zinc-400 text-sm">
              <span>房间号:</span>
              <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded border border-zinc-800 font-mono text-amber-200">
                {roomState.id}
                <button onClick={copyRoomId} className="hover:text-white transition-colors">
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-300">剧本：{script?.title || roomState.scriptId}</span>
            </div>
          </div>
          <button onClick={onLeaveRoom} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          <section className="lg:col-span-4 flex flex-col space-y-4 overflow-hidden">
            <div className="flex items-center justify-between text-sm font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2 flex-shrink-0">
              <span>玩家列表 ({players.length}/4)</span>
              <Users size={16} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {players.map((player: any) => {
                const template = roleTemplates.find((t: any) => t.id === player.selectedRoleTemplateId);
                const profile = player.characterProfile as PlayerCharacterProfile | undefined;
                const classOpt = template?.classOptions?.find((o: any) => o.id === profile?.selectedClassId);
                const raceOpt = template?.raceOptions?.find((o: any) => o.id === profile?.selectedRaceId);
                const summary = [classOpt?.name, raceOpt?.name].filter(Boolean).join(' / ');

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-start gap-4 p-3 rounded-xl border ${player.id === selfId ? 'bg-amber-900/10 border-amber-500/30' : 'bg-zinc-950 border-zinc-800'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${player.id === roomState.hostId ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>
                      <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 flex items-center gap-2">
                        {player.name}
                        {player.id === selfId && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded">我</span>}
                        {player.id === roomState.hostId && <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-300 rounded">房主</span>}
                      </div>
                      <div className="mt-1 text-xs text-zinc-300">角色名：{profile?.characterName || '未命名'}</div>
                      <div className="mt-1 text-xs text-zinc-400">构建：{summary || '未完成选择'}</div>
                      <div className="text-xs text-zinc-500 mt-2">{renderProviderSelector(player)}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <div className="text-xs font-bold text-zinc-400">开局模式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => setGameSetupMode('new_game')}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    gameSetupMode === 'new_game'
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                  } ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Sparkles size={14} className="inline mr-1" /> 开始新游戏
                </button>
                <button
                  type="button"
                  disabled={!isHost}
                  onClick={() => setGameSetupMode('load_save')}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    gameSetupMode === 'load_save'
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                  } ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Archive size={14} className="inline mr-1" /> 加载存档
                </button>
              </div>
              {!isHost && <div className="text-[11px] text-zinc-500">仅房主可切换模式</div>}
            </div>

            {isHost ? (
              <button
                onClick={handleStartGame}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded-xl font-bold text-lg shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!allFunctionsCovered || hasUnassignedLoadModePlayers}
              >
                <Play size={20} /> 开始游戏
              </button>
            ) : (
              <div className="w-full py-4 bg-zinc-800 text-zinc-400 rounded-xl font-bold text-center border border-zinc-700 flex-shrink-0">等待房主开始...</div>
            )}

            {hasUnassignedLoadModePlayers && (
              <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                加载存档模式下，仍有玩家未选择角色或未进入创建角色，暂不可开始。
              </div>
            )}
          </section>

          <section className="lg:col-span-5 border border-zinc-800 rounded-xl bg-zinc-950/50 p-4 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 text-zinc-300 font-semibold mb-3">
              <ScrollText size={16} /> {isLoadMode ? '角色选择 / 创建' : '角色创建（大厅内公开可见）'}
            </div>

            {isLoadMode && (
              <div className="mb-4 space-y-3">
                <div className="text-xs text-zinc-400">加载存档模式：先选择一个未被占用的角色，或切换到创建角色。</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {savedCharacters.map((saved: any) => {
                    const claimedPlayer = players.find((p: any) => p.id === saved.claimedBy);
                    const isMine = selfSelectedSavedCharacterId === saved.id;
                    const disabled = Boolean(saved.claimedBy && !isMine);
                    return (
                      <button
                        key={saved.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => claimSavedCharacter(saved.id)}
                        className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                          isMine
                            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                            : disabled
                              ? 'border-zinc-800 bg-zinc-900/50 text-zinc-500 cursor-not-allowed'
                              : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="text-sm font-semibold">{saved.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {disabled ? `已被 ${claimedPlayer?.name || '其他玩家'} 选择` : isMine ? '你已选择该角色' : '点击选择该角色'}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomCharacterMode(true)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                      selfCanCreateCustomCharacter
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <UserPlus size={14} className="inline mr-1" /> 创建角色
                  </button>
                </div>
              </div>
            )}

            {isLoadMode && !selfCanCreateCustomCharacter && (
              <div className="mb-3 text-xs text-zinc-400 bg-zinc-900/70 border border-zinc-700 rounded-lg px-3 py-2">
                你当前使用的是“存档角色”，如需新建角色请先点击上方“创建角色”。
              </div>
            )}

            <fieldset disabled={!canEditCustomCharacter} className={!canEditCustomCharacter ? 'opacity-60' : ''}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500">模板</label>
                  <select
                    className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
                    value={selfPlayer?.selectedRoleTemplateId || ''}
                    onChange={(e) => e.target.value && selectRoleTemplate(e.target.value)}
                  >
                    {roleTemplates.map((role: any) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500">角色名字（玩家输入）</label>
                  <input
                    className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
                    value={characterNameInput}
                    onCompositionStart={() => setIsComposingCharacterName(true)}
                    onCompositionEnd={(e) => {
                      const value = e.currentTarget.value;
                      setIsComposingCharacterName(false);
                      setCharacterNameInput(value);
                      updateProfile({ characterName: value });
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCharacterNameInput(value);
                      if (!isComposingCharacterName) {
                        updateProfile({ characterName: value });
                      }
                    }}
                    onBlur={() => {
                      if ((selfProfile?.characterName || '') !== characterNameInput) {
                        updateProfile({ characterName: characterNameInput });
                      }
                    }}
                    maxLength={30}
                    placeholder="输入你的角色名"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500">职业</label>
                  <select
                    className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
                    value={selfProfile?.selectedClassId || ''}
                    onChange={(e) => updateProfile({ selectedClassId: e.target.value || null })}
                  >
                    {(selectedTemplate?.classOptions || []).map((opt: any) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500">性别</label>
                  <select
                    className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
                    value={selfProfile?.selectedGenderId || ''}
                    onChange={(e) => updateProfile({ selectedGenderId: e.target.value || null })}
                  >
                    {(selectedTemplate?.genderOptions || []).map((opt: any) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500">种族</label>
                  <select
                    className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
                    value={selfProfile?.selectedRaceId || ''}
                    onChange={(e) => updateProfile({ selectedRaceId: e.target.value || null })}
                  >
                    {(selectedTemplate?.raceOptions || []).map((opt: any) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500">背景</label>
                  <select
                    className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 text-sm"
                    value={selfProfile?.selectedBackgroundId || ''}
                    onChange={(e) => updateProfile({ selectedBackgroundId: e.target.value || null })}
                  >
                    {(selectedTemplate?.backgroundOptions || []).map((opt: any) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-1">
                  自由分配点数｜总可分配：{totalAvailablePoints}，已使用：{usedPoints}，可用：{remainingPoints}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ATTRIBUTE_KEYS.map((key) => (
                    <label key={key} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-400">
                      {key}
                      <input
                        type="number"
                        min={0}
                        max={Math.min(10, (selfProfile?.allocatedPoints?.[key] || 0) + remainingPoints)}
                        value={selfProfile?.allocatedPoints?.[key] || 0}
                        onChange={(e) => updateAttributePoint(key, Number(e.target.value || 0))}
                        className="mt-1 w-full bg-zinc-800 rounded px-2 py-1 text-zinc-200"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-1">最终属性（基础 + 分配 + 职业/性别/种族/背景加成）</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ATTRIBUTE_KEYS.map((key) => {
                    const base = selectedTemplate?.baseAttributes?.[key] || 0;
                    const allocated = selfProfile?.allocatedPoints?.[key] || 0;
                    const bonus = optionBonusByAttribute[key] || 0;
                    const total = finalAttributes[key] || 0;
                    return (
                      <div key={`final-${key}`} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300">
                        <div className="font-semibold text-zinc-200">{key}: {total}</div>
                        <div className="text-[11px] text-zinc-500">{base} + {allocated} + {bonus}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-1">开局物资（最多 {selectedTemplate?.maxStarterItems || 0} 项）</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(selectedTemplate?.starterItemOptions || []).map((item: any) => {
                    const checked = (selfProfile?.selectedStarterItemIds || []).includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleStarterItem(item.id)}
                        className={`text-left px-3 py-2 rounded border ${checked ? 'border-amber-500/60 bg-amber-500/10 text-amber-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}
                      >
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className="text-[11px] text-zinc-500">{item.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </fieldset>
          </section>

          <aside className="lg:col-span-3 flex flex-col h-full border border-zinc-800 rounded-xl overflow-hidden bg-black">
            <ChatPanel logs={chatLogs} onSendChat={handleSendChat} />
          </aside>
        </main>
      </div>
    </div>
  );
}
