import type { ScriptDefinition } from '../../types/Script';
import { dndCurseOfStrahd } from './dnd-curse-of-strahd';

export const SCRIPT_LIBRARY: ScriptDefinition[] = [dndCurseOfStrahd];

export const getScriptById = (scriptId: string) => SCRIPT_LIBRARY.find((script) => script.id === scriptId);
