// One small storage API for everything the server keeps: orders, requests, uploads, AI jobs, ledgers. Server only.
// A namespace is a folder name ('orders', 'requests', 'uploads', 'ai-jobs', 'ai-usage', 'ratelimit'); a key is a file name in it.
// Backends, picked on every call:
//   BLOB_READ_WRITE_TOKEN set -> Vercel Blob (store must be created as PRIVATE; names are <ns>/<key>, overwritten in place)
//   VERCEL set, no token      -> os.tmpdir()/printpro3d, ephemeral: data is lost between invocations (warned once)
//   otherwise                 -> $DATA_DIR/<ns>/<key>, DATA_DIR defaulting to the project root (same folders as before)
// Must stay erasable TypeScript with explicit .ts imports: scripts/set-status.mjs imports this under Node's type stripping.
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const NS = /^[a-z0-9-]{1,40}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/; // no slash, backslash, space or NUL, so no path can be spelled
const validKey = (ns: string, key: string) => NS.test(ns) && KEY.test(key) && !key.includes('..');

let warned = false;
const onBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
/** True when the backend is Vercel Blob (browsers may then upload big files straight to it). */
export const onBlobStore = onBlob;

/** Folder holding the namespaces on the disk backends. */
export function dataRoot(): string {
  if (process.env.DATA_DIR) return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR);
  if (process.env.VERCEL) {
    if (!warned) {
      warned = true;
      console.warn('Storage: running on Vercel without BLOB_READ_WRITE_TOKEN; data goes to /tmp and is NOT kept. Set the token.');
    }
    return path.join(tmpdir(), 'printpro3d');
  }
  return /*turbopackIgnore: true*/ process.cwd();
}

const filePath = (ns: string, key: string) => path.join(/*turbopackIgnore: true*/ dataRoot(), ns, key);
const blobName = (ns: string, key: string) => `${ns}/${key}`;
const blob = () => import('@vercel/blob');
const bad = (ns: string, key: string) => new Error(`invalid storage name: ${ns}/${key}`);

export async function putBytes(ns: string, key: string, bytes: Uint8Array | string): Promise<void> {
  if (!validKey(ns, key)) throw bad(ns, key);
  if (onBlob()) {
    const { put } = await blob();
    await put(blobName(ns, key), Buffer.from(bytes as string), {
      access: 'private', allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 60,
    });
    return;
  }
  const dest = filePath(ns, key);
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, dest); // readers never see half a file
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/** The stored bytes, or null when missing or the name is invalid. */
export async function getBytes(ns: string, key: string): Promise<Buffer | null> {
  if (!validKey(ns, key)) return null;
  try {
    if (onBlob()) {
      const { get } = await blob();
      const r = await get(blobName(ns, key), { access: 'private', useCache: false });
      return r && r.statusCode === 200 ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null;
    }
    return await readFile(filePath(ns, key));
  } catch {
    return null;
  }
}

/** When the object was last written, from the store itself (Blob uploadedAt, file mtime), never from the name; null when missing. */
export async function storedAt(ns: string, key: string): Promise<Date | null> {
  if (!validKey(ns, key)) return null;
  try {
    if (onBlob()) {
      const { head } = await blob();
      return (await head(blobName(ns, key))).uploadedAt;
    }
    return (await stat(filePath(ns, key))).mtime;
  } catch {
    return null;
  }
}

export const putJson = (ns: string, key: string, value: unknown) => putBytes(ns, key, JSON.stringify(value, null, 2));

/** Parsed JSON, or null when missing, invalid or corrupt. */
export async function getJson<T = unknown>(ns: string, key: string): Promise<T | null> {
  const b = await getBytes(ns, key);
  if (!b) return null;
  try {
    return JSON.parse(b.toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function del(ns: string, key: string): Promise<void> {
  if (!validKey(ns, key)) throw bad(ns, key);
  if (onBlob()) {
    const { del: rm } = await blob();
    await rm(blobName(ns, key));
    return;
  }
  await unlink(filePath(ns, key)).catch(() => {});
}

/** Every key in a namespace (unsorted); [] when the namespace is empty or missing. */
export async function list(ns: string): Promise<string[]> {
  if (!NS.test(ns)) throw bad(ns, '');
  if (onBlob()) {
    const { list: ls } = await blob();
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await ls({ prefix: `${ns}/`, cursor });
      for (const b of page.blobs) keys.push(b.pathname.slice(ns.length + 1));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return keys;
  }
  try {
    return (await readdir(path.join(/*turbopackIgnore: true*/ dataRoot(), ns))).filter((k) => KEY.test(k) && !k.includes('.tmp-'));
  } catch {
    return [];
  }
}
