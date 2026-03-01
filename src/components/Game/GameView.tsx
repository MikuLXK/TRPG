import React, { useState, useEffect, useMemo } from 'react';
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

export default function GameView({ roomState, onExit, roomId, accountUsername = '' }: GameViewProps) {
  const [游戏数据, set游戏数据] = useState<游戏状态>(初始游戏状态);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState('');

  const roomPlayers = roomState?.players || [];
  const roleTemplates: ScriptRoleTemplate[] = roomState?.script?.roleTemplates || [];
  const selfId = socketService.socket?.id;

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

    const myPlayer = roomState?.players?.find((p: any) => p.id === socket.id);
    if (myPlayer) {
      setIsReady(myPlayer.isReady);
    }
    setTotalPlayers(roomState?.players?.length || 0);

    const onRoundComplete = ({ story }: { room: any; story: string }) => {
      const newLog: 游戏日志 = {
        id: Date.now().toString(),
        发送者: '系统',
        内容: story,
        类型: '旁白',
        时间戳: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      set游戏数据((prev) => ({
        ...prev,
        日志列表: [...prev.日志列表, newLog]
      }));

      setIsReady(false);
      setReadyCount(0);
      setIsStreaming(false);
      setStreamPreview('');
    };

    const onRoomUpdated = (updatedRoom: any) => {
      const me = updatedRoom.players.find((p: any) => p.id === socket.id);
      if (me) setIsReady(me.isReady);
      setTotalPlayers(updatedRoom.players.length);
      setReadyCount(updatedRoom.players.filter((p: any) => p.isReady).length);
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

    socket.on('round_complete', onRoundComplete);
    socket.on('room_updated', onRoomUpdated);
    socket.on('new_log', onNewLog);
    socket.on('turn_progress', onTurnProgress);
    socket.on('story_stream_start', onStoryStreamStart);
    socket.on('story_stream_chunk', onStoryStreamChunk);
    socket.on('story_stream_end', onStoryStreamEnd);

    return () => {
      socket.off('round_complete', onRoundComplete);
      socket.off('room_updated', onRoomUpdated);
      socket.off('new_log', onNewLog);
      socket.off('turn_progress', onTurnProgress);
      socket.off('story_stream_start', onStoryStreamStart);
      socket.off('story_stream_chunk', onStoryStreamChunk);
      socket.off('story_stream_end', onStoryStreamEnd);
    };
  }, [roomState]);

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
