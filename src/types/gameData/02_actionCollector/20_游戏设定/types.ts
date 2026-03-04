export interface 行动输入玩家 {
  playerId: string;
  playerName: string;
  location: string;
  action: string;
}

export interface 行动收集输入 {
  phase: 'collect_actions';
  round: number;
  room: {
    id: string;
    name: string;
    scriptTitle: string;
    intro: string;
  };
  players: 行动输入玩家[];
  locationBuckets: Record<string, string[]>;
}

export interface 行动分组 {
  groupId: string;
  groupType: 'together' | 'solo';
  location: string;
  playerIds: string[];
  reason: string;
}

export interface 原始行动 {
  playerId: string;
  playerName: string;
  location: string;
  action: string;
}

export interface 行动收集输出 {
  groups: 行动分组[];
  rawActions: 原始行动[];
  groupNarratives: string[];
}
