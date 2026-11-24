// Spam guards shared by the public POST routes: honeypot test, client IP, per-IP hourly counters kept in the store. Server only.
import { getJson, putJson, del } from './store.ts';

/** The hidden `website` field: real people leave it empty, form-filling bots do not. */
export const filled = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/** First hop of x-forwarded-for (the platform sets it on Vercel). Anything not shaped like an IP counts as 'unknown'. */
// ponytail: off Vercel, nothing strips a forged x-forwarded-for, so the limit can be dodged there; fine behind Vercel or a trusted proxy
export function clientIp(request: Request): string {
  const first = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return /^[0-9a-fA-F:.]{2,45}$/.test(first) ? first : 'unknown';
}

type Counts = Record<string, number>;
const HOUR = 3_600_000;
const slot = (bucket: string, now: Date, back = 0) => `${bucket}-${Math.floor(now.getTime() / HOUR) - back}.json`;

let chain: Promise<unknown> = Promise.resolve();
// ponytail: process-local lock; two server instances can both read before either writes, so the limit is a little soft
const locked = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
};

/** Requests this IP has counted in the current clock hour for this bucket. */
export async function seen(bucket: string, ip: string, now = new Date()): Promise<number> {
  return (await getJson<Counts>('ratelimit', slot(bucket, now)))?.[ip] ?? 0;
}

/** Counts one request. False (and not counted) once the IP already used `max` this hour. Fixed hourly windows. */
export function hit(bucket: string, ip: string, max: number, now = new Date()): Promise<boolean> {
  return locked(async () => {
    const key = slot(bucket, now);
    const c = (await getJson<Counts>('ratelimit', key)) ?? {};
    if ((c[ip] ?? 0) >= max) return false;
    c[ip] = (c[ip] ?? 0) + 1;
    await putJson('ratelimit', key, c);
    await del('ratelimit', slot(bucket, now, 2)).catch(() => {}); // drop an old window so the folder stays small
    return true;
  });
}

// per IP per hour; orders and requests share `submit`. Design-project edits (`design`) and the suggest bar (`suggest`) have their own,
// so editing a design never uses up the order limit and the debounced bar never uses up the AI design limit.
export const LIMITS = { submit: 10, upload: 30, ai: 20, design: 60, suggest: 60 } as const;

/** Counts the request against its bucket; a 429 Response when over the limit, otherwise null. A store failure lets the request through. */
export async function limited(request: Request, bucket: keyof typeof LIMITS): Promise<Response | null> {
  try {
    if (await hit(bucket, clientIp(request), LIMITS[bucket])) return null;
  } catch (e) {
    console.error('Rate limit check failed', e);
    return null;
  }
  return Response.json({ error: 'Too many requests. Please try again in an hour.' }, { status: 429 });
}
