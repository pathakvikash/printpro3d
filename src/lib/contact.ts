// Shared by /api/orders and /api/requests. Pure: takes a getter so it works for JSON and FormData.
export const LIMITS = { name: 100, email: 200, phone: 30, address: 500, notes: 1000 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Contact = { name: string; email: string; phone: string; address: string; notes: string };

/** Trimmed string field; non-strings count as empty. Throws a user-facing Error. */
export function text(get: (k: string) => unknown, k: string, max: number, required = true, oneLine = false): string {
  const raw = get(k);
  let v = typeof raw === 'string' ? raw.trim() : '';
  if (oneLine) v = v.replace(/\s+/g, ' '); // a newline must not forge lines in the notification email
  if (required && !v) throw new Error(`${k} is required`);
  if (v.length > max) throw new Error(`${k} is too long (max ${max})`);
  return v;
}

/** Just the email, same rules as parseContact. */
export function parseEmail(get: (k: string) => unknown): string {
  const email = text(get, 'email', LIMITS.email, true, true);
  if (!EMAIL.test(email)) throw new Error('email is invalid');
  return email;
}

export function parseContact(get: (k: string) => unknown, opts: { addressRequired?: boolean } = {}): Contact {
  const c = {
    name: text(get, 'name', LIMITS.name, true, true),
    email: text(get, 'email', LIMITS.email, true, true),
    phone: text(get, 'phone', LIMITS.phone, true, true),
    address: text(get, 'address', LIMITS.address, opts.addressRequired ?? true),
    notes: text(get, 'notes', LIMITS.notes, false),
  };
  if (!EMAIL.test(c.email)) throw new Error('email is invalid');
  return c;
}
