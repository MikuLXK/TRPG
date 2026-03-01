export interface AdminUser {
  username: string;
  role: 'player' | 'moderator';
  status: 'active' | 'disabled';
  createdAt: number;
  lastLoginAt: number | null;
}

export interface AdminScript {
  id: string;
  title: string;
  description: string;
  tags: string[];
  content: string;
  settingPrompt: string;
  finalGoal: string;
  roleTemplates: any[];
  source: 'builtin' | 'admin';
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminRoom {
  id: string;
  name: string;
  scriptId: string;
  scriptTitle: string;
  hostId: string;
  status: string;
  hasStarted: boolean;
  players: Array<{
    id: string;
    name: string;
    accountUsername?: string;
    isOnline: boolean;
    isReady: boolean;
  }>;
  activePlayers: number;
  maxPlayers: number;
  currentRound: number;
  logCount: number;
}

export interface AdminLog {
  id: string;
  timestamp: number;
  operator: string;
  action: string;
  targetType: 'user' | 'script' | 'room' | 'system';
  targetId: string;
  details?: Record<string, unknown>;
}

const ADMIN_TOKEN_KEY = 'trpg_admin_token';

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '3000'
    ? 'http://localhost:3000'
    : '';

class AdminService {
  getToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  }

  setToken(token: string) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  private async request<T>(path: string, init: RequestInit = {}, requireAuth = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };

    if (requireAuth) {
      const token = this.getToken();
      if (!token) {
        throw new Error('管理员尚未登录');
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: '请求失败' }));
      const message = payload.error || '请求失败';
      if (response.status === 401 || response.status === 403) {
        this.clearToken();
        throw new Error(`登录已过期，请重新登录（${message}）`);
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  async login(username: string, password: string) {
    const result = await this.request<{ token: string; user: AdminUser }>(
      '/api/admin/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      false,
    );
    this.setToken(result.token);
    return result;
  }

  async me() {
    return this.request<{ user: AdminUser }>('/api/admin/me');
  }

  async dashboard() {
    return this.request<{
      users: Record<string, number>;
      scripts: Record<string, number>;
      rooms: Record<string, number>;
      recentLogs: AdminLog[];
    }>('/api/admin/dashboard');
  }

  async getUsers(params: { q?: string; status?: string; role?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.status) query.set('status', params.status);
    if (params.role) query.set('role', params.role);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return this.request<{ rows: AdminUser[]; total: number; page: number; pageSize: number }>(`/api/admin/users?${query.toString()}`);
  }

  async updateUser(username: string, payload: { status?: 'active' | 'disabled'; role?: 'player' | 'moderator'; password?: string }) {
    return this.request<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getScripts() {
    return this.request<{ rows: AdminScript[] }>('/api/admin/scripts');
  }

  async createScript(payload: Partial<AdminScript>) {
    return this.request<{ script: AdminScript }>('/api/admin/scripts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateScript(id: string, payload: Partial<AdminScript>) {
    return this.request<{ script: AdminScript }>(`/api/admin/scripts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async publishScript(id: string, isPublished: boolean) {
    return this.request<{ script: AdminScript }>(`/api/admin/scripts/${encodeURIComponent(id)}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished }),
    });
  }

  async deleteScript(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/scripts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async getRooms() {
    return this.request<{ rows: AdminRoom[] }>('/api/admin/rooms');
  }

  async forceCloseRoom(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/rooms/${encodeURIComponent(id)}/force-close`, {
      method: 'POST',
    });
  }

  async getLogs(params: { q?: string; targetType?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.targetType) query.set('targetType', params.targetType);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return this.request<{ rows: AdminLog[]; total: number; page: number; pageSize: number }>(`/api/admin/logs?${query.toString()}`);
  }
}

export const adminService = new AdminService();
