import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ArrowRight, Play } from 'lucide-react';
import ScriptSelection from '../ScriptSelection/ScriptSelection';
import { useScripts } from '../../../hooks/useScripts';

interface CreateRoomProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  onBack: () => void;
  onCreateRoom: (params: { roomName: string, scriptId: string, password?: string, intro?: string }) => void;
  initialDraft?: { roomName?: string; scriptId?: string; password?: string; intro?: string } | null;
  onDraftChange?: (draft: { roomName: string; scriptId: string; password?: string; intro?: string }) => void;
}

export default function CreateRoom({ playerName, setPlayerName, onBack, onCreateRoom, initialDraft = null, onDraftChange }: CreateRoomProps) {
  const [step, setStep] = useState<'script' | 'info'>('script');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(initialDraft?.scriptId || null);
  const [roomName, setRoomName] = useState(initialDraft?.roomName || '');
  const [roomPassword, setRoomPassword] = useState(initialDraft?.password || '');
  const [roomIntro, setRoomIntro] = useState(initialDraft?.intro || '');

  const { scripts } = useScripts();
  const selectedScript = scripts.find(s => s.id === selectedScriptId);
  const selectedScriptTitle = selectedScript ? selectedScript.title : '';

  useEffect(() => {
    if (!onDraftChange || !selectedScriptId) return;
    onDraftChange({
      roomName,
      scriptId: selectedScriptId,
      password: roomPassword,
      intro: roomIntro,
    });
  }, [onDraftChange, roomName, selectedScriptId, roomPassword, roomIntro]);

  const handleCreate = () => {
    if (!selectedScriptId) return;
    const finalRoomName = roomName.trim() || selectedScriptTitle;
    onCreateRoom({
      roomName: finalRoomName,
      scriptId: selectedScriptId,
      password: roomPassword,
      intro: roomIntro,
    });
  };

  return (
    <motion.div
      key="create"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-zinc-100">创建新房间</h2>

          <div className="ml-auto flex items-center gap-2 text-xs font-mono">
            <span className={`px-2 py-1 rounded ${step === 'script' ? 'bg-amber-500/20 text-amber-500' : 'text-zinc-600'}`}>01 剧本</span>
            <span className="text-zinc-700">/</span>
            <span className={`px-2 py-1 rounded ${step === 'info' ? 'bg-amber-500/20 text-amber-500' : 'text-zinc-600'}`}>02 信息</span>
          </div>
        </div>

        {step === 'script' ? (
          <div className="space-y-6">
            <ScriptSelection selectedScriptId={selectedScriptId} onSelectScript={setSelectedScriptId} />
            <div className="flex justify-end pt-4 border-t border-zinc-800">
              <button
                disabled={!selectedScriptId}
                onClick={() => setStep('info')}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 rounded-lg font-bold transition-colors shadow-lg shadow-amber-900/20 flex items-center gap-2"
              >
                下一步 <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">您的昵称 (Host)</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:border-amber-500 outline-none transition-colors"
                  placeholder="请输入您的昵称"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">房间名称</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className={`w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:border-amber-500 outline-none transition-colors ${!roomName && selectedScriptTitle ? 'italic placeholder:text-zinc-600' : ''}`}
                  placeholder={selectedScriptTitle || "给房间起个名字"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">房间密码（可选）</label>
                <input
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:border-amber-500 outline-none transition-colors"
                  placeholder="留空为公开房间"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">房间介绍 / 留言</label>
                <textarea
                  value={roomIntro}
                  onChange={(e) => setRoomIntro(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:border-amber-500 outline-none transition-colors h-24 resize-none"
                  placeholder="写点什么来吸引玩家..."
                />
              </div>
            </div>
            <div className="flex justify-between pt-4 border-t border-zinc-800">
              <button
                onClick={() => setStep('script')}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                上一步
              </button>
              <button
                onClick={handleCreate}
                className="px-8 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded-lg font-bold transition-colors shadow-lg shadow-amber-900/20 flex items-center gap-2"
              >
                <Play size={16} /> 创建并开始
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
