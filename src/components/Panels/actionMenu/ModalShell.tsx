import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalShellProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function ModalShell({ title, children, onClose }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-[190] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[82vh] bg-zinc-950 border border-zinc-700 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="text-lg font-bold text-amber-400 tracking-wider">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">{children}</div>
      </div>
    </div>
  );
}
