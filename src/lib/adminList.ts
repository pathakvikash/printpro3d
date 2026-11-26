// Pure helpers for the admin list: filtering, search, counts, CSV export, owner-note validation. Safe for client and server.
export const NOTE_MAX = 2000;
export const ACTION_STATUSES = ['pending_review', 'needs_manual_quote', 'new'];

/** Error text for a bad owner note, or null. An empty string is valid (clears the note). */
export function noteError(v: unknown): string | null {
  if (typeof v !== 'string') return 'note must be text';
  if (v.length > NOTE_MAX) return `note is over ${NOTE_MAX} characters`;
  return null;
}

/** One CSV cell: quoted when needed, and a leading = + - @ (or tab/CR) gets a quote prefix so spreadsheets do not run it as a formula. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type ListRec = {
  type: 'order' | 'request';
  id: string;
  createdAt: string;
  status: string;
  total: number | null;
  contact: { name: string; email: string; phone: string; address: string };
  items: { name: string }[];
  state?: string;
  pin?: string;
  ownerNote?: string;
};

export function toCsv(rows: ListRec[]): string {
  const head = ['id', 'type', 'created', 'status', 'name', 'phone', 'state', 'pin', 'total', 'lines'];
  const body = rows.map((r) => [r.id, r.type, r.createdAt, r.status, r.contact.name, r.contact.phone, r.state ?? '', r.pin ?? '', r.total ?? '', r.items.length].map(csvCell).join(','));
  return [head.join(','), ...body].join('\r\n') + '\r\n';
}

export const needsAction = (r: { status: string }) => ACTION_STATUSES.includes(r.status);

export function countBy(rows: { status: string }[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
  return c;
}

/** type/status filters plus a case-insensitive search over id, name, phone, email, address, state, PIN, item names. */
export function filterRecs<T extends ListRec>(rows: T[], f: { type?: string; status?: string; q?: string }): T[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return rows.filter((r) => {
    if (f.type && r.type !== f.type) return false;
    if (f.status && r.status !== f.status) return false;
    if (!q) return true;
    const hay = [r.id, r.contact.name, r.contact.phone, r.contact.email, r.contact.address, r.state, r.pin, ...r.items.map((i) => i.name)].join('\n').toLowerCase();
    return hay.includes(q);
  });
}
