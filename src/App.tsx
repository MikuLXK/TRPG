import { useState, useEffect } from 'react';
import GameView from './components/Game/GameView';
import Home from './components/Home/Home';
import WaitingRoom from './components/Home/WaitingRoom';
import AdminPanel from './components/Admin/AdminPanel';
import AccountPanel from './components/Account/AccountPanel';
import { socketService } from './services/socketService';
import { dbService, type AuthUserProfile } from './services/dbService';
import { adminService } from './services/adminService';

export default function App() {
  const [roomState, setRoomState] = useState<any>(null);
  const [isInGame, setIsInGame] = useState(false);

  const AUTH_USER_STORAGE_KEY = 'trpg_authed_user';
  const ADMIN_USER_STORAGE_KEY = 'trpg_admin_user';
  const [authedUser, setAuthedUser] = useState<string | null>(localStorage.getItem(AUTH_USER_STORAGE_KEY));
  const [authedProfile, setAuthedProfile] = useState<AuthUserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAccountMode, setIsAccountMode] = useState(false);
  const [adminUser, setAdminUser] = useState<string | null>(localStorage.getItem(ADMIN_USER_STORAGE_KEY));

  useEffect(() => {
    const token = adminService.getToken();
    if (!token) return;

    void adminService.me()
      .then(({ user }) => {
        localStorage.setItem(ADMIN_USER_STORAGE_KEY, user.username);
        setAdminUser(user.username);
        setIsAdminMode(true);
      })
      .catch(() => {
        adminService.clearToken();
        localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
        setAdminUser(null);
      });
  }, []);

  useEffect(() => {
    const token = dbService.getToken();
    if (!token) return;

    void dbService.me()
      .then(({ user }) => {
        localStorage.setItem(AUTH_USER_STORAGE_KEY, user.username);
        setAuthedUser(user.username);
        setAuthedProfile(user);
      })
      .catch(() => {
        dbService.clearToken();
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setAuthedUser(null);
        setAuthedProfile(null);
      });
  }, []);

  useEffect(() => {
    // Connect socket on mount
    socketService.connect();

    const socket = socketService.socket;
    if (socket) {
      socket.on('room_updated', (updatedRoom) => {
        setRoomState(updatedRoom);
        if (updatedRoom.status !== 'waiting') {
          setIsInGame(true);
        }
      });
    }

    return () => {
      // socketService.disconnect(); // Keep connection alive for now
    };
  }, []);

  const handleJoinGame = (room: any) => {
    setRoomState(room);
    setIsInGame(false); // Go to waiting room first
  };

  const handleStartGame = () => {
    setIsInGame(true);
  };

  const handleLeaveRoom = () => {
    // socketService.disconnect(); // Maybe just leave room event?
    // For now, reload page or reset state
    setRoomState(null);
    setIsInGame(false);
    window.location.reload(); // Simple reset for prototype
  };

  const handleAuth = async () => {
    const username = authUsername.trim();
    if (!username) {
      setAuthError('请输入用户名');
      return;
    }
    if (!authPassword) {
      setAuthError('请输入密码');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      if (authMode === 'register') {
        const result = await dbService.registerUser(username, authPassword);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, result.user.username);
        setAuthedUser(result.user.username);
        setAuthedProfile(result.user);
      } else {
        const result = await dbService.loginUser(username, authPassword);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, result.user.username);
        setAuthedUser(result.user.username);
        setAuthedProfile(result.user);
      }
      setAuthPassword('');
    } catch (error) {
      setAuthError(String((error as Error)?.message || '登录/注册失败'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    dbService.clearToken();
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setAuthedUser(null);
    setAuthedProfile(null);
    setIsAccountMode(false);
    setRoomState(null);
    setIsInGame(false);
    setAuthPassword('');
    setAuthError('');
  };

  const handleAdminLogin = async () => {
    const username = authUsername.trim();
    if (!username) {
      setAuthError('请输入管理员用户名');
      return;
    }
    if (!authPassword) {
      setAuthError('请输入管理员密码');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const result = await adminService.login(username, authPassword);
      localStorage.setItem(ADMIN_USER_STORAGE_KEY, result.user.username);
      setAdminUser(result.user.username);
      setAuthPassword('');
    } catch (error) {
      setAuthError(String((error as Error)?.message || '管理员登录失败'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    adminService.clearToken();
    localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    setAdminUser(null);
    setIsAdminMode(false);
    setAuthPassword('');
    setAuthError('');
  };

  if (isAdminMode) {
    if (!adminUser) {
      return (
        <div className="w-full h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h1 className="text-2xl font-bold text-amber-500 mb-2">TRPG 管理端登录</h1>
            <p className="text-xs text-zinc-500 mb-6">使用管理员账号登录后可管理用户、剧本、房间与日志。</p>

            <div className="space-y-3">
              <input
                type="text"
                autoComplete="username"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm outline-none focus:border-amber-500"
                placeholder="管理员用户名"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleAdminLogin();
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm outline-none focus:border-amber-500"
                placeholder="管理员密码"
              />
            </div>

            {authError && <div className="mt-3 text-xs text-red-400">{authError}</div>}

            <button
              type="button"
              disabled={authLoading}
              onClick={() => void handleAdminLogin()}
              className="mt-5 w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 rounded-lg font-bold text-sm"
            >
              {authLoading ? '处理中...' : '登录管理端'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAdminMode(false);
                setAuthError('');
              }}
              className="mt-3 w-full py-2.5 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm"
            >
              返回玩家登录
            </button>
          </div>
        </div>
      );
    }

    return <AdminPanel adminUsername={adminUser} onLogout={handleAdminLogout} />;
  }

  if (!authedUser) {
    return (
      <div className="w-full h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-2xl font-bold text-amber-500 mb-2">TRPG 登录</h1>
          <p className="text-xs text-zinc-500 mb-6">请先登录或注册，完成后才能进入游戏首页。</p>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
              className={`flex-1 py-2 rounded-lg border text-sm ${
                authMode === 'login' ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
              className={`flex-1 py-2 rounded-lg border text-sm ${
                authMode === 'register' ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              注册
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              autoComplete="username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm outline-none focus:border-amber-500"
              placeholder="用户名"
            />
            <input
              type="password"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleAuth();
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm outline-none focus:border-amber-500"
              placeholder="密码"
            />
          </div>

          {authError && <div className="mt-3 text-xs text-red-400">{authError}</div>}

          <button
            type="button"
            disabled={authLoading}
            onClick={() => void handleAuth()}
            className="mt-5 w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 rounded-lg font-bold text-sm"
          >
            {authLoading ? '处理中...' : authMode === 'login' ? '登录并进入' : '注册并进入'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAdminMode(true);
              setAuthError('');
            }}
            className="mt-3 w-full py-2.5 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm"
          >
            进入管理端
          </button>
        </div>
      </div>
    );
  }

  if (isAccountMode) {
    return (
      <AccountPanel
        onBack={() => setIsAccountMode(false)}
        onLogout={handleLogout}
      />
    );
  }

  if (!roomState) {
    return (
      <Home
        onJoinGame={handleJoinGame}
        accountUsername={authedUser}
        initialPlayerName={authedUser}
        onLogout={handleLogout}
        onOpenAccountManager={() => setIsAccountMode(true)}
        accountUid={authedProfile?.uid}
      />
    );
  }

  if (!isInGame) {
    return <WaitingRoom roomState={roomState} onStartGame={handleStartGame} onLeaveRoom={handleLeaveRoom} />;
  }

  return (
    <GameView
      roomState={roomState}
      onExit={handleLeaveRoom}
      roomId={roomState?.id}
      accountUsername={authedUser || ''}
    />
  );
}
