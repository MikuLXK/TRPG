import { useEffect, useState } from 'react';
import { ChevronLeft, CloudDownload, CloudUpload, RefreshCw, Save, Trash2 } from 'lucide-react';
import { dbService, type CloudSaveRecord } from '../../services/dbService';
import type { ToastType } from '../UI/Toast';

interface CloudSaveCenterProps {
  accountUsername: string;
  onBack: () => void;
  showToast: (message: string, type?: ToastType) => void;
}

export default function CloudSaveCenter({ accountUsername, onBack, showToast }: CloudSaveCenterProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CloudSaveRecord[]>([]);
  const [localSaves, setLocalSaves] = useState<Array<{ id: string; name: string; timestamp: number }>>([]);
  const [selectedLocalId, setSelectedLocalId] = useState('');
  const [cloudName, setCloudName] = useState('');

  const loadCloud = async () => {
    const result = await dbService.getCloudSaves();
    setRows(result.rows);
  };

  const loadLocal = async () => {
    const result = await dbService.getAllUserSaves(accountUsername);
    const normalized = result
      .map((item: any) => ({
        id: String(item.id),
        name: String(item.name || ''),
        timestamp: Number(item.timestamp) || 0,
      }))
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
    setLocalSaves(normalized);
    if (!selectedLocalId && normalized.length > 0) {
      setSelectedLocalId(normalized[0].id);
      setCloudName(normalized[0].name.replace(`${accountUsername}::`, '').slice(0, 40));
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCloud(), loadLocal()]);
    } catch (error) {
      showToast(String((error as Error)?.message || '加载云存档失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const uploadSelectedLocal = async () => {
    if (!selectedLocalId) {
      showToast('请选择本地存档', 'error');
      return;
    }

    setLoading(true);
    try {
      const localData = await dbService.loadGame(selectedLocalId);
      const localMeta = await dbService.getSaveRecord(selectedLocalId);
      if (!localData || !localMeta) {
        throw new Error('本地存档不存在');
      }

      const finalName = cloudName.trim() || String(localMeta.name || '未命名云存档').replace(`${accountUsername}::`, '');
      await dbService.createCloudSave(finalName, localData, selectedLocalId);
      showToast('已上传到云端', 'success');
      await loadCloud();
    } catch (error) {
      showToast(String((error as Error)?.message || '上传失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadToLocal = async (row: CloudSaveRecord) => {
    setLoading(true);
    try {
      const detail = await dbService.getCloudSave(row.id);
      if (!detail.save?.data) throw new Error('云存档数据为空');
      await dbService.upsertSaveRecord({
        id: row.id,
        name: dbService.withUserKey(accountUsername, row.name),
        timestamp: row.updatedAt,
        data: detail.save.data,
      });
      showToast(`已下载到本地：${row.name}`, 'success');
      await loadLocal();
    } catch (error) {
      showToast(String((error as Error)?.message || '下载失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeCloud = async (row: CloudSaveRecord) => {
    if (!window.confirm(`确认删除云存档《${row.name}》？`)) return;
    setLoading(true);
    try {
      await dbService.deleteCloudSave(row.id);
      showToast('云存档已删除', 'success');
      await loadCloud();
    } catch (error) {
      showToast(String((error as Error)?.message || '删除失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full h-full p-6 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded border border-zinc-700 hover:bg-zinc-800">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-xl font-bold text-cyan-400">云存档中心</h2>
          <div className="ml-auto text-xs text-zinc-500">当前用户：{accountUsername}</div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">上传本地存档到云端</div>
              <button className="px-2 py-1 text-xs border border-zinc-700 rounded" onClick={() => void refreshAll()}>
                <RefreshCw size={13} className="inline mr-1" />刷新
              </button>
            </div>

            <select
              value={selectedLocalId}
              onChange={(e) => {
                setSelectedLocalId(e.target.value);
                const found = localSaves.find((item) => item.id === e.target.value);
                if (found) setCloudName(found.name.replace(`${accountUsername}::`, '').slice(0, 40));
              }}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            >
              {localSaves.map((save) => (
                <option key={save.id} value={save.id}>
                  {save.name} ({new Date(save.timestamp).toLocaleString()})
                </option>
              ))}
              {!localSaves.length && <option value="">暂无本地存档</option>}
            </select>

            <input
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              placeholder="云端存档名称"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm"
            />

            <button
              className="px-3 py-2 border border-cyan-700 text-cyan-300 rounded"
              onClick={() => void uploadSelectedLocal()}
              disabled={!localSaves.length}
            >
              <CloudUpload size={14} className="inline mr-1" />上传到云端
            </button>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="font-semibold">我的云存档</div>
            <div className="space-y-2 max-h-[520px] overflow-auto custom-scrollbar pr-1">
              {rows.map((row) => (
                <div key={row.id} className="border border-zinc-800 bg-zinc-950/50 rounded p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">ID: {row.id}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">更新时间：{new Date(row.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-1">
                      <button className="px-2 py-1 text-xs rounded border border-emerald-800/60 text-emerald-300" onClick={() => void downloadToLocal(row)}>
                        <CloudDownload size={13} className="inline mr-1" />下载
                      </button>
                      <button className="px-2 py-1 text-xs rounded border border-red-900/50 text-red-300" onClick={() => void removeCloud(row)}>
                        <Trash2 size={13} className="inline mr-1" />删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!rows.length && <div className="text-sm text-zinc-500">暂无云存档</div>}
            </div>
          </section>
        </div>

        {loading && <div className="text-xs text-zinc-500">处理中...</div>}
      </div>
    </div>
  );
}
