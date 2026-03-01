import React, { useState, useRef, useEffect } from 'react';
import { 游戏日志 } from '../../types/GameData';
import { Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameLogPanelProps {
  日志列表: 游戏日志[];
  onSendMessage: (text: string) => void;
  isReady?: boolean;
}

export default function GameLogPanel({ 日志列表, onSendMessage, isReady = false }: GameLogPanelProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [日志列表]);

  const handleSend = () => {
    if (inputText.trim() && !isReady) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 relative overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>

      {/* Log Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar z-10" ref={scrollRef}>
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
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 z-20">
        {/* Status */}
        {isReady && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-500 animate-pulse mb-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            行动已提交，等待其他玩家...
          </div>
        )}

        <div className={`relative flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border transition-colors shadow-inner h-12
          ${isReady ? 'border-zinc-800 opacity-50 cursor-not-allowed' : 'border-zinc-700 focus-within:border-amber-500/50'}
        `}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isReady}
            placeholder={isReady ? "等待回合结束..." : "输入你的行动..."}
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
          
          {/* Decorative Corner Accent */}
          <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-amber-500/50 rounded-tr-md pointer-events-none"></div>
          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-amber-500/50 rounded-bl-md pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
