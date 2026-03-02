import { useEffect, useState } from 'react';
import { dbService, type AuthUserProfile } from '../../services/dbService';

interface AccountPanelProps {
  onBack: () => void;
  onLogout: () => void;
}

export default function AccountPanel({ onBack, onLogout }: AccountPanelProps) {
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await dbService.me();
      setProfile(result.user);
    } catch (err) {
      setError(String((err as Error)?.message || '获取账号信息失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleChangePassword = async () => {
    setError('');
    setMessage('');
    if (!oldPassword || !newPassword) {
      setError('请填写旧密码和新密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度至少 6 位');
      return;
    }

    setLoading(true);
    try {
      await dbService.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setMessage('密码已更新');
    } catch (err) {
      setError(String((err as Error)?.message || '修改密码失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-amber-500">账号管理</h2>
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 text-sm border border-zinc-700 rounded hover:bg-zinc-800"
          >
            返回
          </button>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {message && <div className="text-sm text-emerald-400">{message}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Info label="UID" value={profile?.uid || (loading ? '加载中...' : '-')} />
          <Info label="用户名" value={profile?.username || (loading ? '加载中...' : '-')} />
          <Info label="角色" value={profile?.role || (loading ? '加载中...' : '-')} />
          <Info label="状态" value={profile?.status || (loading ? '加载中...' : '-')} />
          <Info label="创建时间" value={profile ? new Date(profile.createdAt).toLocaleString() : (loading ? '加载中...' : '-')} />
          <Info label="最近登录" value={profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : '-'} />
        </div>

        <div className="border-t border-zinc-800 pt-4 space-y-3">
          <div className="text-sm font-semibold">修改密码</div>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm outline-none focus:border-amber-500"
            placeholder="旧密码"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm outline-none focus:border-amber-500"
            placeholder="新密码（至少6位）"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleChangePassword()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 rounded-lg font-bold text-sm"
            >
              保存新密码
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 border border-red-900/50 text-red-300 rounded-lg text-sm hover:bg-red-900/20"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded p-3">
      <div className="text-zinc-500 text-xs mb-1">{label}</div>
      <div className="font-mono break-all">{value}</div>
    </div>
  );
}
