import { useEffect, useState } from 'react';
import { SCRIPT_LIBRARY } from '../data/scripts';
import { dbService } from '../services/dbService';
import type { ScriptDefinition } from '../types/Script';

export type Script = ScriptDefinition;

export function useScripts() {
  const [scripts, setScripts] = useState<ScriptDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadScripts = async () => {
      try {
        const storedScripts = await dbService.getAllScripts();

        await Promise.all(SCRIPT_LIBRARY.map((script) => dbService.upsertScript(script)));

        const finalScripts = await dbService.getAllScripts();
        const mergedById = new Map<string, ScriptDefinition>();
        [...storedScripts, ...finalScripts].forEach((script) => {
          mergedById.set(script.id, script);
        });
        if (!cancelled) {
          setScripts(Array.from(mergedById.values()));
        }
      } catch {
        if (!cancelled) {
          setScripts(SCRIPT_LIBRARY);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadScripts();

    return () => {
      cancelled = true;
    };
  }, []);

  return { scripts, loading };
}
