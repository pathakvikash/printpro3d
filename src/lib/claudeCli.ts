// Is a `claude` executable on PATH? Scans PATH entries with fs (no shell), result cached per PATH string. Server only.
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';

export type Exists = (file: string) => boolean;
const isExe: Exists = (f) => { try { if (!statSync(f).isFile()) return false; accessSync(f, constants.X_OK); return true; } catch { return false; } };
const cache = new Map<string, boolean>();

/** `exists` and `pathEnv` are injectable for tests; the cache applies only to the real check. */
export function claudeOnPath(pathEnv: string | undefined = process.env.PATH, exists?: Exists): boolean {
  const scan = (ex: Exists) => (pathEnv ?? '').split(path.delimiter).some((d) => d && ex(path.join(d, 'claude')));
  if (exists) return scan(exists);
  const key = pathEnv ?? '';
  if (!cache.has(key)) cache.set(key, scan(isExe));
  return cache.get(key)!;
}
