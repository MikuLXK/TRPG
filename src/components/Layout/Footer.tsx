interface FooterProps {
  onlineCount?: number;
  roomStatusText?: string;
  centerText?: string;
  currentRound?: number;
}

export default function Footer({
  onlineCount = 1,
  roomStatusText = '等待中',
  centerText = '',
  currentRound = 1
}: FooterProps) {
  return (
    <footer className="w-full h-8 bg-zinc-950 border-t border-zinc-800 grid grid-cols-3 items-center px-4 text-xs text-zinc-500 font-mono gap-2">
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-emerald-500">● 系统状态: 在线</span>
        <span>在线人数: {onlineCount}</span>
      </div>
      <div className="text-center text-zinc-300 truncate">
        {centerText ? `${centerText}` : `等待玩家输入（第 ${currentRound} 回合）`}
      </div>
      <div className="flex items-center justify-end gap-4 min-w-0">
        <span className="text-amber-400 truncate">状态：{roomStatusText}</span>
        <span>版本: 1.0.0-Alpha</span>
      </div>
    </footer>
  );
}
