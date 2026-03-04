import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { 游戏状态 } from '../types/gameData';
import type { ScriptDefinition } from '../types/Script';

export interface AuthUserProfile {
  uid: string;
  username: string;
  role: 'player' | 'moderator';
  status: 'active' | 'disabled';
  createdAt: number;
  lastLoginAt: number | null;
}

export interface WorkshopScriptRecord extends ScriptDefinition {
  ownerUid: string;
  ownerUsername: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  downloads: number;
}

export interface CloudSaveRecord {
  id: string;
  name: string;
  data?: 游戏状态;
  ownerUid: string;
  ownerUsername: string;
  createdAt: number;
  updatedAt: number;
}

interface GameDB extends DBSchema {
  saves: {
    key: string;
    value: {
      id: string;
      name: string;
      timestamp: number;
      data: 游戏状态;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  scripts: {
    key: string;
    value: ScriptDefinition;
  };
  users: {
    key: string;
    value: {
      uid: string;
      username: string;
      password: string;
      createdAt: number;
    };
  };
}

const DB_NAME = 'TRPG_Game_DB';
const DB_VERSION = 4;
const PLAYER_TOKEN_KEY = 'trpg_player_token';

const API_BASE =
  typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '3000'
    ? 'http://localhost:3000'
    : '';

class DBService {
  private dbPromise: Promise<IDBPDatabase<GameDB>>;

  constructor() {
    this.dbPromise = openDB<GameDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('scripts')) {
          db.createObjectStore('scripts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
      },
    });
  }

  getToken() {
    return localStorage.getItem(PLAYER_TOKEN_KEY) || '';
  }

  setToken(token: string) {
    localStorage.setItem(PLAYER_TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(PLAYER_TOKEN_KEY);
  }

  private async request<T>(path: string, init: RequestInit = {}, requireAuth = false): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };

    if (requireAuth) {
      const token = this.getToken();
      if (!token) {
        throw new Error('用户尚未登录');
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
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  async saveGame(saveName: string, gameData: 游戏状态): Promise<string> {
    const db = await this.dbPromise;
    const saveId = Date.now().toString();
    await db.put('saves', {
      id: saveId,
      name: saveName,
      timestamp: Date.now(),
      data: gameData,
    });
    return saveId;
  }

  async loadGame(saveId: string): Promise<游戏状态 | undefined> {
    const db = await this.dbPromise;
    const save = await db.get('saves', saveId);
    return save?.data;
  }

  async getSaveRecord(saveId: string) {
    const db = await this.dbPromise;
    return db.get('saves', saveId);
  }

  async upsertSaveRecord(save: {
    id: string;
    name: string;
    timestamp: number;
    data: 游戏状态;
  }) {
    const db = await this.dbPromise;
    await db.put('saves', save);
  }

  async getAllSaves() {
    const db = await this.dbPromise;
    return db.getAll('saves');
  }

  async deleteSave(saveId: string) {
    const db = await this.dbPromise;
    await db.delete('saves', saveId);
  }

  async saveSetting(key: string, value: any) {
    const db = await this.dbPromise;
    await db.put('settings', { key, value });
  }

  async getSetting(key: string) {
    const db = await this.dbPromise;
    const setting = await db.get('settings', key);
    return setting?.value;
  }

  async upsertScript(script: ScriptDefinition) {
    const db = await this.dbPromise;
    await db.put('scripts', script);
  }

  async getScript(scriptId: string): Promise<ScriptDefinition | undefined> {
    const db = await this.dbPromise;
    return db.get('scripts', scriptId);
  }

  async getAllScripts(): Promise<ScriptDefinition[]> {
    const db = await this.dbPromise;
    return db.getAll('scripts');
  }

  async deleteScript(scriptId: string) {
    const db = await this.dbPromise;
    await db.delete('scripts', scriptId);
  }

  withUserKey(username: string, key: string) {
    const normalized = username.trim();
    return `${normalized}::${key}`;
  }

  private async persistLocalUser(user: AuthUserProfile, plainPassword: string) {
    const db = await this.dbPromise;
    await db.put('users', {
      uid: user.uid,
      username: user.username,
      password: plainPassword,
      createdAt: user.createdAt,
    });
  }

  async registerUser(username: string, password: string) {
    const normalized = username.trim();
    if (!normalized) {
      throw new Error('用户名不能为空');
    }
    if (!password) {
      throw new Error('密码不能为空');
    }

    const result = await this.request<{ token: string; user: AuthUserProfile; expiresIn: number }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username: normalized, password }),
      },
      false,
    );

    this.setToken(result.token);
    await this.persistLocalUser(result.user, password);
    return result;
  }

  async loginUser(username: string, password: string) {
    const normalized = username.trim();
    const result = await this.request<{ token: string; user: AuthUserProfile; expiresIn: number }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username: normalized, password }),
      },
      false,
    );

    this.setToken(result.token);
    await this.persistLocalUser(result.user, password);
    return result;
  }

  async me() {
    return this.request<{ user: AuthUserProfile }>('/api/auth/me', {}, true);
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return this.request<{ ok: boolean }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      },
      true,
    );
  }

  async saveUserSetting(username: string, key: string, value: any) {
    return this.saveSetting(this.withUserKey(username, key), value);
  }

  async getUserSetting(username: string, key: string) {
    return this.getSetting(this.withUserKey(username, key));
  }

  async saveUserGame(username: string, saveName: string, gameData: 游戏状态): Promise<string> {
    return this.saveGame(this.withUserKey(username, saveName), gameData);
  }

  async getAllUserSaves(username: string) {
    const prefix = `${username.trim()}::`;
    const all = await this.getAllSaves();
    return all.filter((save: any) => String(save?.name || '').startsWith(prefix));
  }

  async saveUserRoomDraft(username: string, draft: { roomName: string; scriptId: string; password?: string; intro?: string }) {
    return this.saveUserSetting(username, 'createRoomDraft', draft);
  }

  async getUserRoomDraft(username: string): Promise<{ roomName: string; scriptId: string; password?: string; intro?: string } | undefined> {
    return this.getUserSetting(username, 'createRoomDraft');
  }

  async addUserCreatedRoom(username: string, room: {
    id: string;
    roomName: string;
    scriptId: string;
    scriptTitle?: string;
    intro?: string;
    createdAt: number;
  }) {
    const current = (await this.getUserSetting(username, 'createdRooms')) as Array<any> | undefined;
    const list = Array.isArray(current) ? current : [];
    const next = [room, ...list.filter((item) => item?.id !== room.id)].slice(0, 50);
    await this.saveUserSetting(username, 'createdRooms', next);
  }

  async getUserCreatedRooms(username: string): Promise<Array<any>> {
    const current = await this.getUserSetting(username, 'createdRooms');
    return Array.isArray(current) ? current : [];
  }

  async getWorkshopScripts(params: { q?: string; mine?: boolean } = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.mine) query.set('mine', '1');
    return this.request<{ rows: WorkshopScriptRecord[] }>(`/api/workshop/scripts?${query.toString()}`, {}, true);
  }

  async createWorkshopScript(payload: Partial<WorkshopScriptRecord>) {
    return this.request<{ script: WorkshopScriptRecord }>(
      '/api/workshop/scripts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async updateWorkshopScript(id: string, payload: Partial<WorkshopScriptRecord>) {
    return this.request<{ script: WorkshopScriptRecord }>(
      `/api/workshop/scripts/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async deleteWorkshopScript(id: string) {
    return this.request<{ ok: boolean }>(
      `/api/workshop/scripts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      true,
    );
  }

  async downloadWorkshopScript(id: string) {
    return this.request<{ script: WorkshopScriptRecord }>(
      `/api/workshop/scripts/${encodeURIComponent(id)}/download`,
      { method: 'POST' },
      true,
    );
  }

  async getCloudSaves() {
    return this.request<{ rows: CloudSaveRecord[] }>('/api/cloud/saves', {}, true);
  }

  async getCloudSave(id: string) {
    return this.request<{ save: CloudSaveRecord }>(`/api/cloud/saves/${encodeURIComponent(id)}`, {}, true);
  }

  async createCloudSave(name: string, data: 游戏状态, id?: string) {
    return this.request<{ save: CloudSaveRecord }>(
      '/api/cloud/saves',
      {
        method: 'POST',
        body: JSON.stringify({ name, data, id }),
      },
      true,
    );
  }

  async updateCloudSave(id: string, payload: { name?: string; data?: 游戏状态 }) {
    return this.request<{ save: CloudSaveRecord }>(
      `/api/cloud/saves/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      true,
    );
  }

  async deleteCloudSave(id: string) {
    return this.request<{ ok: boolean }>(`/api/cloud/saves/${encodeURIComponent(id)}`, { method: 'DELETE' }, true);
  }

  async clearAllData() {
    const db = await this.dbPromise;
    await db.clear('saves');
    await db.clear('settings');
    await db.clear('scripts');
    await db.clear('users');
    this.clearToken();
  }

  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }
}

export const dbService = new DBService();

