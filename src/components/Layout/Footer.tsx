import React from 'react';

interface FooterProps {
  onlineCount?: number;
}

export default function Footer({ onlineCount = 1 }: FooterProps) {
  return (
    <footer className="w-full h-8 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between px-4 text-xs text-zinc-500 font-mono">
      <div className="flex space-x-4">
        <span className="text-emerald-500">● 系统状态: 在线</span>
        <span>在线人数: {onlineCount}</span>
      </div>
      <div className="flex space-x-4">
        <span>延迟: 12ms</span>
        <span>版本: 1.0.0-Alpha</span>
      </div>
    </footer>
  );
}
