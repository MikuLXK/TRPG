import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { socketService } from '../../services/socketService';
import { dbService } from '../../services/dbService';
import SettingsModal from '../Settings/SettingsModal';
import Toast, { ToastType } from '../UI/Toast';
import MainMenu from './MainMenu/MainMenu';
import CreateRoom from './CreateRoom/CreateRoom';
import JoinRoom from './JoinRoom/JoinRoom';
import WorkshopCenter from './WorkshopCenter';
import CloudSaveCenter from './CloudSaveCenter';
import type { ScriptDefinition } from '../../types/Script';
import type { 游戏状态 } from '../../types/gameData';

interface HomeProps {
  onJoinGame: (roomState: any) => void;
  accountUsername: string;
  initialPlayerName?: string;
  onLogout?: () => void;
  onOpenAccountManager?: () => void;
  accountUid?: string;
}

export default function Home({ onJoinGame, accountUsername, initialPlayerName = '', onLogout, onOpenAccountManager, accountUid }: HomeProps) {
  const [view, setView] = useState<'main' | 'create' | 'join' | 'workshop' | 'cloud'>('main');
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [createRoomDraft, setCreateRoomDraft] = useState<{ roomName?: string; scriptId?: string; password?: string; intro?: string } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  const computeHash = (value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return String(Math.abs(hash));
  };

  const ensureSharedScriptInstalled = async (roomState: any) => {
    const shared = roomState?.sharedAssets?.script;
    if (!shared?.payload) return;

    const localScript = await dbService.getScript(shared.id);
    const localHash = localScript ? computeHash(localScript) : '';
    if (localHash === shared.hash) return;

    const confirmed = window.confirm(`房间正在使用房主共享剧本《${shared.name}》。\n是否下载到本地并使用？`);
    if (!confirmed) return;

    await dbService.upsertScript(shared.payload as ScriptDefinition);
    showToast(`已下载剧本：${shared.name}`, 'success');
  };

  const ensureSharedSaveInstalled = async (roomState: any) => {
    const shared = roomState?.sharedAssets?.save;
    if (!shared?.payload) return;

    const installMarker = `${accountUsername}::shared-save::${shared.id}::${shared.hash}`;
    if (localStorage.getItem(installMarker) === '1') return;

    const localSave = await dbService.getSaveRecord(shared.id);
    const localHash = localSave ? computeHash(localSave.data) : '';
    if (localHash === shared.hash) {
      localStorage.setItem(installMarker, '1');
      return;
    }

    const confirmed = window.confirm(`房间中有共享继续游戏存档《${shared.name}》。\n是否下载到本地？`);
    if (!confirmed) return;

    const savePayload = shared.payload as { id: string; name: string; timestamp: number; data: 游戏状态 };
    if (savePayload?.id && savePayload?.data) {
      await dbService.upsertSaveRecord(savePayload);
      localStorage.setItem(installMarker, '1');
      showToast(`已下载存档：${shared.name}`, 'success');
    }
  };

  useEffect(() => {
    socketService.connect();

    const socket = socketService.socket;
    if (socket) {
      const onRoomCreated = async ({ roomState }: { roomState: any }) => {
        console.log("Room created, joining game:", roomState.id);
        try {
          await dbService.addUserCreatedRoom(accountUsername, {
            id: roomState.id,
            roomName: roomState.name,
            scriptId: roomState.scriptId,
            scriptTitle: roomState.script?.title,
            intro: roomState.intro,
            createdAt: Date.now(),
          });
        } catch {
          // ignore storage errors
        }
        onJoinGame(roomState);
      };

      const onRoomJoined = async (roomState: any) => {
        // This event is fired when a player (including the current user) successfully joins a room.
        if (roomState.players.some((p: any) => p.id === socket.id)) {
            await ensureSharedScriptInstalled(roomState);
            await ensureSharedSaveInstalled(roomState);
            console.log("Successfully joined room, transitioning to game:", roomState.id);
            onJoinGame(roomState);
        }
      };

      const onError = (msg: string) => {
        showToast(`Error: ${msg}`, 'error');
      };

      socket.on("room_created", onRoomCreated);
      socket.on("room_updated", onRoomJoined);
      socket.on("error", onError);

      return () => {
        socket.off("room_created", onRoomCreated);
        socket.off("room_updated", onRoomJoined);
        socket.off("error", onError);
      };
    }
  }, [accountUsername, onJoinGame]);

  useEffect(() => {
    let cancelled = false;

    const loadAccountScopedData = async () => {
      try {
        const [savedPlayerName, savedDraft] = await Promise.all([
          dbService.getUserSetting(accountUsername, 'playerName'),
          dbService.getUserRoomDraft(accountUsername),
        ]);

        if (cancelled) return;

        if (typeof savedPlayerName === 'string' && savedPlayerName.trim()) {
          setPlayerName(savedPlayerName);
        } else {
          setPlayerName(initialPlayerName);
        }

        if (savedDraft && typeof savedDraft === 'object') {
          setCreateRoomDraft(savedDraft);
        } else {
          setCreateRoomDraft(null);
        }
      } catch {
        if (!cancelled) {
          setPlayerName(initialPlayerName);
          setCreateRoomDraft(null);
        }
      }
    };

    void loadAccountScopedData();

    return () => {
      cancelled = true;
    };
  }, [accountUsername, initialPlayerName]);

  useEffect(() => {
    const trimmed = playerName.trim();
    if (!trimmed) return;

    const timer = window.setTimeout(() => {
      void dbService.saveUserSetting(accountUsername, 'playerName', trimmed);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [accountUsername, playerName]);

  const handleCreateRoom = (params: { roomName: string, scriptId: string, password?: string, intro?: string, scriptPayload?: any }) => {
    if (!playerName.trim()) {
      showToast("请输入玩家昵称", 'error');
      return;
    }
    socketService.createRoom({
      ...params,
      playerName,
      accountUsername,
      scriptPayload: params.scriptPayload,
    });
  };

  const handleJoinRoom = (roomId: string, password?: string) => {
    if (!playerName.trim()) {
      showToast("请输入玩家昵称", 'error');
      return;
    }
    if (!roomId.trim()) {
      showToast("请输入或选择一个房间", 'error');
      return;
    }
    socketService.joinRoom(roomId, playerName, accountUsername, password);
  };

  const renderView = () => {
    switch (view) {
      case 'create':
        return (
          <CreateRoom
            playerName={playerName}
            setPlayerName={setPlayerName}
            onBack={() => setView('main')}
            onCreateRoom={handleCreateRoom}
            initialDraft={createRoomDraft}
            onDraftChange={(draft) => {
              setCreateRoomDraft(draft);
              void dbService.saveUserRoomDraft(accountUsername, draft);
            }}
          />
        );
      case 'join':
        return (
          <JoinRoom
            playerName={playerName}
            setPlayerName={setPlayerName}
            onBack={() => setView('main')}
            onJoinRoom={handleJoinRoom}
            accountUsername={accountUsername}
          />
        );
      case 'workshop':
        return (
          <WorkshopCenter
            accountUsername={accountUsername}
            onBack={() => setView('main')}
            showToast={showToast}
          />
        );
      case 'cloud':
        return (
          <CloudSaveCenter
            accountUsername={accountUsername}
            onBack={() => setView('main')}
            showToast={showToast}
          />
        );
      case 'main':
      default:
        return (
          <motion.div
            key="main"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="relative z-10 w-full h-full flex flex-col items-center justify-center"
          >
            <MainMenu setView={setView} setIsSettingsOpen={setIsSettingsOpen} />
          </motion.div>
        );
    }
  };

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden selection:bg-amber-500/30 selection:text-amber-200 relative">
      {(onLogout || onOpenAccountManager) && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {accountUid && (
            <div className="px-3 py-1.5 text-[11px] rounded border border-zinc-700 text-zinc-400 bg-zinc-950/60 font-mono">
              {accountUid}
            </div>
          )}
          {onOpenAccountManager && (
            <button
              type="button"
              onClick={onOpenAccountManager}
              className="px-3 py-1.5 text-xs rounded border border-amber-700/60 text-amber-300 hover:bg-amber-700/20"
            >
              账号管理
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-300 hover:text-red-300 hover:border-red-500/40"
            >
              退出登录
            </button>
          )}
        </div>
      )}

      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-zinc-950 to-zinc-950 pointer-events-none"></div>
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        accountUsername={accountUsername}
      />
    </div>
  );
}

