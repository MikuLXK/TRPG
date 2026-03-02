import { useEffect, useMemo, useState } from 'react';
import { adminService, type AdminLog, type AdminRoom, type AdminScript, type AdminUser } from '../../services/adminService';

type AdminTab = 'dashboard' | 'users' | 'scripts' | 'rooms' | 'logs';

interface AdminPanelProps {
  adminUsername: string;
  onLogout: () => void;
}

export default function AdminPanel({ adminUsername, onLogout }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [dashboard, setDashboard] = useState<{
    users: Record<string, number>;
    scripts: Record<string, number>;
    rooms: Record<string, number>;
    recentLogs: AdminLog[];
  } | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userQuery, setUserQuery] = useState('');
  const [userStatus, setUserStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [userRole, setUserRole] = useState<'all' | 'player' | 'moderator'>('all');

  const [scripts, setScripts] = useState<AdminScript[]>([]);
  const [scriptEditor, setScriptEditor] = useState<string>('');
  const [editingScriptId, setEditingScriptId] = useState<string>('');

  const [rooms, setRooms] = useState<AdminRoom[]>([]);

  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logQuery, setLogQuery] = useState('');
  const [logType, setLogType] = useState<'all' | 'user' | 'script' | 'room' | 'system'>('all');

  const resetHint = () => {
    setError('');
    setMessage('');
  };

  const withAction = async (action: () => Promise<void>, successText?: string) => {
    setLoading(true);
    resetHint();
    try {
      await action();
      if (successText) setMessage(successText);
    } catch (err) {
      setError(String((err as Error)?.message || '操作失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const data = await adminService.dashboard();
    setDashboard(data);
  };

  const loadUsers = async () => {
    const data = await adminService.getUsers({
      q: userQuery,
      status: userStatus === 'all' ? '' : userStatus,
      role: userRole === 'all' ? '' : userRole,
      page: 1,
      pageSize: 100,
    });
    setUsers(data.rows);
    setUsersTotal(data.total);
  };

  const loadScripts = async () => {
    const data = await adminService.getScripts();
    setScripts(data.rows);
  };

  const loadRooms = async () => {
    const data = await adminService.getRooms();
    setRooms(data.rows);
  };

  const loadLogs = async () => {
    const data = await adminService.getLogs({
      q: logQuery,
      targetType: logType === 'all' ? '' : logType,
      page: 1,
      pageSize: 200,
    });
    setLogs(data.rows);
    setLogsTotal(data.total);
  };

  useEffect(() => {
    void withAction(async () => {
      if (tab === 'dashboard') await loadDashboard();
      if (tab === 'users') await loadUsers();
      if (tab === 'scripts') await loadScripts();
      if (tab === 'rooms') await loadRooms();
      if (tab === 'logs') await loadLogs();
    });
  }, [tab]);

  const selectedScript = useMemo(() => scripts.find((script) => script.id === editingScriptId), [scripts, editingScriptId]);

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-200 overflow-hidden flex">
      <aside className="w-56 border-r border-zinc-800 p-4 flex flex-col gap-2 bg-zinc-900/40">
        <div className="text-amber-400 text-sm font-bold mb-3">管理端</div>
        <button className={tabBtn(tab === 'dashboard')} onClick={() => setTab('dashboard')}>数据看板</button>
        <button className={tabBtn(tab === 'users')} onClick={() => setTab('users')}>用户管理</button>
        <button className={tabBtn(tab === 'scripts')} onClick={() => setTab('scripts')}>剧本管理</button>
        <button className={tabBtn(tab === 'rooms')} onClick={() => setTab('rooms')}>房间监控</button>
        <button className={tabBtn(tab === 'logs')} onClick={() => setTab('logs')}>系统日志</button>

        <div className="mt-auto pt-3 border-t border-zinc-800 text-xs text-zinc-500">
          <div>当前管理员：{adminUsername}</div>
          <button
            type="button"
            className="mt-2 w-full px-3 py-2 rounded border border-red-900/50 text-red-300 hover:bg-red-900/20"
            onClick={onLogout}
          >
            退出管理端
          </button>
        </div>
      </aside>

      <main className="flex-1 p-5 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-amber-500">TRPG 管理后台</h1>
          <button
            disabled={loading}
            className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            onClick={() => {
              void withAction(async () => {
                if (tab === 'dashboard') await loadDashboard();
                if (tab === 'users') await loadUsers();
                if (tab === 'scripts') await loadScripts();
                if (tab === 'rooms') await loadRooms();
                if (tab === 'logs') await loadLogs();
              }, '已刷新');
            }}
          >
            刷新
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        {message && <div className="mb-3 text-sm text-emerald-400">{message}</div>}

        {tab === 'dashboard' && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="用户统计" lines={dashboard ? [
              `总用户: ${dashboard.users.total ?? 0}`,
              `活跃: ${dashboard.users.active ?? 0}`,
              `禁用: ${dashboard.users.disabled ?? 0}`,
              `管理员: ${dashboard.users.moderators ?? 0}`,
            ] : ['加载中...']} />
            <StatCard title="剧本统计" lines={dashboard ? [
              `总剧本: ${dashboard.scripts.total ?? 0}`,
              `已发布: ${dashboard.scripts.published ?? 0}`,
              `内置: ${dashboard.scripts.builtin ?? 0}`,
              `自定义: ${dashboard.scripts.custom ?? 0}`,
            ] : ['加载中...']} />
            <StatCard title="房间统计" lines={dashboard ? [
              `总房间: ${dashboard.rooms.total ?? 0}`,
              `活跃: ${dashboard.rooms.active ?? 0}`,
              `等待中: ${dashboard.rooms.waiting ?? 0}`,
              `在线玩家: ${dashboard.rooms.onlinePlayers ?? 0}`,
            ] : ['加载中...']} />

            <div className="md:col-span-3 bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
              <div className="font-bold mb-3">最近操作日志</div>
              <div className="space-y-2 text-sm">
                {(dashboard?.recentLogs || []).map((log) => (
                  <div key={log.id} className="border border-zinc-800 rounded p-2 flex justify-between">
                    <span>{new Date(log.timestamp).toLocaleString()} | {log.operator} | {log.action} | {log.targetType}:{log.targetId}</span>
                  </div>
                ))}
                {!dashboard?.recentLogs?.length && <div className="text-zinc-500">暂无数据</div>}
              </div>
            </div>
          </section>
        )}

        {tab === 'users' && (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="按用户名检索"
                className="flex-1 min-w-[220px] bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
              />
              <select
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value as typeof userStatus)}
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
              >
                <option value="all">全部状态</option>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as typeof userRole)}
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
              >
                <option value="all">全部角色</option>
                <option value="player">player</option>
                <option value="moderator">moderator</option>
              </select>
              <button
                className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800"
                onClick={() => void withAction(loadUsers)}
              >查询</button>
            </div>
            <div className="text-xs text-zinc-500">匹配用户：{usersTotal}</div>

            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.username} className="bg-zinc-900/40 border border-zinc-800 rounded p-3 flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-semibold">{user.username}</div>
                    <div className="text-zinc-500 font-mono text-xs mt-0.5">UID: {user.uid}</div>
                    <div className="text-zinc-500">角色: {user.role} | 状态: {user.status} | 创建: {new Date(user.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 text-xs border border-zinc-700 rounded"
                      onClick={() => void withAction(async () => {
                        await adminService.updateUser(user.username, { status: user.status === 'active' ? 'disabled' : 'active' });
                        await loadUsers();
                      }, '用户状态已更新')}
                    >
                      {user.status === 'active' ? '禁用' : '启用'}
                    </button>
                    <button
                      className="px-2 py-1 text-xs border border-zinc-700 rounded"
                      onClick={() => void withAction(async () => {
                        await adminService.updateUser(user.username, { role: user.role === 'moderator' ? 'player' : 'moderator' });
                        await loadUsers();
                      }, '用户角色已更新')}
                    >切换角色</button>
                    <button
                      className="px-2 py-1 text-xs border border-zinc-700 rounded"
                      onClick={() => {
                        const pass = window.prompt(`重置 ${user.username} 的密码（至少6位）`, '123456');
                        if (!pass) return;
                        void withAction(async () => {
                          await adminService.updateUser(user.username, { password: pass });
                        }, '密码已重置');
                      }}
                    >重置密码</button>
                    <button
                      className="px-2 py-1 text-xs border border-red-900/50 text-red-300 rounded"
                      onClick={() => {
                        if (!window.confirm(`确认删除用户 ${user.username} ?`)) return;
                        void withAction(async () => {
                          await adminService.deleteUser(user.username);
                          await loadUsers();
                        }, '用户已删除');
                      }}
                    >删除用户</button>
                  </div>
                </div>
              ))}
              {!users.length && <div className="text-zinc-500">暂无用户数据</div>}
            </div>
          </section>
        )}

        {tab === 'scripts' && (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-2">
              {scripts.map((script) => (
                <div key={script.id} className="bg-zinc-900/40 border border-zinc-800 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{script.title}</div>
                      <div className="text-xs text-zinc-500">ID: {script.id} | {script.source} | {script.isPublished ? '已发布' : '未发布'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 text-xs border border-zinc-700 rounded" onClick={() => {
                        setEditingScriptId(script.id);
                        setScriptEditor(JSON.stringify(script, null, 2));
                      }}>编辑</button>
                      <button className="px-2 py-1 text-xs border border-zinc-700 rounded" onClick={() => void withAction(async () => {
                        await adminService.publishScript(script.id, !script.isPublished);
                        await loadScripts();
                      }, '发布状态已更新')}>{script.isPublished ? '下线' : '发布'}</button>
                      <button className="px-2 py-1 text-xs border border-red-900/50 text-red-300 rounded" onClick={() => {
                        if (!window.confirm(`确认删除剧本 ${script.title} ?`)) return;
                        void withAction(async () => {
                          await adminService.deleteScript(script.id);
                          await loadScripts();
                          if (editingScriptId === script.id) {
                            setEditingScriptId('');
                            setScriptEditor('');
                          }
                        }, '剧本已删除');
                      }}>删除</button>
                    </div>
                  </div>
                </div>
              ))}
              {!scripts.length && <div className="text-zinc-500">暂无剧本</div>}
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3">
              <div className="text-sm font-bold mb-2">剧本 JSON 编辑器</div>
              <textarea
                value={scriptEditor}
                onChange={(e) => setScriptEditor(e.target.value)}
                className="w-full h-[460px] bg-zinc-950 border border-zinc-700 rounded p-3 font-mono text-xs"
                placeholder="粘贴剧本 JSON（创建/更新）"
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="px-3 py-2 text-sm border border-zinc-700 rounded"
                  onClick={() => {
                    const now = Date.now();
                    const seed = {
                      id: `admin-script-${now}`,
                      title: '新剧本',
                      description: '',
                      tags: ['admin'],
                      content: '',
                      settingPrompt: '',
                      finalGoal: '',
                      roleTemplates: [],
                      isPublished: false,
                    };
                    setEditingScriptId('');
                    setScriptEditor(JSON.stringify(seed, null, 2));
                  }}
                >新建模板</button>
                <button
                  className="px-3 py-2 text-sm border border-amber-700 text-amber-400 rounded"
                  onClick={() => void withAction(async () => {
                    if (!scriptEditor.trim()) throw new Error('请先输入JSON');
                    const payload = JSON.parse(scriptEditor);
                    if (editingScriptId) {
                      await adminService.updateScript(editingScriptId, payload);
                    } else {
                      await adminService.createScript(payload);
                    }
                    await loadScripts();
                  }, editingScriptId ? '剧本已更新' : '剧本已创建')}
                >保存</button>
              </div>
              {selectedScript && <div className="text-xs text-zinc-500 mt-2">当前编辑：{selectedScript.title}</div>}
            </div>
          </section>
        )}

        {tab === 'rooms' && (
          <section className="space-y-2">
            {rooms.map((room) => (
              <div key={room.id} className="bg-zinc-900/40 border border-zinc-800 rounded p-3 flex justify-between items-start">
                <div className="text-sm">
                  <div className="font-semibold">{room.name} ({room.id})</div>
                  <div className="text-zinc-500">剧本: {room.scriptTitle} | 状态: {room.status} | 轮次: {room.currentRound}</div>
                  <div className="text-zinc-500">在线/上限: {room.activePlayers}/{room.maxPlayers} | 日志: {room.logCount}</div>
                  <div className="text-zinc-500">玩家: {room.players.map((p) => p.name).join('、') || '无'}</div>
                </div>
                <button
                  className="px-2 py-1 text-xs border border-red-900/50 text-red-300 rounded"
                  onClick={() => {
                    if (!window.confirm(`确认强制关闭房间 ${room.name}?`)) return;
                    void withAction(async () => {
                      await adminService.forceCloseRoom(room.id);
                      await loadRooms();
                    }, '房间已强制关闭');
                  }}
                >强制关闭</button>
              </div>
            ))}
            {!rooms.length && <div className="text-zinc-500">暂无房间</div>}
          </section>
        )}

        {tab === 'logs' && (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="检索 operator/action/target"
                className="flex-1 min-w-[220px] bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
              />
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as typeof logType)}
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
              >
                <option value="all">全部类型</option>
                <option value="user">user</option>
                <option value="script">script</option>
                <option value="room">room</option>
                <option value="system">system</option>
              </select>
              <button className="px-3 py-2 rounded border border-zinc-700" onClick={() => void withAction(loadLogs)}>查询</button>
            </div>
            <div className="text-xs text-zinc-500">匹配日志：{logsTotal}</div>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="bg-zinc-900/40 border border-zinc-800 rounded p-2 text-xs">
                  <div>{new Date(log.timestamp).toLocaleString()} | {log.operator} | {log.action} | {log.targetType}:{log.targetId}</div>
                  {log.details && <pre className="mt-1 text-zinc-500 whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>}
                </div>
              ))}
              {!logs.length && <div className="text-zinc-500">暂无日志</div>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function tabBtn(active: boolean) {
  return `w-full text-left px-3 py-2 rounded border text-sm ${
    active
      ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
  }`;
}

function StatCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
      <div className="font-bold mb-2">{title}</div>
      <div className="space-y-1 text-sm text-zinc-300">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}
