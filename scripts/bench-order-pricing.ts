// Measures server-side order pricing the way /api/orders does it. Run (separate processes for clean memory numbers):
//   node scripts/bench-order-pricing.ts fuzz [perKit=30]    seeded configs per kit, every printed part built: build time + failure rate
//   node scripts/bench-order-pricing.ts order               worst realistic order: 12 kit lines + 6 template lines, cold, sequential, 40 s budget like the route
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { adaptedKits, kitPartByKey, validateKitCfg } from '../src/lib/kits/adapt.ts';
import { priceKit, priceTpl, newBudget, clearPriceCache } from '../src/lib/orderPricing.ts';
import { defaultCfg, normalizeCfg, templateById, type Cfg, type Field } from '../src/lib/templateDefs.ts';

// the persistent price cache must not see earlier runs or the project folder: every timing here is a cold build
const fresh = () => { process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'bench-')); clearPriceCache(); };
fresh();
const KITS = ['whoop-kit', 'heli-kit', 'transformer-kit', 'led-decor-kit'];
const mb = () => Math.round(process.memoryUsage().rss / 1048576);
let peak = mb();
const sample = () => { peak = Math.max(peak, mb()); };

function rng(seed: number) { // mulberry32
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (f: Field, r: () => number, mode: 'min' | 'max' | 'rand'): number | string | boolean => {
  if (f.type === 'range') return mode === 'min' ? f.min : mode === 'max' ? f.max : f.min + r() * (f.max - f.min);
  if (f.type === 'select') return mode === 'min' ? f.options[0].value : mode === 'max' ? f.options[f.options.length - 1].value : f.options[Math.floor(r() * f.options.length)].value;
  return mode === 'min' ? false : mode === 'max' ? true : r() < 0.5;
};
function configs(fields: Field[], product: string | undefined, n: number, seed: number): Cfg[] {
  const r = rng(seed);
  const mk = (mode: 'min' | 'max' | 'rand'): Cfg => ({ ...Object.fromEntries(fields.map((f) => [f.key, pick(f, r, mode)])), ...(product ? { product } : {}) });
  return [mk('min'), mk('max'), ...Array.from({ length: Math.max(0, n - 2) }, () => mk('rand'))];
}
const t0 = () => performance.now();
const CAP_MS = 30_000; // a build still running after this counts as a hang (fuzz and planning pass only)
const capped = () => ({ deadline: Date.now() + CAP_MS, longest: 0 });

type Row = { key: string; cfg: Cfg; ms: number; ok: boolean; err?: string };
// perKit seeded configs per kit (the first two are all-min and all-max); each config builds every printed part of the kit
async function fuzz(perKit: number) {
  const rows: Row[] = [];
  let invalid = 0;
  for (const kid of KITS) {
    const kit = adaptedKits().find((k) => k.id === kid)!;
    const items = [...new Map([...kit.items, ...(kit.variants ?? []).flatMap((v) => v.items)].map((i) => [i.templateId, i])).values()];
    const fields = kitPartByKey(items[0].templateId)!.source.fields;
    const products = [...new Set(items.map((i) => kitPartByKey(i.templateId)!.part.product))];
    let seed = 11;
    for (const ch of kid) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const cfgs = configs(fields, undefined, perKit, seed);
    for (const [i, raw] of cfgs.entries()) {
      const product = products[i % products.length];
      for (const item of items.filter((x) => kitPartByKey(x.templateId)!.part.product === product)) {
        let cfg: Cfg;
        try { cfg = validateKitCfg(item.templateId, { ...raw, ...(product ? { product } : {}) }); } catch { invalid++; continue; }
        const s = t0();
        try { const l = await priceKit(item.templateId, cfg, 1, capped()); rows.push({ key: item.templateId, cfg, ms: t0() - s, ok: !l.priceStatus, err: l.reviewReason }); }
        catch (e) { rows.push({ key: item.templateId, cfg, ms: t0() - s, ok: false, err: e instanceof Error ? e.message : String(e) }); }
        sample();
      }
      if (i % 5 === 4) console.log(`  ${kid} ${i + 1}/${cfgs.length} configs, ${rows.length} builds so far`);
    }
  }
  console.log(`invalid-by-validation (rejected at checkEntry, not counted): ${invalid}`);
  for (const kid of KITS) {
    const rs = rows.filter((r) => r.key.startsWith(`${kid}:`));
    const bad = rs.filter((r) => !r.ok);
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
    const byErr = new Map<string, number>();
    for (const b of bad) byErr.set(b.err!, (byErr.get(b.err!) ?? 0) + 1);
    console.log(`${kid}: builds ${rs.length}, failed ${bad.length} (${((100 * bad.length) / rs.length).toFixed(1)}%), median ${ms[ms.length >> 1].toFixed(0)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(0)} ms, max ${ms[ms.length - 1].toFixed(0)} ms`, [...byErr].map(([e, n]) => `${n}x "${e}"`).join('; '));
  }
  const all = rows.filter((r) => !r.ok);
  console.log(`TOTAL builds ${rows.length}, failed ${all.length} (${((100 * all.length) / rows.length).toFixed(1)}%), peak RSS ${peak} MB`);
  for (const b of all.slice(0, 5)) console.log('  fail', b.key, JSON.stringify(b.cfg), b.err);
}

async function order() {
  // worst realistic order: the 12 slowest distinct kit parts (measured in a fuzz pass, extremes and defaults) across the four kits + 6 template lines
  const cands: { key: string; cfg: Cfg; ms: number }[] = [];
  for (const kid of KITS) {
    const kit = adaptedKits().find((k) => k.id === kid)!;
    for (const item of new Map([...kit.items, ...(kit.variants ?? []).flatMap((v) => v.items)].map((i) => [i.templateId, i])).values()) {
      const hit = kitPartByKey(item.templateId)!;
      const f = hit.source.fields;
      for (const raw of [...configs(f, hit.part.product, 2, 7), { ...Object.fromEntries(f.map((x) => [x.key, x.default])), ...(hit.part.product ? { product: hit.part.product } : {}) }]) {
        let cfg: Cfg; try { cfg = validateKitCfg(item.templateId, raw); } catch { continue; }
        const s = t0();
        try { const l = await priceKit(item.templateId, cfg, 1, capped()); if (!l.priceStatus) cands.push({ key: item.templateId, cfg, ms: t0() - s }); } catch {}
      }
    }
  }
  fresh();
  // one per part, heaviest first, spread over kits: round-robin by kit so all four appear
  const best = new Map<string, (typeof cands)[number]>();
  for (const c of cands) if (!best.has(c.key) || best.get(c.key)!.ms < c.ms) best.set(c.key, c);
  const byKit = KITS.map((k) => [...best.values()].filter((c) => c.key.startsWith(`${k}:`)).sort((a, b) => b.ms - a.ms));
  const kitLines: typeof cands = [];
  for (let i = 0; kitLines.length < 12 && i < 12; i++) for (const l of byKit) if (l[i] && kitLines.length < 12) kitLines.push(l[i]);
  const tplIds = ['fpv-frame-3in', 'prop-guard', 'landing-gear', 'robot-chassis', 'grid-bin', 'phone-stand-pro'];
  const tpls = tplIds.map((id) => { const t = templateById(id)!; const f = t.fields; const r = rng(3); return { t, cfg: normalizeCfg(t, Object.fromEntries(f.map((x) => [x.key, pick(x, r, id === 'fpv-frame-3in' ? 'max' : 'rand')])), true) }; });
  // fresh process state is not possible after the warm pass above: caches (module init, JIT) are warm; report that honestly by also timing the first order cold below
  console.log(`(planning pass: ${cands.length} builds)`);
  fresh();
  peak = mb();
  const start = t0();
  const per: string[] = [];
  const budget = newBudget(); // what /api/orders gives the order
  for (const l of kitLines) { const s = t0(); const r = await priceKit(l.key, l.cfg, 1, budget); per.push(`${l.key} ${Math.round(t0() - s)}ms${r.priceStatus ? ' REVIEW' : ''}`); sample(); }
  const kitMs = t0() - start;
  for (const { t, cfg } of tpls) { const s = t0(); try { const r = await priceTpl(t, cfg, 1, budget); per.push(`tpl:${t.id} ${Math.round(t0() - s)}ms${r.priceStatus ? ' REVIEW' : ''}`); } catch (e) { per.push(`tpl:${t.id} FAIL ${(e as Error).message}`); } sample(); }
  const total = t0() - start;
  console.log(per.join('\n'));
  console.log(`ORDER wall ${Math.round(total)} ms (kit ${Math.round(kitMs)}, tpl ${Math.round(total - kitMs)}), peak RSS ${peak} MB; x3 estimate ${Math.round((total * 3) / 1000)} s vs 60 s limit`);
  void defaultCfg;
}

const [mode, n] = process.argv.slice(2);
if (mode === 'fuzz') await fuzz(Number(n) || 30);
else if (mode === 'order') await order();
else console.log('usage: bench-order-pricing.ts fuzz [perPart] | order');
