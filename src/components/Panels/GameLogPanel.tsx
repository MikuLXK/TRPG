import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { 游戏日志 } from '../../types/GameData';
import { Send, Waves, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameLogPanelProps {
  日志列表: 游戏日志[];
  onSendMessage: (text: string) => void;
  isReady?: boolean;
  readyCount?: number;
  totalPlayers?: number;
  isStreaming?: boolean;
  streamPreview?: string;
  roomStatus?: string;
  currentRound?: number;
  aiStepText?: string;
  playerInputStates?: Array<{
    id: string;
    name: string;
    isReady: boolean;
    action: string;
  }>;
  streamingMode?: 'off' | 'provider';
  onToggleStreamingMode?: () => void;
}

export default function GameLogPanel({
  日志列表,
  onSendMessage,
  isReady = false,
  readyCount = 0,
  totalPlayers = 0,
  isStreaming = false,
  streamPreview = '',
  roomStatus = '等待中',
  currentRound = 1,
  aiStepText = '等待玩家输入',
  playerInputStates = [],
  streamingMode = 'provider',
  onToggleStreamingMode,
}: GameLogPanelProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [日志列表, streamPreview]);

  const handleSend = () => {
    if (inputText.trim() && !isReady) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const waitingText = totalPlayers > 0 ? `已提交 ${readyCount}/${totalPlayers}，等待其他玩家...` : '行动已提交，等待其他玩家...';

  return (
    <div className="h-full flex flex-col bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar z-10" ref={scrollRef}>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-zinc-500 mr-2">当前回合</span>
              <span className="text-amber-400 font-semibold">第 {currentRound} 回合</span>
            </div>
            <div className="text-zinc-400">状态：{roomStatus}</div>
          </div>
          <div className="text-cyan-300">{aiStepText}</div>
          <div className="flex flex-wrap gap-2">
            {playerInputStates.map((player) => {
              const actionPreview = player.action ? (player.action.length > 20 ? `${player.action.slice(0, 20)}...` : player.action) : '';
              return (
                <div key={player.id} className={`px-2 py-1 rounded-md border ${player.isReady ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>
                  <span>{player.name}</span>
                  <span className="ml-1">{player.isReady ? '已提交' : '未提交'}</span>
                  {actionPreview && <span className="ml-1 text-zinc-500">({actionPreview})</span>}
                </div>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {日志列表.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${log.发送者 === '玩家' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-60">
                {log.类型 !== '旁白' && (
                  <>
                    <span className={`text-xs font-bold uppercase tracking-wider
                      ${log.发送者 === '系统' ? 'text-amber-500' : 'text-cyan-500'}`}>
                      {log.发送者}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{log.时间戳}</span>
                  </>
                )}
              </div>

              <div className={`
                max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-sm border
                ${log.类型 === '旁白'
                  ? 'bg-zinc-900/90 border-amber-500/50 text-amber-100 w-full text-center font-serif tracking-wide my-4 py-6 shadow-[0_0_15px_rgba(245,158,11,0.1)] mx-auto'
                  : log.类型 === '系统'
                    ? 'bg-zinc-900/80 border-amber-900/30 text-zinc-300 w-full text-center italic'
                    : log.发送者 === '玩家'
                      ? 'bg-cyan-950/30 border-cyan-800/30 text-cyan-100 rounded-tr-none'
                      : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-200 rounded-tl-none'
                }
              `}>
                {log.内容}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isStreaming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
            <div className="w-full p-4 rounded-xl border border-amber-500/30 bg-zinc-900/70 text-amber-200 text-sm leading-relaxed whitespace-pre-wrap">
              {streamPreview || '剧情生成中...'}
              <span className="inline-block w-1.5 h-4 ml-1 bg-amber-400 animate-pulse align-middle"></span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-3 bg-zinc-900 border-t border-zinc-800 z-20">
        {isReady && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-500 animate-pulse mb-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            {waitingText}
          </div>
        )}

        <div className={`relative flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border transition-colors shadow-inner h-12
          ${isReady ? 'border-zinc-800 opacity-50 cursor-not-allowed' : 'border-zinc-700 focus-within:border-amber-500/50'}
        `}>
          <button
            onClick={onToggleStreamingMode}
            type="button"
            title={streamingMode === 'provider' ? '流式已开启（跟随API提供者）' : '流式已关闭'}
            className={`h-full aspect-square flex items-center justify-center rounded-lg transition-colors shadow-lg active:scale-95
              ${streamingMode === 'provider'
                ? 'bg-cyan-900/60 text-cyan-200 hover:bg-cyan-800/70'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}
            `}
          >
            {streamingMode === 'provider' ? <Waves size={16} strokeWidth={2.4} /> : <Ban size={16} strokeWidth={2.4} />}
          </button>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isReady}
            placeholder={isReady ? '等待回合结束...' : '输入你的行动...'}
            className="flex-1 bg-transparent text-zinc-200 px-2 py-1 h-full resize-none focus:outline-none text-sm custom-scrollbar placeholder:text-zinc-600 leading-tight disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={isReady}
            className={`h-full aspect-square flex items-center justify-center rounded-lg transition-colors shadow-lg active:scale-95
              ${isReady
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-zinc-950 hover:shadow-amber-500/20'}
            `}
          >
            <Send size={16} strokeWidth={2.5} />
          </button>

          <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-amber-500/50 rounded-tr-md pointer-events-none"></div>
          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-amber-500/50 rounded-bl-md pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
