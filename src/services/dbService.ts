import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { 游戏状态 } from '../types/GameData';
import type { ScriptDefinition } from '../types/Script';

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
      username: string;
      password: string;
      createdAt: number;
    };
  };
}

const DB_NAME = 'TRPG_Game_DB';
const DB_VERSION = 3;

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

  async registerUser(username: string, password: string) {
    const db = await this.dbPromise;
    const normalized = username.trim();
    if (!normalized) {
      throw new Error('用户名不能为空');
    }
    if (!password) {
      throw new Error('密码不能为空');
    }

    const existing = await db.get('users', normalized);
    if (existing) {
      throw new Error('用户名已存在');
    }

    await db.put('users', {
      username: normalized,
      password,
      createdAt: Date.now(),
    });
  }

  async loginUser(username: string, password: string) {
    const db = await this.dbPromise;
    const normalized = username.trim();
    const user = await db.get('users', normalized);
    if (!user || user.password !== password) {
      throw new Error('用户名或密码错误');
    }
    return user;
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

  async clearAllData() {
    const db = await this.dbPromise;
    await db.clear('saves');
    await db.clear('settings');
    await db.clear('scripts');
    await db.clear('users');
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
