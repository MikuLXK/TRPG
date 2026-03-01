export type CharacterAttributeKey = '力量' | '敏捷' | '体质' | '智力' | '感知' | '魅力';

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

export interface ScriptDefinition {
  id: string;
  title: string;
  description: string;
  tags: string[];
  content: string;
  settingPrompt: string;
  finalGoal: string;
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
