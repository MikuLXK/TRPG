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

        let remoteScripts: ScriptDefinition[] = [];
        try {
          const apiBase =
            typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '3000'
              ? 'http://localhost:3000'
              : '';
          const response = await fetch(`${apiBase}/api/scripts`);
          if (response.ok) {
            const payload = (await response.json()) as { scripts?: ScriptDefinition[] };
            remoteScripts = Array.isArray(payload.scripts) ? payload.scripts : [];
            await Promise.all(remoteScripts.map((script) => dbService.upsertScript(script)));
          }
        } catch {
          // ignore remote fetch error and keep local scripts
        }

        const finalScripts = await dbService.getAllScripts();
        const mergedById = new Map<string, ScriptDefinition>();
        [...storedScripts, ...finalScripts, ...remoteScripts].forEach((script) => {
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
