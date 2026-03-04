import {
  Scroll,
  Users,
  Settings,
  Backpack,
  ClipboardList,
  UserRound,
  Brain,
  RotateCcw,
  BookOpen,
  Handshake
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ActionMenuModal =
  | 'inventory'
  | 'skills'
  | 'tasks'
  | 'social'
  | 'team'
  | 'story'
  | 'agreements'
  | 'memory'
  | 'reroll';

export interface ActionMenuOption {
  id: ActionMenuModal | 'settings';
  label: string;
  icon: LucideIcon;
  description: string;
}

export const ACTION_MENU_OPTIONS: ActionMenuOption[] = [
  { id: 'inventory', label: '物品栏', icon: Backpack, description: '查看当前主控角色物品列表' },
  { id: 'skills', label: '技能书', icon: Scroll, description: '查看当前主控角色技能列表' },
  { id: 'tasks', label: '任务记录', icon: ClipboardList, description: '查看任务结构中的任务条目' },
  { id: 'social', label: '人物志', icon: UserRound, description: '查看社交关系与记忆' },
  { id: 'team', label: '队伍', icon: Users, description: '查看房间玩家与队伍状态' },
  { id: 'story', label: '剧情追踪', icon: BookOpen, description: '查看章节、线索与事件状态' },
  { id: 'agreements', label: '约定列表', icon: Handshake, description: '查看约定结构条目' },
  { id: 'memory', label: '记忆回顾', icon: Brain, description: '查看即时/短期/中期/长期记忆' },
  { id: 'reroll', label: '重Roll', icon: RotateCcw, description: '发起并确认重Roll投票' },
  { id: 'settings', label: '系统设置', icon: Settings, description: '调整显示、提示词和连接配置' }
];

export const ACTION_MENU_MODAL_TITLE: Record<ActionMenuModal, string> = {
  inventory: '物品栏',
  skills: '技能书',
  tasks: '任务记录',
  social: '人物志',
  team: '队伍',
  story: '剧情追踪',
  agreements: '约定列表',
  memory: '记忆回顾',
  reroll: '重Roll'
};
