import { useState, useEffect, useMemo } from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import CharacterPanel from '../Panels/CharacterPanel';
import GameLogPanel from '../Panels/GameLogPanel';
import RightPanel from '../Panels/RightPanel';
import SettingsModal from '../Settings/SettingsModal';
import { 初始游戏状态, 游戏状态, 游戏日志, 角色信息 } from '../../types/GameData';
import type { ScriptRoleTemplate, CharacterAttributeBlock } from '../../types/Script';
import { socketService } from '../../services/socketService';

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

export default function GameView({ roomState, onExit, roomId, accountUsername = '' }: GameViewProps) {
  const [游戏数据, set游戏数据] = useState<游戏状态>(初始游戏状态);
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

  const roomPlayers = roomState?.players || [];
  const roleTemplates: ScriptRoleTemplate[] = roomState?.script?.roleTemplates || [];
  const selfId = socketService.socket?.id;

  const resolveSelfPlayer = (players: any[]) => {
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

  useEffect(() => {
    const players = roomState?.players || [];
    const myPlayer = resolveSelfPlayer(players);
    setIsReady(Boolean(myPlayer?.isReady));
    setTotalPlayers(players.length || 0);
    setReadyCount(players.filter((p: any) => p.isReady).length);
    setRoomStatus(roomState?.status || 'waiting');
    setCurrentRound(roomState?.currentRound || 1);
    setStreamingMode(roomState?.streamingMode === 'off' ? 'off' : 'provider');
    setPlayerInputStates(buildPlayerInputStates(players));
  }, [roomState, accountUsername]);

  const currentPlayerInfo = useMemo<角色信息>(() => {
    const selfPlayer = roomPlayers.find((p: any) => p.id === selfId);
    if (!selfPlayer) {
      return {
        姓名: '',
        职业: '',
        等级: 1,
        生命值: 0,
        最大生命值: 1,
        法力值: 0,
        最大法力值: 1,
        属性: {
          力量: 0,
          敏捷: 0,
          体质: 0,
          智力: 0,
          感知: 0,
          魅力: 0,
        },
        状态: [],
        背景故事: '',
      };
    }

    const profile = selfPlayer.characterProfile;
    const selectedTemplate = roleTemplates.find((t) => t.id === selfPlayer.selectedRoleTemplateId) || roleTemplates[0];
    const selectedClass = selectedTemplate?.classOptions?.find((o) => o.id === profile?.selectedClassId);
    const selectedRace = selectedTemplate?.raceOptions?.find((o) => o.id === profile?.selectedRaceId);
    const roleName = [selectedClass?.name, selectedRace?.name].filter(Boolean).join(' / ');

    const attrs: CharacterAttributeBlock = profile?.calculatedAttributes || {
      力量: 0,
      敏捷: 0,
      体质: 0,
      智力: 0,
      感知: 0,
      魅力: 0,
    };

    const maxHP = Math.max(1, 60 + attrs.体质 * 4);
    const maxMP = Math.max(0, 20 + attrs.智力 * 4);

    return {
      姓名: profile?.characterName?.trim() || selfPlayer.name || '未命名',
      职业: roleName || '未选择职业',
      等级: 1,
      生命值: maxHP,
      最大生命值: maxHP,
      法力值: maxMP,
      最大法力值: maxMP,
      属性: attrs,
      状态: ['正常'],
      背景故事: selectedTemplate?.description || roomState?.script?.description || '',
    };
  }, [roomPlayers, roleTemplates, selfId, roomState?.script?.description]);

  useEffect(() => {
    const socket = socketService.socket;
    if (!socket) return;

    const onRoundComplete = ({ room }: { room: any; story: string }) => {
      setIsReady(false);
      setReadyCount(0);
      setIsStreaming(false);
      setStreamPreview('');
      if (room) {
        setRoomStatus(room.status || 'waiting');
        setCurrentRound(room.currentRound || 1);
        setStreamingMode(room.streamingMode === 'off' ? 'off' : 'provider');
        setPlayerInputStates(buildPlayerInputStates(room.players || []));
      }
    };

    const onRoomUpdated = (updatedRoom: any) => {
      const nextPlayers = updatedRoom?.players || [];
      const me = resolveSelfPlayer(nextPlayers);
      setIsReady(Boolean(me?.isReady));
      setTotalPlayers(nextPlayers.length);
      setReadyCount(nextPlayers.filter((p: any) => p.isReady).length);
      setRoomStatus(updatedRoom?.status || 'waiting');
      setCurrentRound(updatedRoom?.currentRound || 1);
      setStreamingMode(updatedRoom?.streamingMode === 'off' ? 'off' : 'provider');
      setPlayerInputStates(buildPlayerInputStates(nextPlayers));
    };

    const onNewLog = (log: 游戏日志) => {
      set游戏数据((prev) => ({
        ...prev,
        日志列表: [...prev.日志列表, log]
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

    const onPlayerStory = ({ story }: { story: string; round: number }) => {
      const newLog: 游戏日志 = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        发送者: '系统',
        内容: story,
        类型: '旁白',
        时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      set游戏数据((prev) => ({
        ...prev,
        日志列表: [...prev.日志列表, newLog]
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
  }, [accountUsername]);

  const aiStepText = useMemo(() => {
    const streamText = streamingMode === 'provider' ? '流式：跟随API提供者' : '流式：关闭';
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
        return `等待玩家输入（第 ${currentRound} 回合，${streamText}）`;
    }
  }, [roomStatus, currentRound, streamingMode]);

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

  const actionLogs = 游戏数据.日志列表.filter((log) => log.类型 !== 'OOC');
  const chatLogs = 游戏数据.日志列表.filter((log) => log.类型 === 'OOC');

  return (
    <div className="w-full h-full flex flex-col relative bg-zinc-950">
      <Header 世界信息={游戏数据.世界} />

      <main className="flex-1 flex items-center justify-center overflow-hidden relative p-4">
        <div className="w-full h-full flex border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl bg-black">
          <div className="w-[280px] flex-shrink-0 z-20 bg-black relative">
            <CharacterPanel 角色={currentPlayerInfo} />
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
            />
          </div>
        </div>
      </main>

      <Footer onlineCount={roomState?.players?.length || 1} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onExitToHome={onExit}
        roomId={roomId}
        accountUsername={accountUsername}
      />
    </div>
  );
}
