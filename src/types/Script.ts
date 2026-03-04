export type CharacterAttributeKey = '力量' | '敏捷' | '体质' | '智力' | '感知' | '魅力';
import type { TRPGSaveData } from './gameData';

export interface CharacterAttributeBlock {
  力量: number;
  敏捷: number;
  体质: number;
  智力: number;
  感知: number;
  魅力: number;
}

export interface CharacterOption {
  id: string;
  name: string;
  description: string;
  attributeBonuses: Partial<CharacterAttributeBlock>;
}

export interface StarterItemOption {
  id: string;
  name: string;
  description: string;
  item?: {
    物品ID?: string;
    类型?: string;
    品质?: string;
    数量?: number;
    是否可堆叠?: boolean;
    重量?: number;
    价值?: number;
    当前耐久?: number;
    最大耐久?: number;
    可用次数?: number;
    装备槽位?: string | null;
    使用效果?: string[];
    标签?: string[];
  };
}

export interface ScriptRoleTemplate {
  id: string;
  name: string;
  description: string;
  allocationPointsByAttribute: Partial<CharacterAttributeBlock>;
  baseAttributes: CharacterAttributeBlock;
  classOptions: CharacterOption[];
  genderOptions: CharacterOption[];
  raceOptions: CharacterOption[];
  backgroundOptions: CharacterOption[];
  starterItemOptions: StarterItemOption[];
  maxStarterItems: number;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export interface ScriptStoryLine {
  speaker: string;
  text: string;
}

export interface ScriptStorySegment {
  groupId: string;
  visibleToPlayerIds?: string[];
  title: string;
  lines: ScriptStoryLine[];
}

export interface ScriptOpeningConfig {
  enabled: boolean;
  initialState: DeepPartial<TRPGSaveData>;
  openingStory: {
    round: number;
    publicLines: ScriptStoryLine[];
    segments: ScriptStorySegment[];
  };
}

export interface ScriptDefinition {
  id: string;
  title: string;
  description: string;
  tags: string[];
  content: string;
  settingPrompt: string;
  finalGoal: string;
  opening?: ScriptOpeningConfig;
  roleTemplates: ScriptRoleTemplate[];
}

export interface PlayerCharacterProfile {
  characterName: string;
  selectedClassId: string | null;
  selectedGenderId: string | null;
  selectedRaceId: string | null;
  selectedBackgroundId: string | null;
  selectedStarterItemIds: string[];
  allocatedPoints: CharacterAttributeBlock;
  calculatedAttributes: CharacterAttributeBlock;
}
