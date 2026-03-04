import React, { useState, useRef, useEffect } from 'react';
import { 游戏日志 } from '../../types/gameData';
import { Send, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatPanelProps {
  logs: 游戏日志[];
  onSendChat: (text: string) => void;
}

export default function ChatPanel({ logs, onSendChat }: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendChat(inputText);
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
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900/50">
        <MessageSquare size={16} className="text-zinc-400" />
        <span className="text-sm font-bold text-zinc-300">闲聊频道 (OOC)</span>
      </div>

      {/* Log Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={scrollRef}>
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex flex-col ${log.发送者 === '玩家' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-60">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {log.发送者}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">{log.时间戳}</span>
              </div>
              
              <div className={`
                max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed border
                ${log.发送者 === '玩家'
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700 rounded-tr-none'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 rounded-tl-none'
                }
              `}>
                {log.内容}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {logs.length === 0 && (
          <div className="text-center text-zinc-600 text-xs py-8 italic opacity-50">
            暂无消息...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800">
        <div className="relative flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 focus-within:border-zinc-600 transition-colors shadow-inner">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="发送闲聊..."
            className="flex-1 bg-transparent text-zinc-300 px-2 py-1 h-8 focus:outline-none text-xs placeholder:text-zinc-700"
          />
          <button
            onClick={handleSend}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

