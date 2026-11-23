// Deletes design projects that were never ordered and are older than 30 days (and the STL a finalized one wrote).
// Usage: npm run designs:prune   (DATA_DIR, or Vercel Blob when BLOB_READ_WRITE_TOKEN is set in .env.local)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATA_DIR ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // the project root, not the caller's cwd
const { pruneProjects, PRUNE_DAYS } = await import('../src/lib/designProjects.ts'); // after DATA_DIR is set

console.log(`Pruned ${await pruneProjects(new Date(), PRUNE_DAYS)} unordered design project(s) older than ${PRUNE_DAYS} days.`);
