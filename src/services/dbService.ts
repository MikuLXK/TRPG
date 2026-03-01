import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { 游戏状态 } from '../types/GameData';

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
}

const DB_NAME = 'TRPG_Game_DB';
const DB_VERSION = 1;

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

  async clearAllData() {
    const db = await this.dbPromise;
    await db.clear('saves');
    await db.clear('settings');
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
