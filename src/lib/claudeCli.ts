// Is a `claude` executable on PATH? Scans PATH entries with fs (no shell), result cached per PATH string. Server only.
// No static node:fs/node:path import: aiDesign.ts (which calls this) is also pulled into client bundles via shared design modules,
// and Turbopack refuses node:fs in a browser chunk. process.getBuiltinModule loads fs only when the check runs on the server.
import type * as Fs from 'node:fs';

export type Exists = (file: string) => boolean;
const isExe: Exists = (f) => {
  const fs = (globalThis.process as NodeJS.Process | undefined)?.getBuiltinModule?.('node:fs') as typeof Fs | undefined;
  if (!fs) return false; // in a browser: never
  try { if (!fs.statSync(f).isFile()) return false; fs.accessSync(f, fs.constants.X_OK); return true; } catch { return false; }
};
const cache = new Map<string, boolean>();

/** `exists` and `pathEnv` are injectable for tests; the cache applies only to the real check. */
export function claudeOnPath(pathEnv: string | undefined = globalThis.process?.env?.PATH, exists?: Exists): boolean {
  const sep = globalThis.process?.platform === 'win32' ? ';' : ':';
  const scan = (ex: Exists) => (pathEnv ?? '').split(sep).some((d) => d && ex(`${d.replace(/[\\/]+$/, '')}/claude`));
  if (exists) return scan(exists);
  const key = pathEnv ?? '';
  if (!cache.has(key)) cache.set(key, scan(isExe));
  return cache.get(key)!;
}
