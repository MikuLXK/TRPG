import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import CharacterPanel from '../Panels/CharacterPanel';
import GameLogPanel from '../Panels/GameLogPanel';
import RightPanel from '../Panels/RightPanel';
import MemorySummaryFlowModal from '../Panels/MemorySummaryFlowModal';
import SettingsModal from '../Settings/SettingsModal';
import { 初始游戏状态, 游戏状态, 游戏日志, 角色信息, 游戏世界观, 玩家角色, 记忆压缩任务, 记忆系统结构 } from '../../types/gameData';
import type { ScriptRoleTemplate, CharacterAttributeBlock, PlayerCharacterProfile } from '../../types/Script';
import { socketService } from '../../services/socketService';
import { dbService } from '../../services/dbService';
import { defaultSettings } from '../../types/Settings';
import { 创建空记忆系统, 清理记忆总结输出, 规范化记忆任务, 规范化记忆系统 } from '../../utils/memory';

interface GameViewProps {
  roomState: any;
  onExit: () => void;
  roomId?: string;
  accountUsername?: string;
}

interface 玩家输入状态 {
  id: string;
  name: string;
  isReady: boolean;
  action: string;
}

type AnyRecord = Record<string, unknown>;

const collectSelfSpeakerNames = (args: {
  roomPlayers: any[];
  gameData: 游戏状态;
  accountUsername: string;
}) => {
  const names = new Set<string>();
  const selfRoomPlayer = resolveSelfPlayer(args.roomPlayers, args.accountUsername);
  if (selfRoomPlayer?.name) names.add(String(selfRoomPlayer.name).trim());

  const selfRoleId = args.gameData.角色.当前主控角色ID;
  const selfRole = args.gameData.角色.玩家角色列表.find((role) => role.玩家ID === selfRoleId || role.角色ID === selfRoleId);
  if (selfRole?.玩家名) names.add(String(selfRole.玩家名).trim());
  if (selfRole?.角色名) names.add(String(selfRole.角色名).trim());

  if (args.gameData.玩家?.姓名) names.add(String(args.gameData.玩家.姓名).trim());
  return Array.from(names).filter(Boolean);
};

const 空属性: CharacterAttributeBlock = {
  力量: 0,
  敏捷: 0,
  体质: 0,
  智力: 0,
  感知: 0,
  魅力: 0
};

const resolveSelfPlayer = (players: any[], accountUsername: string) => {
  const socket = socketService.socket;
  const bySocketId = socket?.id ? players.find((p: any) => p.id === socket.id) : null;
  if (bySocketId) return bySocketId;
  if (accountUsername) {
    const byAccount = players.find((p: any) => p.accountUsername === accountUsername);
    if (byAccount) return byAccount;
  }
  return null;
};

const buildPlayerInputStates = (players: any[]): 玩家输入状态[] => {
  return players.map((p: any) => ({
    id: String(p.id || ''),
    name: String(p.name || '未命名玩家'),
    isReady: Boolean(p.isReady),
    action: String(p.action || '').trim(),
  }));
};

const toPlayerSlot = (value: unknown, fallbackIndex = 0) => {
  const num = Number(value);
  if (Number.isFinite(num)) {
    const fixed = Math.floor(num);
    if (fixed >= 1 && fixed <= 4) return fixed;
  }
  const byIndex = fallbackIndex + 1;
  return byIndex >= 1 && byIndex <= 4 ? byIndex : 1;
};

const mapStarterItemsToRoleItems = (args: {
  profile: PlayerCharacterProfile | any;
  selectedTemplate: ScriptRoleTemplate | undefined;
}) => {
  const selectedIds = Array.isArray(args.profile?.selectedStarterItemIds) ? args.profile.selectedStarterItemIds : [];
  const options = Array.isArray(args.selectedTemplate?.starterItemOptions) ? args.selectedTemplate.starterItemOptions : [];
  const optionMap = new Map(options.map((item) => [item.id, item]));
  const roleItems: any[] = [];

  for (const itemId of selectedIds) {
    const option = optionMap.get(String(itemId || '').trim());
    if (!option) continue;
    const itemData = option.item || {};
    roleItems.push({
      物品ID: String(itemData.物品ID || option.id || '').trim() || option.id,
      名称: option.name,
      描述: option.description,
      类型: String(itemData.类型 || '杂项'),
      品质: String(itemData.品质 || '普通'),
      数量: Math.max(1, Number(itemData.数量 ?? 1)),
      是否可堆叠: Boolean(itemData.是否可堆叠 ?? true),
      重量: Number(itemData.重量 ?? 0),
      价值: Number(itemData.价值 ?? 0),
      当前耐久: Number(itemData.当前耐久 ?? 100),
      最大耐久: Number(itemData.最大耐久 ?? 100),
      可用次数: Number(itemData.可用次数 ?? 1),
      装备槽位: typeof itemData.装备槽位 === 'string' ? itemData.装备槽位 : null,
      使用效果: Array.isArray(itemData.使用效果) ? itemData.使用效果.map((v) => String(v)) : [],
      标签: Array.isArray(itemData.标签) ? itemData.标签.map((v) => String(v)) : []
    });
  }
  return roleItems;
};

const isRecord = (value: unknown): value is AnyRecord => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const deepMergeValue = (base: unknown, patch: unknown): unknown => {
  if (Array.isArray(patch)) {
    return patch.map((item) => deepMergeValue(undefined, item));
  }
  if (!isRecord(patch)) {
    return patch;
  }

  const next: AnyRecord = isRecord(base) ? { ...base } : {};
  for (const key of Object.keys(patch)) {
    next[key] = deepMergeValue(isRecord(base) ? base[key] : undefined, patch[key]);
  }
  return next;
};

const PUBLIC_STATE_COMMAND_PATTERN = /^\/(?:公共写入|pub|statepatch)\s+([\s\S]+)$/i;

const parseJsonMaybeFenced = (value: string): AnyRecord | null => {
  const source = String(value || "").trim();
  if (!source) return null;
  const unfenced = source.startsWith("```")
    ? source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    : source;
  try {
    const parsed = JSON.parse(unfenced);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractPublicStatePatchCommand = (text: string) => {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(PUBLIC_STATE_COMMAND_PATTERN);
  if (!match) return null;
  const patch = parseJsonMaybeFenced(String(match[1] || ""));
  if (!patch) return { ok: false as const, error: "公共写入命令格式错误，示例：/公共写入 {\"剧情\":{\"当前回合总述\":\"...\"}}" };
  return { ok: true as const, patch };
};

const normalizeGameLog = (value: any): 游戏日志 | null => {
  const sender = String(value?.['发送者'] ?? value?.sender ?? '').trim();
  const content = String(value?.['内容'] ?? value?.content ?? '').trim();
  const type = String(value?.['类型'] ?? value?.type ?? '').trim();
  const time = String(value?.['时间戳'] ?? value?.time ?? '').trim();
  if (!sender || !content) return null;

  const idRaw = String(value?.id || '').trim();
  const id = idRaw || `${sender}-${time}-${content.slice(0, 18)}`;
  const 类型 = type || '系统';
  const 时间戳 = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const roundRaw = Number(value?.['回合'] ?? value?.round);
  const 回合 = Number.isFinite(roundRaw) && roundRaw > 0 ? Math.floor(roundRaw) : undefined;

  return {
    id,
    发送者: sender,
    内容: content,
    类型: 类型 as 游戏日志['类型'],
    时间戳,
    ...(回合 ? { 回合 } : {})
  };
};

const mergeLogsById = (currentLogs: 游戏日志[], incomingRaw: any[]): 游戏日志[] => {
  const merged = new Map<string, 游戏日志>();
  currentLogs.forEach((log) => {
    const normalized = normalizeGameLog(log);
    if (normalized) merged.set(normalized.id, normalized);
  });
  incomingRaw.forEach((raw) => {
    const normalized = normalizeGameLog(raw);
    if (!normalized) return;
    if (!merged.has(normalized.id)) {
      merged.set(normalized.id, normalized);
    }
  });
  return Array.from(merged.values());
};

const syncLogsFromRoom = (data: 游戏状态, room: any): 游戏状态 => {
  const roomLogs = Array.isArray(room?.logs) ? room.logs : [];
  if (roomLogs.length === 0) return data;
  return {
    ...data,
    日志列表: mergeLogsById(data.日志列表, roomLogs)
  };
};

const buildOpeningApplyKey = (room: any) => {
  if (!room?.hasStarted) return '';
  if (!room?.script?.opening || room?.script?.opening?.enabled === false) return '';
  const roomId = String(room?.id || '').trim();
  const scriptId = String(room?.script?.id || '').trim();
  if (!roomId || !scriptId) return '';
  const round = Number(room?.script?.opening?.openingStory?.round);
  const safeRound = Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
  return `${roomId}:${scriptId}:${safeRound}`;
};

const applyOpeningInitialState = (data: 游戏状态, room: any): 游戏状态 => {
  const patch = room?.script?.opening?.initialState;
  if (!isRecord(patch)) return data;
  return deepMergeValue(data, patch) as 游戏状态;
};

const mapRoomPlayerToSaveRole = (player: any, roleTemplates: ScriptRoleTemplate[], index: number): 玩家角色 => {
  const profile = player?.characterProfile || {};
  const selectedTemplate = roleTemplates.find((t) => t.id === player?.selectedRoleTemplateId) || roleTemplates[0];
  const selectedClass = selectedTemplate?.classOptions?.find((o) => o.id === profile?.selectedClassId);
  const selectedRace = selectedTemplate?.raceOptions?.find((o) => o.id === profile?.selectedRaceId);
  const selectedBackground = selectedTemplate?.backgroundOptions?.find((o) => o.id === profile?.selectedBackgroundId);
  const attrs: CharacterAttributeBlock = profile?.calculatedAttributes || 空属性;
  const maxHP = Math.max(1, 60 + attrs.体质 * 4);
  const maxMP = Math.max(0, 20 + attrs.智力 * 4);
  const currentHP = Number.isFinite(Number(player?.currentHP)) ? Math.max(0, Math.floor(Number(player.currentHP))) : maxHP;
  const currentMP = Number.isFinite(Number(player?.currentMP)) ? Math.max(0, Math.floor(Number(player.currentMP))) : maxMP;
  const roleName = [selectedClass?.name, selectedRace?.name].filter(Boolean).join(' / ') || '未选择职业';
  const starterItems = mapStarterItemsToRoleItems({ profile, selectedTemplate });
  const playerSlot = toPlayerSlot(player?.playerSlot, index);

  return {
    玩家序号: playerSlot,
    角色ID: String(player?.id || ''),
    玩家ID: String(player?.id || ''),
    玩家名: String(player?.name || '未命名玩家'),
    角色名: String(profile?.characterName || player?.name || '未命名角色'),
    职业: roleName,
    种族: String(selectedRace?.name || ''),
    性别: String(selectedTemplate?.genderOptions?.find((o) => o.id === profile?.selectedGenderId)?.name || ''),
    背景: String(selectedBackground?.name || selectedBackground?.description || ''),
    等级: 1,
    当前经验: 0,
    升级经验: 100,
    位置: String(player?.location || '未知地点'),
    当前生命值: currentHP,
    最大生命值: maxHP,
    当前法力值: currentMP,
    最大法力值: maxMP,
    属性: attrs,
    状态效果: Array.isArray(player?.statusEffects) ? player.statusEffects : [],
    装备: {
      头部: '',
      胸部: '',
      手部: '',
      腿部: '',
      足部: '',
      主手: '',
      副手: '',
      饰品: ''
    },
    物品列表: starterItems,
    技能列表: [],
    玩家BUFF: []
  };
};

const toCharacterInfo = (role: 玩家角色 | null | undefined, fallbackStory: string): 角色信息 => {
  if (!role) {
    return {
      姓名: '',
      职业: '',
      等级: 1,
      生命值: 0,
      最大生命值: 1,
      法力值: 0,
      最大法力值: 1,
      属性: 空属性,
      状态: [],
      背景故事: fallbackStory
    };
  }
  return {
    姓名: role.角色名 || role.玩家名 || '未命名',
    职业: role.职业 || '未选择职业',
    等级: role.等级 || 1,
    生命值: role.当前生命值,
    最大生命值: role.最大生命值,
    法力值: role.当前法力值,
    最大法力值: role.最大法力值,
    属性: role.属性,
    状态: role.状态效果.length ? role.状态效果 : ['正常'],
    背景故事: role.背景 || fallbackStory
  };
};

const formatTimeText = (data: 游戏状态) => {
  const { 年, 月, 日, 时, 分 } = data.环境;
  const mm = String(月).padStart(2, '0');
  const dd = String(日).padStart(2, '0');
  const hh = String(时).padStart(2, '0');
  const mi = String(分).padStart(2, '0');
  return `${年}年${mm}月${dd}日 ${hh}:${mi}`;
};

const buildWorldInfoFromTree = (data: 游戏状态, roomScript: any): 游戏世界观 => {
  const chapterTitle = data.剧情.当前章节.标题 || roomScript?.title || '';
  const currentLocation =
    data.环境.具体地点 || data.环境.小地点 || data.环境.中地点 || data.环境.大地点 || '未知地点';
  return {
    名称: roomScript?.title || data.世界.名称 || '',
    描述: roomScript?.description || data.世界.描述 || '',
    当前时间: formatTimeText(data),
    当前地点: currentLocation,
    当前章节: chapterTitle,
    当前回合: data.环境.当前回合 || 1
  };
};

const syncGameDataFromRoom = (
  prev: 游戏状态,
  room: any,
  roleTemplates: ScriptRoleTemplate[],
  accountUsername: string
) => {
  if (!room) return prev;
  const baseData = isRecord(room?.stateTree) ? (deepMergeValue(prev, room.stateTree) as 游戏状态) : prev;
  const roomPlayers = Array.isArray(room.players) ? room.players : [];
  const mappedRoles: 玩家角色[] = roomPlayers.map((player: any, index: number) => mapRoomPlayerToSaveRole(player, roleTemplates, index));
  const selfPlayer = resolveSelfPlayer(roomPlayers, accountUsername);
  const selfRole = mappedRoles.find((r: 玩家角色) => r.玩家ID === selfPlayer?.id) || mappedRoles[0] || null;
  const slotToRole = new Map<number, 玩家角色>();
  mappedRoles.forEach((role: 玩家角色) => {
    if (!slotToRole.has(role.玩家序号)) {
      slotToRole.set(role.玩家序号, role);
    }
  });
  const nextRound = Number.isFinite(Number(room.currentRound)) ? Math.max(1, Math.floor(Number(room.currentRound))) : baseData.环境.当前回合;
  const nextLocation = selfRole?.位置 || baseData.环境.具体地点 || '';

  const nextData: 游戏状态 = {
    ...baseData,
    环境: {
      ...baseData.环境,
      当前回合: nextRound,
      具体地点: nextLocation
    },
    角色: {
      ...baseData.角色,
      玩家角色列表: mappedRoles,
      当前主控角色ID: selfRole?.玩家ID || baseData.角色.当前主控角色ID
    },
    玩家1: slotToRole.get(1) || null,
    玩家2: slotToRole.get(2) || null,
    玩家3: slotToRole.get(3) || null,
    玩家4: slotToRole.get(4) || null,
    剧情: {
      ...baseData.剧情,
      当前章节: {
        ...baseData.剧情.当前章节,
        标题: baseData.剧情.当前章节.标题 || room?.script?.title || '',
        背景: baseData.剧情.当前章节.背景 || room?.script?.description || ''
      },
      主线目标: {
        ...baseData.剧情.主线目标,
        最终目标: baseData.剧情.主线目标.最终目标 || room?.script?.finalGoal || ''
      }
    },
    记忆系统: 规范化记忆系统(room?.memorySystem)
  };

  const next玩家 = toCharacterInfo(selfRole, room?.script?.description || '');
  const next世界 = buildWorldInfoFromTree(nextData, room?.script);
  return {
    ...nextData,
    玩家: next玩家,
    世界: next世界
  };
};

export default function GameView({ roomState, onExit, roomId, accountUsername = '' }: GameViewProps) {
  const [游戏数据, set游戏数据] = useState<游戏状态>(初始游戏状态);
  const openingAppliedKeyRef = useRef('');
  const memoryTaskIdRef = useRef('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState('');
  const [roomStatus, setRoomStatus] = useState<string>(roomState?.status || 'waiting');
  const [currentRound, setCurrentRound] = useState<number>(roomState?.currentRound || 1);
  const [streamingMode, setStreamingMode] = useState<'off' | 'provider'>(roomState?.streamingMode === 'off' ? 'off' : 'provider');
  const [playerInputStates, setPlayerInputStates] = useState<玩家输入状态[]>([]);
  const [待处理记忆总结任务, set待处理记忆总结任务] = useState<记忆压缩任务 | null>(null);
  const [记忆总结阶段, set记忆总结阶段] = useState<'idle' | 'remind' | 'processing' | 'review'>('idle');
  const [记忆总结草稿, set记忆总结草稿] = useState('');
  const [记忆总结错误, set记忆总结错误] = useState('');

  const roleTemplates: ScriptRoleTemplate[] = roomState?.script?.roleTemplates || [];

  useEffect(() => {
    const loadMemoryConfig = async () => {
      try {
        const savedSettings = accountUsername
          ? await dbService.getUserSetting(accountUsername, 'gameSettings')
          : await dbService.getSetting('gameSettings');
        const nextMemory = {
          ...defaultSettings.memory,
          ...(savedSettings?.memory || {})
        };
        if (roomId) {
          socketService.updateRoomMemoryConfig(roomId, nextMemory);
        }
      } catch {
        if (roomId) {
          socketService.updateRoomMemoryConfig(roomId, defaultSettings.memory);
        }
      }
    };
    void loadMemoryConfig();
  }, [accountUsername, roomId]);

  const 同步记忆任务状态 = (room: any) => {
    const nextTask = 规范化记忆任务(room?.memoryPendingTask);
    const prevId = memoryTaskIdRef.current;
    const nextId = nextTask?.id || '';
    if (!nextTask) {
      memoryTaskIdRef.current = '';
      set待处理记忆总结任务(null);
      set记忆总结阶段('idle');
      set记忆总结草稿('');
      set记忆总结错误('');
      return;
    }
    if (prevId !== nextId) {
      memoryTaskIdRef.current = nextId;
      set待处理记忆总结任务(nextTask);
      set记忆总结阶段('remind');
      set记忆总结草稿('');
      set记忆总结错误('');
      return;
    }
    memoryTaskIdRef.current = nextId;
    set待处理记忆总结任务(nextTask);
  };

  useEffect(() => {
    openingAppliedKeyRef.current = '';
    memoryTaskIdRef.current = '';
    set待处理记忆总结任务(null);
    set记忆总结阶段('idle');
    set记忆总结草稿('');
    set记忆总结错误('');
  }, [roomState?.id, roomState?.script?.id]);

  useEffect(() => {
    const players = roomState?.players || [];
    const myPlayer = resolveSelfPlayer(players, accountUsername);
    setIsReady(Boolean(myPlayer?.isReady));
    setTotalPlayers(players.length || 0);
    setReadyCount(players.filter((p: any) => p.isReady).length);
    setRoomStatus(roomState?.status || 'waiting');
    setCurrentRound(roomState?.currentRound || 1);
    setStreamingMode(roomState?.streamingMode === 'off' ? 'off' : 'provider');
    setPlayerInputStates(buildPlayerInputStates(players));
    同步记忆任务状态(roomState);
    set游戏数据((prev) => {
      let next = syncGameDataFromRoom(prev, roomState, roleTemplates, accountUsername);
      next = syncLogsFromRoom(next, roomState);

      const openingKey = buildOpeningApplyKey(roomState);
      if (openingKey && openingAppliedKeyRef.current !== openingKey) {
        next = applyOpeningInitialState(next, roomState);
        openingAppliedKeyRef.current = openingKey;
      }
      return next;
    });
  }, [roomState, accountUsername, roleTemplates]);

  const currentPlayerInfo = useMemo<角色信息>(() => {
    const currentId = 游戏数据.角色.当前主控角色ID;
    const currentRole =
      游戏数据.角色.玩家角色列表.find((role: 玩家角色) => role.玩家ID === currentId || role.角色ID === currentId) ||
      游戏数据.角色.玩家角色列表[0];
    return toCharacterInfo(currentRole, roomState?.script?.description || '');
  }, [游戏数据.角色, roomState?.script?.description]);
  const currentPlayerSlot = useMemo<number>(() => {
    const currentId = 游戏数据.角色.当前主控角色ID;
    const currentRole =
      游戏数据.角色.玩家角色列表.find((role: 玩家角色) => role.玩家ID === currentId || role.角色ID === currentId) ||
      游戏数据.角色.玩家角色列表[0];
    return Number(currentRole?.玩家序号 || 0);
  }, [游戏数据.角色]);

  const worldInfo = useMemo<游戏世界观>(() => {
    return buildWorldInfoFromTree(游戏数据, roomState?.script);
  }, [游戏数据, roomState?.script]);
  const selfRoomPlayer = useMemo(
    () => resolveSelfPlayer(roomState?.players || [], accountUsername),
    [roomState?.players, accountUsername]
  );

  useEffect(() => {
    const socket = socketService.socket;
    if (!socket) return;

    const onRoundComplete = ({ room, story }: { room: any; story: string }) => {
      setIsReady(false);
      setReadyCount(0);
      setIsStreaming(false);
      setStreamPreview('');
      if (room) {
        setRoomStatus(room.status || 'waiting');
        setCurrentRound(room.currentRound || 1);
        setStreamingMode(room.streamingMode === 'off' ? 'off' : 'provider');
        setPlayerInputStates(buildPlayerInputStates(room.players || []));
        同步记忆任务状态(room);
        const nextTemplates: ScriptRoleTemplate[] = room?.script?.roleTemplates || [];
        set游戏数据((prev) => {
          let synced = syncGameDataFromRoom(prev, room, nextTemplates, accountUsername);
          synced = syncLogsFromRoom(synced, room);
          const openingKey = buildOpeningApplyKey(room);
          if (openingKey && openingAppliedKeyRef.current !== openingKey) {
            synced = applyOpeningInitialState(synced, room);
            openingAppliedKeyRef.current = openingKey;
          }
          if (!story?.trim()) return synced;
          return {
            ...synced,
            剧情: {
              ...synced.剧情,
              当前回合总述: story.trim()
            }
          };
        });
      }
    };

    const onRoomUpdated = (updatedRoom: any) => {
      const nextPlayers = updatedRoom?.players || [];
      const me = resolveSelfPlayer(nextPlayers, accountUsername);
      setIsReady(Boolean(me?.isReady));
      setTotalPlayers(nextPlayers.length);
      setReadyCount(nextPlayers.filter((p: any) => p.isReady).length);
      setRoomStatus(updatedRoom?.status || 'waiting');
      setCurrentRound(updatedRoom?.currentRound || 1);
      setStreamingMode(updatedRoom?.streamingMode === 'off' ? 'off' : 'provider');
      setPlayerInputStates(buildPlayerInputStates(nextPlayers));
      同步记忆任务状态(updatedRoom);
      const nextTemplates: ScriptRoleTemplate[] = updatedRoom?.script?.roleTemplates || [];
      set游戏数据((prev) => {
        let next = syncGameDataFromRoom(prev, updatedRoom, nextTemplates, accountUsername);
        next = syncLogsFromRoom(next, updatedRoom);
        const openingKey = buildOpeningApplyKey(updatedRoom);
        if (openingKey && openingAppliedKeyRef.current !== openingKey) {
          next = applyOpeningInitialState(next, updatedRoom);
          openingAppliedKeyRef.current = openingKey;
        }
        return next;
      });
    };

    const onNewLog = (log: 游戏日志) => {
      set游戏数据((prev) => ({
        ...prev,
        日志列表: mergeLogsById(prev.日志列表, [log])
      }));
    };

    const onTurnProgress = ({ readyCount: rc, total }: { readyCount: number; total: number }) => {
      setReadyCount(rc);
      setTotalPlayers(total);
      if (rc === 0) {
        setIsReady(false);
      }
    };

    const onStoryStreamStart = () => {
      setIsStreaming(true);
      setStreamPreview('');
    };

    const onStoryStreamChunk = ({ chunk }: { chunk: string }) => {
      setStreamPreview((prev) => prev + chunk);
    };

    const onStoryStreamEnd = () => {
      setIsStreaming(false);
      setStreamPreview('');
    };

    const onPlayerStory = ({ story, round }: { story: string; round: number }) => {
      const roundValue = Number.isFinite(Number(round)) && Number(round) > 0
        ? Math.floor(Number(round))
        : (Number(currentRound) || 1);
      const newLog: 游戏日志 = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        发送者: '系统',
        内容: story,
        类型: '旁白',
        时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        回合: roundValue
      };

      set游戏数据((prev) => ({
        ...prev,
        日志列表: [...prev.日志列表, newLog],
        剧情: {
          ...prev.剧情,
          当前回合总述: story?.trim() || prev.剧情.当前回合总述,
          分组叙事: [
            ...prev.剧情.分组叙事,
            {
              分组ID: `self-${round}-${Date.now()}`,
              可见玩家ID: prev.角色.当前主控角色ID ? [prev.角色.当前主控角色ID] : [],
              标题: `第${round}回合个人叙事`,
              内容: story
            }
          ]
        }
      }));
      setIsStreaming(false);
      setStreamPreview('');
    };

    socket.on('round_complete', onRoundComplete);
    socket.on('room_updated', onRoomUpdated);
    socket.on('new_log', onNewLog);
    socket.on('turn_progress', onTurnProgress);
    socket.on('story_stream_start', onStoryStreamStart);
    socket.on('story_stream_chunk', onStoryStreamChunk);
    socket.on('story_stream_end', onStoryStreamEnd);
    socket.on('player_story', onPlayerStory);

    return () => {
      socket.off('round_complete', onRoundComplete);
      socket.off('room_updated', onRoomUpdated);
      socket.off('new_log', onNewLog);
      socket.off('turn_progress', onTurnProgress);
      socket.off('story_stream_start', onStoryStreamStart);
      socket.off('story_stream_chunk', onStoryStreamChunk);
      socket.off('story_stream_end', onStoryStreamEnd);
      socket.off('player_story', onPlayerStory);
    };
  }, [accountUsername, currentRound]);

  const aiStepText = useMemo(() => {
    const streamText = streamingMode === 'provider' ? '流式：跟随API提供者' : '流式：关闭';
    const openingRoundRaw = Number(roomState?.script?.opening?.openingStory?.round);
    const openingRound = Number.isFinite(openingRoundRaw) && openingRoundRaw > 0 ? Math.floor(openingRoundRaw) : 1;
    const hasInputProgress = playerInputStates.some((item) => item.isReady || Boolean(item.action));
    const isOpeningScene = (roomStatus === 'playing' || roomStatus === 'waiting') && currentRound === openingRound && !hasInputProgress;
    switch (roomStatus) {
      case 'processing':
        return `AI步骤 1/3：收集并分组玩家行动（${streamText}）`;
      case 'story_generation':
        return `AI步骤 2/3：生成主剧情并分发可见内容（${streamText}）`;
      case 'settlement':
        return `AI步骤 3/3：结算状态变化（${streamText}）`;
      case 'playing':
      case 'waiting':
      default:
        return isOpeningScene
          ? `开场剧情已加载，等待玩家输入（第 ${currentRound} 回合，${streamText}）`
          : `等待玩家输入（第 ${currentRound} 回合，${streamText}）`;
    }
  }, [roomStatus, currentRound, streamingMode, roomState?.script?.opening?.openingStory?.round, playerInputStates]);

  const isOpeningScene = useMemo(() => {
    const openingRoundRaw = Number(roomState?.script?.opening?.openingStory?.round);
    const openingRound = Number.isFinite(openingRoundRaw) && openingRoundRaw > 0 ? Math.floor(openingRoundRaw) : 1;
    const hasInputProgress = playerInputStates.some((item) => item.isReady || Boolean(item.action));
    return (roomStatus === 'playing' || roomStatus === 'waiting') && currentRound === openingRound && !hasInputProgress;
  }, [roomState?.script?.opening?.openingStory?.round, playerInputStates, roomStatus, currentRound]);

  const roomStatusZh = useMemo(() => {
    switch (roomStatus) {
      case 'waiting':
        return '等待中';
      case 'playing':
        return '游戏中';
      case 'processing':
        return '处理中';
      case 'story_generation':
        return '剧情生成中';
      case 'settlement':
        return '结算中';
      default:
        return '未知';
    }
  }, [roomStatus]);

  const handleToggleStreamingMode = () => {
    if (!roomState?.id) return;
    const nextMode: 'off' | 'provider' = streamingMode === 'provider' ? 'off' : 'provider';
    setStreamingMode(nextMode);
    socketService.setRoomStreamingMode(roomState.id, nextMode);
  };

  const handleSendMessage = (text: string) => {
    const patchCommand = extractPublicStatePatchCommand(text);
    if (patchCommand) {
      if (!roomState?.id) return;
      if (!patchCommand.ok) {
        const warnLog: 游戏日志 = {
          id: `${Date.now()}-pubpatch-error`,
          发送者: '系统',
          内容: patchCommand.error,
          类型: '系统',
          时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        set游戏数据((prev) => ({
          ...prev,
          日志列表: [...prev.日志列表, warnLog]
        }));
        return;
      }
      void (async () => {
        const result = await socketService.applyPublicStatePatch({
          roomId: roomState.id,
          patch: patchCommand.patch,
          reason: '前端前缀命令'
        });
        if (!result.ok) {
          const errLog: 游戏日志 = {
            id: `${Date.now()}-pubpatch-fail`,
            发送者: '系统',
            内容: `公共状态写入失败：${result.error || '未知错误'}`,
            类型: '系统',
            时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          set游戏数据((prev) => ({
            ...prev,
            日志列表: [...prev.日志列表, errLog]
          }));
        }
      })();
      return;
    }

    if (isReady) return;

    const newLog: 游戏日志 = {
      id: Date.now().toString(),
      发送者: '玩家',
      内容: text,
      类型: '对话',
      时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set游戏数据((prev) => ({
      ...prev,
      日志列表: [...prev.日志列表, newLog]
    }));

    if (roomState?.id) {
      socketService.submitAction(roomState.id, text);
      setIsReady(true);
    }
  };

  const handleSendChat = (text: string) => {
    const newLog: 游戏日志 = {
      id: Date.now().toString(),
      发送者: '玩家',
      内容: text,
      类型: 'OOC',
      时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set游戏数据((prev) => ({
      ...prev,
      日志列表: [...prev.日志列表, newLog]
    }));

    if (roomState?.id) {
      socketService.sendChat(roomState.id, text);
    }
  };

  const 打开记忆总结 = () => {
    if (!待处理记忆总结任务) return;
    set记忆总结阶段((prev) => (prev === 'processing' || prev === 'review' ? prev : 'remind'));
  };

  const 开始记忆总结 = async () => {
    if (!待处理记忆总结任务 || !roomState?.id) return;
    set记忆总结阶段('processing');
    set记忆总结错误('');
    try {
      const result = await socketService.generateMemorySummary({
        roomId: roomState.id,
        taskId: 待处理记忆总结任务.id,
        temperature: 0.2
      });
      if (!result.ok) {
        set记忆总结错误(result.error || '记忆总结失败');
        set记忆总结阶段('review');
        return;
      }
      const cleaned = 清理记忆总结输出(result.summary || '');
      set记忆总结草稿(cleaned);
      set记忆总结阶段('review');
    } catch (error) {
      set记忆总结错误(String((error as Error)?.message || error || '记忆总结失败'));
      set记忆总结阶段('review');
    }
  };

  const 应用记忆总结 = async () => {
    if (!待处理记忆总结任务 || !roomState?.id) return;
    if (!记忆总结草稿.trim()) {
      set记忆总结错误('总结内容为空，请先生成或补充后再写入。');
      set记忆总结阶段('review');
      return;
    }
    const result = await socketService.applyMemorySummary({
      roomId: roomState.id,
      taskId: 待处理记忆总结任务.id,
      summary: 记忆总结草稿
    });
    if (!result.ok) {
      set记忆总结错误(result.error || '记忆写入失败');
      set记忆总结阶段('review');
      return;
    }
    set记忆总结阶段('idle');
    set记忆总结草稿('');
    set记忆总结错误('');
  };

  const 暂不处理记忆总结 = () => {
    set记忆总结阶段('idle');
    set记忆总结草稿('');
    set记忆总结错误('');
  };

  const 发起重Roll = async (prompt: string) => {
    if (!roomState?.id) return { ok: false, error: '房间不存在' };
    return socketService.requestReroll({ roomId: roomState.id, prompt });
  };

  const 投票重Roll = async (approve: boolean) => {
    if (!roomState?.id) return { ok: false, error: '房间不存在' };
    return socketService.respondRerollVote({ roomId: roomState.id, approve });
  };

  const 取消重Roll = () => {
    if (!roomState?.id) return;
    socketService.cancelRerollVote(roomState.id);
  };

  const 保存到手动槽位 = async (slotIndex: number, note?: string) => {
    if (!roomState?.id) return { ok: false, error: '房间不存在' };
    return socketService.saveToSlot({ roomId: roomState.id, slotType: 'manual', slotIndex, note });
  };

  const 请求存档槽位 = () => {
    if (!roomState?.id) return;
    socketService.requestSaveSlots(roomState.id);
  };

  const 发起读档投票 = async (slotType: 'manual' | 'auto', slotIndex: number) => {
    if (!roomState?.id) return { ok: false, error: '房间不存在' };
    return socketService.requestLoadVote({ roomId: roomState.id, slotType, slotIndex });
  };

  const 投票读档 = async (approve: boolean) => {
    if (!roomState?.id) return { ok: false, error: '房间不存在' };
    return socketService.respondLoadVote({ roomId: roomState.id, approve });
  };

  const 取消读档投票 = () => {
    if (!roomState?.id) return;
    socketService.cancelLoadVote(roomState.id);
  };

  const actionLogs = 游戏数据.日志列表.filter((log) => log.类型 !== 'OOC');
  const chatLogs = 游戏数据.日志列表.filter((log) => log.类型 === 'OOC');
  const memorySystem: 记忆系统结构 = useMemo(
    () => 规范化记忆系统(游戏数据.记忆系统 || 创建空记忆系统()),
    [游戏数据.记忆系统]
  );
  const selfSpeakerNames = useMemo(
    () => collectSelfSpeakerNames({ roomPlayers: roomState?.players || [], gameData: 游戏数据, accountUsername }),
    [roomState?.players, 游戏数据, accountUsername]
  );

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col relative bg-zinc-950">
      <Header 世界信息={worldInfo} />

      <main className="flex-1 min-h-0 flex items-stretch justify-center overflow-hidden relative p-4">
        <div className="w-full h-full max-h-full flex border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl bg-black">
          <div className="w-[280px] flex-shrink-0 z-20 bg-black relative">
            <CharacterPanel 角色={currentPlayerInfo} 玩家序号={currentPlayerSlot} />
          </div>

          <div className="flex-1 flex flex-col min-w-0 z-10 relative bg-zinc-900/50 p-3">
            <div className="flex-1 rounded-2xl overflow-hidden border border-zinc-800/50 shadow-inner relative flex flex-col">
              <GameLogPanel
                日志列表={actionLogs}
                onSendMessage={handleSendMessage}
                isReady={isReady}
                readyCount={readyCount}
                totalPlayers={totalPlayers}
                isStreaming={isStreaming}
                streamPreview={streamPreview}
                roomStatus={roomStatusZh}
                currentRound={currentRound}
                aiStepText={aiStepText}
                playerInputStates={playerInputStates}
                selfSpeakerNames={selfSpeakerNames}
                aiThinkingHistory={Array.isArray(roomState?.aiThinkingHistory) ? roomState.aiThinkingHistory : []}
                currentGameTimeText={worldInfo.当前时间}
                isOpeningScene={isOpeningScene}
                streamingMode={streamingMode}
                onToggleStreamingMode={handleToggleStreamingMode}
              />
            </div>
          </div>

          <div className="w-[320px] flex-shrink-0 z-20 bg-black relative">
            <RightPanel
              logs={chatLogs}
              onSendChat={handleSendChat}
              onOpenSettings={() => setIsSettingsOpen(true)}
              players={roomState?.players || []}
              roomState={roomState}
              gameData={游戏数据}
              memorySystem={memorySystem}
              memoryPendingTask={待处理记忆总结任务}
              memorySummaryStage={记忆总结阶段}
              onOpenMemorySummary={打开记忆总结}
              selfPlayerId={String(selfRoomPlayer?.id || '')}
              onRequestReroll={发起重Roll}
              onRespondReroll={投票重Roll}
              onCancelReroll={取消重Roll}
              onSaveToSlot={保存到手动槽位}
              onRequestSaveSlots={请求存档槽位}
              onRequestLoadVote={发起读档投票}
              onRespondLoadVote={投票读档}
              onCancelLoadVote={取消读档投票}
            />
          </div>
        </div>
      </main>

      <Footer
        onlineCount={roomState?.players?.length || 1}
        roomStatusText={roomStatusZh}
        currentRound={currentRound}
        centerText={aiStepText}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onExitToHome={onExit}
        roomId={roomId}
        accountUsername={accountUsername}
      />

      <MemorySummaryFlowModal
        open={Boolean(待处理记忆总结任务) && 记忆总结阶段 !== 'idle'}
        stage={记忆总结阶段}
        task={待处理记忆总结任务}
        draft={记忆总结草稿}
        error={记忆总结错误}
        onStart={() => void 开始记忆总结()}
        onCancel={暂不处理记忆总结}
        onBack={() => set记忆总结阶段('remind')}
        onDraftChange={set记忆总结草稿}
        onApply={() => void 应用记忆总结()}
      />
    </div>
  );
}

