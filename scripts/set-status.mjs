// How the owner moves an order or design request through its stages from the command line (the /admin page does the same).
// Usage: npm run order:status -- <id> <status>   (id = the UUID the customer was given; status = a value from src/lib/tracking.ts)
// It finds the order or request in the store (DATA_DIR, or Vercel Blob when BLOB_READ_WRITE_TOKEN is set in .env.local),
// checks the status is allowed for that type, rewrites only the status field, and emails the customer when RESEND_API_KEY
// is set and the status changed. The customer's Track page reads the record on each lookup, so the new stage shows at once.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_STATUSES } from '../src/lib/tracking.ts';

process.env.DATA_DIR ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // the project root, not the caller's cwd
const { setStatus } = await import('../src/lib/trackingStore.ts'); // after DATA_DIR is set

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: npm run order:status -- <id> <status>');
  console.error(`  order statuses:   ${ALL_STATUSES.order.join(', ')}`);
  console.error(`  request statuses: ${ALL_STATUSES.request.join(', ')}`);
  process.exit(1);
}

const [id, status] = process.argv.slice(2);
if (!id || !status) usage();

const r = await setStatus(id, status);
if (!r.ok) {
  if (r.code === 'unknown_status' || r.code === 'wrong_type') usage(r.message);
  console.error(r.message);
  process.exit(1);
}
console.log(`${r.id}: ${r.from} → ${r.to}${r.emailed ? ' (customer emailed)' : ''}`);
