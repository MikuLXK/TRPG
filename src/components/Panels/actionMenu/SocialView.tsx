import { Heart, UserRound, MapPin, ShieldCheck, ScrollText } from 'lucide-react';
import type { 游戏状态 } from '../../../types/gameData';

interface SocialViewProps {
  gameData: 游戏状态;
}

const attitudeColor = (attitude: string) => {
  if (attitude.includes('敌')) return 'text-red-300 border-red-500/30 bg-red-500/10';
  if (attitude.includes('友') || attitude.includes('盟')) return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  return 'text-zinc-300 border-zinc-700 bg-zinc-900/50';
};

export default function SocialView({ gameData }: SocialViewProps) {
  const relations = Array.isArray(gameData?.社交?.关系列表) ? gameData.社交.关系列表 : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"><UserRound size={16} /></div>
          <div>
            <div className="text-sm font-bold text-zinc-100">人物志 / 社交网络</div>
            <div className="text-xs text-zinc-500">记录关键 NPC 与关系动态</div>
          </div>
        </div>
        <div className="text-xs text-zinc-400">总计 {relations.length} 人</div>
      </div>

      {relations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
          暂无社交关系记录。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {relations.map((item) => (
            <div key={item.关系ID} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-zinc-100">{item.对象名}</div>
                  <div className="text-[11px] text-zinc-500">{item.对象类型} · ID {item.关系ID}</div>
                </div>
                <div className={`text-xs rounded-md border px-2 py-1 ${attitudeColor(String(item.态度 || item.关系状态 || '未知'))}`}>
                  {item.关系状态 || '未知关系'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/50 px-2 py-1 inline-flex items-center gap-1">
                  <Heart size={11} /> 好感 {item.好感度}
                </div>
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/50 px-2 py-1 inline-flex items-center gap-1">
                  <ShieldCheck size={11} /> 信任 {item.信任度}
                </div>
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/50 px-2 py-1 inline-flex items-center gap-1">
                  <MapPin size={11} /> {item.当前地点 || '未知地点'}
                </div>
              </div>

              <div className="text-xs text-zinc-300 whitespace-pre-wrap">{item.简介 || '暂无简介'}</div>
              <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
                <ScrollText size={11} /> 记忆条数：{item.记忆?.length || 0} {item.是否队友 ? '· 当前队友' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
