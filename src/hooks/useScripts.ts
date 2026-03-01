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
        const libraryIds = new Set(SCRIPT_LIBRARY.map((script) => script.id));

        await Promise.all(
          storedScripts
            .filter((script) => !libraryIds.has(script.id))
            .map((script) => dbService.deleteScript(script.id))
        );

        await Promise.all(SCRIPT_LIBRARY.map((script) => dbService.upsertScript(script)));

        const finalScripts = await dbService.getAllScripts();
        if (!cancelled) {
          setScripts(finalScripts);
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
