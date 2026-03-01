import React from 'react';

interface MenuButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  primary?: boolean;
  small?: boolean;
}

export default function MenuButton({ onClick, icon, label, subLabel, primary, small }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full flex items-center gap-4 border transition-all duration-300 overflow-hidden text-left
        ${small ? 'p-4 rounded-xl' : 'p-6 rounded-2xl'}
        ${primary
          ? 'bg-amber-600/10 border-amber-500/50 hover:bg-amber-600/20 hover:border-amber-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]'
          : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600'
        }
      `}
    >
      <div className={`
        relative z-10 transition-colors duration-300
        ${primary ? 'text-amber-500 group-hover:text-amber-400' : 'text-zinc-400 group-hover:text-zinc-200'}
      `}>
        {icon}
      </div>
      <div className="relative z-10 flex-1">
        <div className={`
          font-bold tracking-wider transition-colors duration-300
          ${small ? 'text-base' : 'text-xl'}
          ${primary ? 'text-amber-100' : 'text-zinc-300 group-hover:text-white'}
        `}>
          {label}
        </div>
        {subLabel && (
          <div className="text-xs text-zinc-500 group-hover:text-zinc-400 mt-1 font-mono uppercase">
            {subLabel}
          </div>
        )}
      </div>
      
      {/* Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
    </button>
  );
}
