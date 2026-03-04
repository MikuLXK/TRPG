import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { 游戏日志 } from '../../types/gameData';
import { Send, Waves, Ban, Brain, X, Compass, FileCode2 } from 'lucide-react';
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
  selfSpeakerNames?: string[];
  aiThinkingHistory?: Array<{
    round?: number;
    thinking?: string;
    source?: 'mainStory' | 'reroll' | string;
    time?: string;
  }>;
  currentGameTimeText?: string;
  isOpeningScene?: boolean;
  streamingMode?: 'off' | 'provider';
  onToggleStreamingMode?: () => void;
}

interface StoryLine {
  speaker: string;
  text: string;
}

interface StoryPayload {
  round?: number;
  publicLines?: StoryLine[];
  segments?: Array<{
    groupId?: string;
    visibleToPlayerIds?: string[];
    title?: string;
    lines?: StoryLine[];
  }>;
}

interface DisplayEntry {
  id: string;
  speaker: string;
  text: string;
  time: string;
  kind: 'publicNarration' | 'narration' | 'dialogue' | 'judge' | 'hint' | 'section' | 'system';
  align: 'left' | 'right' | 'center';
}

const TITLE_LINE_PATTERN = /^【[^】]+】\|【[^】]+】$/;
const TAG_LINE_PATTERN = /^【([^】]+)】\s*(.*)$/;
const GAME_TIME_PATTERN_A = /\d{1,6}年\d{2}月\d{2}日\s+\d{2}:\d{2}/;
const GAME_TIME_PATTERN_B = /^\d{1,6}:\d{2}:\d{2}:\d{2}:\d{2}$/;

const normalizeName = (value: string) => String(value || '').trim().toLowerCase();
const isLikelyGameTime = (value: string) => GAME_TIME_PATTERN_A.test(value) || GAME_TIME_PATTERN_B.test(value);
const resolveDisplayTime = (raw: string, currentGameTimeText: string) => {
  const source = String(raw || '').trim();
  if (source && isLikelyGameTime(source)) return source;
  return String(currentGameTimeText || '').trim() || source || '--:--';
};

const tryParseStoryPayload = (raw: string): StoryPayload | null => {
  const source = String(raw || '').trim();
  if (!source) return null;
  try {
    const parsed = JSON.parse(source) as StoryPayload;
    if (Array.isArray(parsed?.publicLines) || Array.isArray(parsed?.segments)) return parsed;
    return null;
  } catch {
    return null;
  }
};

const classifyTaggedLine = (
  speaker: string,
  text: string,
  selfSpeakerSet: Set<string>
): Omit<DisplayEntry, 'id' | 'time'> => {
  if (speaker === '公共旁白') {
    return { speaker, text, kind: 'publicNarration', align: 'center' };
  }
  if (speaker === '旁白') {
    return { speaker, text, kind: 'narration', align: 'center' };
  }
  if (speaker === '判定') {
    return { speaker, text, kind: 'judge', align: 'center' };
  }
  if (speaker === '下一步可选行动提示') {
    return { speaker, text, kind: 'hint', align: 'center' };
  }
  const isSelf = selfSpeakerSet.has(normalizeName(speaker)) || normalizeName(speaker) === '你';
  return { speaker, text, kind: 'dialogue', align: isSelf ? 'right' : 'left' };
};

const parseStoryTextLines = (
  raw: string,
  log: 游戏日志,
  selfSpeakerSet: Set<string>
): DisplayEntry[] => {
  const source = String(raw || '').trim();
  if (!source) return [];
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const entries: DisplayEntry[] = [];
  let index = 0;

  for (const line of lines) {
    if (TITLE_LINE_PATTERN.test(line)) {
      entries.push({
        id: `${log.id}-section-${index++}`,
        speaker: '分组',
        text: line,
        time: log.时间戳,
        kind: 'section',
        align: 'center'
      });
      continue;
    }

    const tagged = line.match(TAG_LINE_PATTERN);
    if (tagged) {
      const speaker = String(tagged[1] || '').trim();
      const text = String(tagged[2] || '').trim();
      const classified = classifyTaggedLine(speaker, text, selfSpeakerSet);
      entries.push({
        id: `${log.id}-line-${index++}`,
        time: log.时间戳,
        ...classified
      });
      continue;
    }

    entries.push({
      id: `${log.id}-line-${index++}`,
      speaker: '旁白',
      text: line,
      time: log.时间戳,
      kind: 'narration',
      align: 'center'
    });
  }

  return entries;
};

const parseStoryJson = (payload: StoryPayload, log: 游戏日志, selfSpeakerSet: Set<string>): DisplayEntry[] => {
  const entries: DisplayEntry[] = [];
  let index = 0;
  const publicLines = Array.isArray(payload.publicLines) ? payload.publicLines : [];
  const segments = Array.isArray(payload.segments) ? payload.segments : [];

  for (const line of publicLines) {
    const speaker = String(line?.speaker || '').trim();
    const text = String(line?.text || '').trim();
    if (!speaker || !text) continue;
    const classified = classifyTaggedLine(speaker, text, selfSpeakerSet);
    entries.push({
      id: `${log.id}-pub-${index++}`,
      time: log.时间戳,
      ...classified
    });
  }

  for (const segment of segments) {
    const title = String(segment?.title || '').trim();
    if (title) {
      entries.push({
        id: `${log.id}-segtitle-${index++}`,
        speaker: '分组',
        text: title,
        time: log.时间戳,
        kind: 'section',
        align: 'center'
      });
    }
    const lines = Array.isArray(segment?.lines) ? segment.lines : [];
    for (const line of lines) {
      const speaker = String(line?.speaker || '').trim();
      const text = String(line?.text || '').trim();
      if (!speaker || !text) continue;
      const classified = classifyTaggedLine(speaker, text, selfSpeakerSet);
      entries.push({
        id: `${log.id}-segline-${index++}`,
        time: log.时间戳,
        ...classified
      });
    }
  }

  return entries;
};

const parseLogToEntries = (log: 游戏日志, selfSpeakerSet: Set<string>): DisplayEntry[] => {
  const content = String(log.内容 || '').trim();
  if (!content) return [];

  if (log.发送者 === '系统') {
    const payload = tryParseStoryPayload(content);
    if (payload) {
      const structured = parseStoryJson(payload, log, selfSpeakerSet);
      if (structured.length > 0) return structured;
    }
    return parseStoryTextLines(content, log, selfSpeakerSet);
  }

  const speaker = log.发送者 === '玩家' ? '你' : String(log.发送者 || '系统');
  const isSelf = log.发送者 === '玩家' || selfSpeakerSet.has(normalizeName(speaker));
  return [{
    id: `${log.id}-raw`,
    speaker,
    text: content,
    time: log.时间戳,
    kind: log.类型 === '系统' ? 'system' : 'dialogue',
    align: isSelf ? 'right' : 'left'
  }];
};

export default function GameLogPanel({
  日志列表,
  onSendMessage,
  isReady = false,
  readyCount = 0,
  totalPlayers = 0,
  isStreaming = false,
  streamPreview = '',
  roomStatus: _roomStatus = '等待中',
  currentRound = 1,
  aiStepText: _aiStepText = '等待玩家输入',
  playerInputStates = [],
  selfSpeakerNames = [],
  aiThinkingHistory = [],
  currentGameTimeText = '',
  isOpeningScene = false,
  streamingMode = 'provider',
  onToggleStreamingMode,
}: GameLogPanelProps) {
  const [inputText, setInputText] = useState('');
  const [showThinkingModal, setShowThinkingModal] = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selfSpeakerSet = useMemo(() => new Set(selfSpeakerNames.map(normalizeName).filter(Boolean)), [selfSpeakerNames]);
  const displayEntries = useMemo(
    () =>
      日志列表
        .flatMap((log) => parseLogToEntries(log, selfSpeakerSet))
        .map((entry) => ({
          ...entry,
          time: resolveDisplayTime(entry.time, currentGameTimeText)
        })),
    [日志列表, selfSpeakerSet, currentGameTimeText]
  );
  const thinkingEntries = useMemo(
    () =>
      [...(Array.isArray(aiThinkingHistory) ? aiThinkingHistory : [])]
        .filter((item) => String(item?.thinking || '').trim())
        .reverse(),
    [aiThinkingHistory]
  );
  const roundRawLogs = useMemo(() => {
    const systemLogs = 日志列表
      .filter((log) => log.发送者 === '系统' && String(log.内容 || '').trim())
      .filter((log) => log.类型 === '旁白' || log.类型 === '系统');
    if (systemLogs.length === 0) return [];
    if (isOpeningScene) return systemLogs.slice(0, 3);
    const preferred = [...systemLogs].reverse().filter((log) => !String(log.内容 || '').startsWith('状态结算:'));
    if (preferred.length > 0) return preferred.slice(0, 3);
    return [...systemLogs].reverse().slice(0, 3);
  }, [日志列表, isOpeningScene]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayEntries, streamPreview]);

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
  const roundLabel = isOpeningScene ? `开场剧情 · 第 ${currentRound} 回合` : `第 ${currentRound} 回合`;

  return (
    <div className="h-full flex flex-col bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar z-10" ref={scrollRef}>
        <div className="px-1 py-1 text-xs text-zinc-300">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowThinkingModal(true)}
              className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg border border-cyan-500/45 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.12)]"
              title="查看AI思考"
            >
              <Brain size={13} />
            </button>

            <div className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-amber-500/45 bg-amber-500/10 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
              <Compass size={13} />
              <span className="text-[11px] font-semibold tracking-wide">{roundLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowRawModal(true)}
              className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg border border-amber-500/45 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
              title="查看本回合AI原始响应"
            >
              <FileCode2 size={12} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {displayEntries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${
                entry.align === 'right'
                  ? 'items-end'
                  : entry.align === 'left'
                    ? 'items-start'
                    : 'items-center'
              }`}
            >
              {entry.kind === 'publicNarration' && (
                <div className="w-full max-w-[92%] px-5 py-3 rounded-2xl border border-emerald-500/35 bg-emerald-950/25 text-emerald-100 text-sm leading-relaxed text-center font-medium shadow-[0_0_20px_rgba(16,185,129,0.12)]">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">公共旁白</div>
                  <div className="whitespace-pre-wrap">{entry.text}</div>
                </div>
              )}

              {entry.kind === 'narration' && (
                <div className="w-full max-w-[92%] px-5 py-4 rounded-2xl border border-amber-500/45 bg-zinc-900/90 text-amber-100 text-sm leading-relaxed text-center font-serif tracking-wide shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <div className="text-[10px] uppercase tracking-widest text-amber-400/70 mb-1">旁白</div>
                  <div className="whitespace-pre-wrap">{entry.text}</div>
                </div>
              )}

              {entry.kind === 'judge' && (
                <div className="w-full max-w-[92%] px-4 py-3 rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/20 text-fuchsia-100 text-xs leading-relaxed text-center">
                  <div className="text-[10px] uppercase tracking-widest text-fuchsia-300/80 mb-1">判定</div>
                  <div className="whitespace-pre-wrap">{entry.text}</div>
                </div>
              )}

              {entry.kind === 'hint' && (
                <div className="w-full max-w-[92%] px-4 py-3 rounded-xl border border-cyan-500/35 bg-cyan-950/20 text-cyan-100 text-xs leading-relaxed text-center">
                  <div className="text-[10px] uppercase tracking-widest text-cyan-300/80 mb-1">行动提示</div>
                  <div className="whitespace-pre-wrap">{entry.text}</div>
                </div>
              )}

              {entry.kind === 'section' && (
                <div className="w-full max-w-[92%] px-2 py-1 text-center text-[11px] tracking-wider text-zinc-500">
                  {entry.text}
                </div>
              )}

              {(entry.kind === 'dialogue' || entry.kind === 'system') && (
                <div className={`w-full flex ${entry.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] flex flex-col ${entry.align === 'right' ? 'items-end' : 'items-start'}`}>
                    <div className={`mb-1 text-[11px] tracking-wide ${entry.align === 'right' ? 'text-cyan-300/80' : 'text-zinc-400'}`}>
                      {entry.speaker}
                      <span className="ml-2 text-[10px] text-zinc-500 font-mono">{entry.time}</span>
                    </div>
                    <div className={`
                      px-4 py-3 rounded-2xl border text-sm leading-relaxed whitespace-pre-wrap
                      ${entry.align === 'right'
                        ? 'bg-cyan-950/35 border-cyan-700/35 text-cyan-100 rounded-tr-sm shadow-[0_0_12px_rgba(34,211,238,0.08)]'
                        : 'bg-zinc-800/65 border-zinc-700/40 text-zinc-100 rounded-tl-sm'}
                    `}>
                      {entry.text}
                    </div>
                  </div>
                </div>
              )}
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
        {playerInputStates.length > 0 && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {playerInputStates.map((player) => {
              const actionPreview = player.action ? (player.action.length > 12 ? `${player.action.slice(0, 12)}...` : player.action) : '';
              return (
                <div
                  key={player.id}
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${
                    player.isReady
                      ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${player.isReady ? 'bg-emerald-400' : 'bg-zinc-500'}`}></span>
                  <span>{player.name}</span>
                  {actionPreview && <span className="text-zinc-500">· {actionPreview}</span>}
                </div>
              );
            })}
          </div>
        )}

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
            placeholder={isReady ? '等待回合结束...' : '输入你的行动（公共写入：/公共写入 {"剧情":{...}}）'}
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

      {showThinkingModal && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl h-[78%] bg-zinc-950 border border-cyan-700/50 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
              <div className="text-cyan-300 font-bold tracking-wider">AI思考过程（按回合）</div>
              <button
                type="button"
                onClick={() => setShowThinkingModal(false)}
                className="p-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {thinkingEntries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-zinc-500">暂无 AI 思考记录</div>
              ) : (
                thinkingEntries.map((item, idx) => {
                  const roundText = Number.isFinite(Number(item?.round)) ? `第${Math.floor(Number(item?.round))}回合` : '未知回合';
                  const sourceText = item?.source === 'reroll' ? '重Roll' : '主剧情';
                  const timeText = String(item?.time || '').trim();
                  return (
                    <div
                      key={`${item?.round || 'x'}-${timeText}-${idx}`}
                      className="rounded-xl border border-zinc-700/70 bg-zinc-900/70 p-3"
                    >
                      <div className="text-xs text-cyan-300/90 mb-2">
                        {roundText} · {sourceText}
                        {timeText ? ` · ${timeText}` : ''}
                      </div>
                      <div className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{String(item?.thinking || '').trim()}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showRawModal && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl h-[76%] bg-zinc-950 border border-amber-700/50 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
              <div className="text-amber-300 font-bold tracking-wider">本回合AI原始响应</div>
              <button
                type="button"
                onClick={() => setShowRawModal(false)}
                className="p-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {roundRawLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-zinc-500">当前回合暂无可展示的原始响应</div>
              ) : (
                roundRawLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-zinc-700/70 bg-zinc-900/70 p-3">
                    <div className="text-xs text-amber-300/90 mb-2">{log.时间戳} · {log.类型}</div>
                    <pre className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed font-mono">{String(log.内容 || '')}</pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

