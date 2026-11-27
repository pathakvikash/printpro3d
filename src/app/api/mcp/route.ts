import { bearerSub, handleRpc } from '@/lib/orrery';
import { logCall, realDeps } from '@/lib/orreryServer';

export const maxDuration = 60; // job_status may download the finished STL (same as /api/generate/[id]); generate_model only starts a task
export const dynamic = 'force-dynamic';

// Minimal MCP streamable HTTP: stateless, JSON replies, POST only.
export async function POST(request: Request) {
  const who = bearerSub(request);
  if (who instanceof Response) return who;
  let msg: unknown;
  try {
    msg = await request.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  const started = Date.now();
  const out = await handleRpc(msg, who.sub, realDeps);
  const m = msg as { method?: string; params?: { name?: string } };
  logCall(who.sub, m?.method === 'tools/call' ? String(m.params?.name) : String(m?.method), started);
  if (out.body === undefined) return new Response(null, { status: out.status });
  return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
}

const no = () => new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
export const GET = no;
export const DELETE = no;
