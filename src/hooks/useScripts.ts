import { useState, useEffect } from 'react';

export interface Script {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

const mockScripts: Script[] = [
  {
    id: 'cthulhu-mountains-of-madness',
    title: '克苏鲁的呼唤: 疯狂山脉',
    description: '深入南极的冰封废墟，揭开古老神祇与失落文明的骇人真相。一场心智与现实的残酷考验。',
    tags: ['恐怖', '调查', '克苏鲁神话'],
  },
  {
    id: 'dnd-lost-mine-of-phandelver',
    title: '龙与地下城: 凡达林矿坑',
    description: '经典的入门冒险，你将探索被遗忘的矿洞，对抗哥布林和更大的威胁，寻找传说中的魔法熔炉。',
    tags: ['奇幻', '冒险', 'D&D 5e'],
  },
  {
    id: 'cyberpunk-edge-of-the-night-city',
    title: '赛博朋克: 夜之城边缘',
    description: '在霓虹闪烁、公司控制的未来都市，作为边缘行者，你将为生存、金钱或原则而战。',
    tags: ['科幻', '赛博朋克', '高科技'],
  },
  {
    id: 'custom-script',
    title: '自定义剧本',
    description: '使用你自己的故事。导入或创建一个独特的剧本，带领玩家进入你想象中的世界。',
    tags: ['自定义', '开放'],
  },
];

export function useScripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setScripts(mockScripts);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { scripts, loading };
}
