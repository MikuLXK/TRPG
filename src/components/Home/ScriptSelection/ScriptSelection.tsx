import React from 'react';
import { BookOpen, Check } from 'lucide-react';
import { useScripts, Script } from '../../../hooks/useScripts';

interface ScriptSelectionProps {
  selectedScriptId: string | null;
  onSelectScript: (scriptId: string) => void;
}

export default function ScriptSelection({ selectedScriptId, onSelectScript }: ScriptSelectionProps) {
  const { scripts, loading } = useScripts();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[400px]">
        <p className="text-zinc-500">正在加载剧本列表...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
      {scripts.map((script) => (
        <div
          key={script.id}
          onClick={() => onSelectScript(script.id)}
          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4
            ${selectedScriptId === script.id
              ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
              : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-600'}`}
        >
          <div className={`w-12 h-16 rounded bg-zinc-800 flex-shrink-0 flex items-center justify-center
             ${selectedScriptId === script.id ? 'text-amber-500' : 'text-zinc-600'}`}>
            <BookOpen size={20} />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold mb-1 ${selectedScriptId === script.id ? 'text-amber-500' : 'text-zinc-200'}`}>
              {script.title}
            </h3>
            <p className="text-xs text-zinc-500 line-clamp-2">
              {script.description}
            </p>
            <div className="mt-3 flex gap-2">
              {script.tags.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-1 bg-zinc-900 rounded text-zinc-500">{tag}</span>
              ))}
            </div>
          </div>
          {selectedScriptId === script.id && (
            <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-zinc-950 flex-shrink-0">
              <Check size={14} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
