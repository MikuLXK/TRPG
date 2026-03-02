import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Download, Pencil, Plus, Save, Trash2, UploadCloud } from 'lucide-react';
import { dbService, type WorkshopScriptRecord } from '../../services/dbService';
import type { ToastType } from '../UI/Toast';

interface WorkshopCenterProps {
  accountUsername: string;
  onBack: () => void;
  showToast: (message: string, type?: ToastType) => void;
}

const emptySeed = () => ({
  id: `workshop-${Date.now()}`,
  title: '我的新剧本',
  description: '',
  tags: ['workshop'],
  content: '',
  settingPrompt: '',
  finalGoal: '',
  roleTemplates: [],
  isPublic: true,
});

export default function WorkshopCenter({ accountUsername, onBack, showToast }: WorkshopCenterProps) {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [rows, setRows] = useState<WorkshopScriptRecord[]>([]);
  const [editingId, setEditingId] = useState('');
  const [editor, setEditor] = useState('');

  const selected = useMemo(() => rows.find((item) => item.id === editingId), [rows, editingId]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await dbService.getWorkshopScripts({ q: query.trim(), mine: mineOnly });
      setRows(result.rows);
    } catch (error) {
      showToast(String((error as Error)?.message || '加载创意工坊失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveScript = async () => {
    if (!editor.trim()) {
      showToast('请先输入剧本 JSON', 'error');
      return;
    }

    let payload: Partial<WorkshopScriptRecord>;
    try {
      payload = JSON.parse(editor);
    } catch {
      showToast('JSON 格式错误', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await dbService.updateWorkshopScript(editingId, payload);
        showToast('剧本已更新', 'success');
      } else {
        await dbService.createWorkshopScript(payload);
        showToast('剧本已上传', 'success');
      }
      await load();
    } catch (error) {
      showToast(String((error as Error)?.message || '保存失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeScript = async (script: WorkshopScriptRecord) => {
    if (!window.confirm(`确认删除剧本《${script.title}》？`)) return;
    setLoading(true);
    try {
      await dbService.deleteWorkshopScript(script.id);
      if (editingId === script.id) {
        setEditingId('');
        setEditor('');
      }
      await load();
      showToast('剧本已删除', 'success');
    } catch (error) {
      showToast(String((error as Error)?.message || '删除失败'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const installToLocal = async (script: WorkshopScriptRecord) => {
    setLoading(true);
    try {
      const result = await dbService.downloadWorkshopScript(script.id);
      await dbService.upsertScript(result.script);
      showToast(`已下载到本地：${script.title}`, 'success');
      await load();
    } catch (error) {
      showToast(String((error as Error)?.message || '下载失败'), 'error');
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
          <h2 className="text-xl font-bold text-amber-400">创意工坊 · 剧本分享上传</h2>
          <div className="ml-auto text-xs text-zinc-500">当前用户：{accountUsername}</div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="检索剧本标题/描述/标签"
                className="flex-1 min-w-[220px] bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
              />
              <label className="text-xs text-zinc-400 flex items-center gap-2 px-2">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                仅看我的
              </label>
              <button className="px-3 py-2 border border-zinc-700 rounded hover:bg-zinc-800" onClick={() => void load()}>
                查询
              </button>
            </div>

            <div className="space-y-2 max-h-[560px] overflow-auto custom-scrollbar pr-1">
              {rows.map((script) => (
                <div key={script.id} className="border border-zinc-800 bg-zinc-950/50 rounded p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-zinc-100">{script.title}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">ID: {script.id}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        作者: {script.ownerUsername} | 可见性: {script.isPublic ? '公开' : '私有'} | 下载: {script.downloads}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="px-2 py-1 text-xs rounded border border-zinc-700"
                        onClick={() => {
                          setEditingId(script.id);
                          setEditor(JSON.stringify(script, null, 2));
                        }}
                      >
                        <Pencil size={13} className="inline mr-1" />编辑
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded border border-emerald-800/60 text-emerald-300"
                        onClick={() => void installToLocal(script)}
                      >
                        <Download size={13} className="inline mr-1" />下载
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded border border-red-900/50 text-red-300"
                        onClick={() => void removeScript(script)}
                      >
                        <Trash2 size={13} className="inline mr-1" />删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!rows.length && <div className="text-sm text-zinc-500">暂无工坊剧本</div>}
            </div>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">剧本 JSON 编辑器</div>
              <div className="text-xs text-zinc-500">{selected ? `编辑中：${selected.title}` : '新建模式'}</div>
            </div>
            <textarea
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              className="w-full h-[500px] bg-zinc-950 border border-zinc-700 rounded p-3 font-mono text-xs"
              placeholder="粘贴创意工坊剧本 JSON"
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-2 border border-zinc-700 rounded"
                onClick={() => {
                  setEditingId('');
                  setEditor(JSON.stringify(emptySeed(), null, 2));
                }}
              >
                <Plus size={14} className="inline mr-1" />新建模板
              </button>
              <button className="px-3 py-2 border border-amber-700 text-amber-300 rounded" onClick={() => void saveScript()}>
                <Save size={14} className="inline mr-1" />保存到工坊
              </button>
              <button className="px-3 py-2 border border-zinc-700 rounded" onClick={() => void load()}>
                <UploadCloud size={14} className="inline mr-1" />刷新列表
              </button>
            </div>
          </section>
        </div>

        {loading && <div className="text-xs text-zinc-500">处理中...</div>}
      </div>
    </div>
  );
}
