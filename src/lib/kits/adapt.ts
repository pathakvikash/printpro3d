// One adapter from the six own-format kit files in this folder (whoop, heli, transformer, led-decor, rc-car, desk-pet) to the Kit shape
// of ../kits.ts. Their exports differ (parametric builders with a config, or unmodified upstream STL files); this file hides that.
//   key   `<kitId>:<printedPartId>` names one printed part everywhere (kit item templateId, geometry key, 'kit' cart line id).
//   mesh  kitPartMesh(key, cfg): print-orientation triangles, from the kit's builder or its STL file. The server uses it to reprice orders.
// Heavy (three, CSG): import it only where kits are used. Type-only imports from ../kits.ts keep the module graph acyclic.
import { STLLoader } from 'three-stdlib';
import type { BufferGeometry } from 'three';
import type { AssemblyPart, PartMaterial } from '../assembly.ts';
import type { Cfg, Field } from '../templateDefs.ts';
import type { BoughtItem, Kit, KitItem } from '../kits.ts';
import { KIT_WHOOP_KIT as WHOOP } from './whoop-kit.ts';
import { KIT_HELI_KIT as HELI } from './heli-kit.ts';
import { KIT_TRANSFORMER_KIT as TRANSFORMER } from './transformer-kit.ts';
import { KIT_LED_DECOR_KIT as LED } from './led-decor-kit.ts';
import { rcCarKit as RC } from './rc-car-kit.ts';
import { deskPetKit as PET } from './desk-pet-kit.ts';
import { so101ArmKit as SO101 } from './so101-arm-kit.ts';
import { stackChanKit as STACK } from './stack-chan-kit.ts';

type PartDef = { id: string; label: string; material: PartMaterial; qty: (c: Cfg) => number; file?: string; build?: (c: Cfg) => BufferGeometry; product?: string };
type Credit = { author: string; url: string; licence: string };
type Bought = { name: string; spec: string; qty: number; typical: boolean | string };
type Source = {
  id: string; title: string; blurb: string; category: Kit['category']; badge?: string; credit?: Credit; approximate?: boolean; assemblyData?: false; plates?: string[][];
  defaults: () => Cfg; fields: Field[]; validate: (raw: unknown) => Cfg; parts: PartDef[]; assembly: (c: Cfg) => AssemblyPart[]; bought: Bought[];
  /** assembly placeholder id (exact, else with trailing digits dropped) -> reference part page, for the assembly drawing */
  refs?: Record<string, string>;
  /** a kit that is several products (led-decor): one variant per product, each with its own config and parts */
  variants?: { id: string; title: string; product: string; fields: string[] }[];
};

const fn = <T>(v: T | ((c: Cfg) => T)) => (typeof v === 'function' ? (v as (c: Cfg) => T) : () => v);
const stlParts = (xs: readonly { id: string; label: string; file: string; material: PartMaterial; qty: number }[]): PartDef[] => xs.map((p) => ({ id: p.id, label: p.label, material: p.material, qty: () => p.qty, file: p.file }));
const builtParts = (xs: readonly { id: string; label: string; material: PartMaterial; qty: number | ((c: Cfg) => number); build: (c: Cfg) => BufferGeometry; product?: string }[]): PartDef[] =>
  xs.map((p) => ({ id: p.id, label: p.label, material: p.material, qty: fn(p.qty), build: p.build, product: p.product }));

const SOURCES: Source[] = [
  {
    id: 'whoop-kit', title: WHOOP.title, blurb: WHOOP.blurb, category: 'drone-rc',
    fields: WHOOP.config.fields, defaults: () => ({ ...WHOOP.config.defaults }), validate: (r) => WHOOP.config.validate(r, true), parts: builtParts(WHOOP.printedParts), assembly: WHOOP.assembly, bought: WHOOP.boughtParts,
    refs: { motor: 'motor-1102', prop: 'prop-31mm', aio: 'aio-fc-1s', camera: 'camera-nano-14', battery: 'lipo-1s' },
  },
  {
    id: 'heli-kit', title: HELI.title, blurb: HELI.blurb, category: 'drone-rc',
    fields: HELI.fields, defaults: HELI.defaults, validate: (r) => HELI.validate(r, true), parts: builtParts(HELI.printedParts), assembly: HELI.assembly, bought: HELI.boughtParts as unknown as Bought[],
  },
  {
    id: 'transformer-kit', title: TRANSFORMER.title, blurb: TRANSFORMER.blurb, category: 'toys-hobby', badge: 'Beta',
    fields: TRANSFORMER.config.fields, defaults: () => TRANSFORMER.config.defaults(), validate: (r) => TRANSFORMER.config.validate(r), parts: builtParts(TRANSFORMER.printedParts as unknown as Parameters<typeof builtParts>[0]), assembly: TRANSFORMER.assembly, bought: TRANSFORMER.boughtParts,
  },
  {
    id: 'led-decor-kit', title: LED.title, blurb: LED.blurb, category: 'smart-home',
    fields: LED.config.fields, defaults: () => ({ ...LED.config.defaults }), validate: (r) => LED.config.validate(r), parts: builtParts(LED.printedParts), assembly: LED.assembly, bought: LED.boughtParts,
    refs: { 'bought-esp32': 'board-esp32-devkit' },
    variants: [{ id: 'matrix', title: 'LED matrix frame', product: 'matrix', fields: ['grid', 'pitch'] }, { id: 'clock', title: 'Smart desk clock', product: 'clock', fields: ['display'] }, { id: 'lamp', title: 'Low-poly moon lamp', product: 'lamp', fields: ['lampD', 'facets'] }],
  },
  {
    id: 'rc-car', title: RC.title, blurb: RC.blurb, category: 'drone-rc', credit: RC.credit, approximate: true, assemblyData: RC.assemblyData, plates: RC.plates,
    fields: [], defaults: () => ({}), validate: () => ({}), parts: stlParts(RC.printedParts), assembly: () => RC.assembly(), bought: RC.boughtParts,
    refs: { servo: 'servo-sg90' },
  },
  {
    id: 'desk-pet', title: PET.title, blurb: PET.blurb, category: 'robotics', credit: PET.credit, approximate: true, assemblyData: PET.assemblyData,
    fields: [], defaults: () => ({}), validate: () => ({}), parts: stlParts(PET.printedParts), assembly: () => PET.assembly(), bought: PET.boughtParts,
    refs: { servo: 'servo-sg90' },
  },
  {
    id: 'so101-arm', title: SO101.title, blurb: SO101.blurb, category: 'robotics', credit: SO101.credit, approximate: true, assemblyData: SO101.assemblyData,
    fields: [], defaults: () => ({}), validate: () => ({}), parts: stlParts(SO101.printedParts), assembly: () => SO101.assembly(), bought: SO101.boughtParts,
  },
  {
    id: 'stack-chan', title: STACK.title, blurb: STACK.blurb, category: 'robotics', credit: STACK.credit, approximate: true, assemblyData: STACK.assemblyData,
    fields: [], defaults: () => ({}), validate: () => ({}), parts: stlParts(STACK.printedParts), assembly: () => STACK.assembly(), bought: STACK.boughtParts,
    refs: { servo: 'servo-sg90' },
  },
];

// ---------- keys, meshes ----------

export const kitPartKey = (kitId: string, partId: string) => `${kitId}:${partId}`;
export const isKitKey = (id: string) => /^[a-z0-9-]+:[A-Za-z0-9-]+$/.test(id);
const bySource = new Map(SOURCES.map((s) => [s.id, s]));

/** The kit and printed part a key names, or null. */
export function kitPartByKey(key: unknown): { source: Source; part: PartDef } | null {
  if (typeof key !== 'string' || !isKitKey(key)) return null;
  const [k, p] = key.split(':');
  const source = bySource.get(k), part = source?.parts.find((x) => x.id === p);
  return source && part ? { source, part } : null;
}

/** Strict config for a kit part (server): bad, missing or unknown values throw. STL kits have no config; whatever was sent is dropped. */
export function validateKitCfg(key: string, raw: unknown): Cfg {
  const hit = kitPartByKey(key);
  if (!hit) throw new Error('unknown kit part');
  return hit.source.parts.every((p) => p.file) ? {} : hit.source.validate(raw);
}

const positions = (g: BufferGeometry): Float32Array => Float32Array.from((g.index ? g.toNonIndexed() : g).attributes.position.array);
const browserRead = (file: string) => fetch(file).then((r) => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.arrayBuffer(); });

/** Print-orientation triangles of one printed part. cfg must be validated. `read` loads an STL file (default: fetch from the site; the server reads public/). */
export async function kitPartMesh(key: string, cfg: Cfg, read: (file: string) => Promise<ArrayBuffer> = browserRead): Promise<Float32Array | null> {
  const hit = kitPartByKey(key);
  if (!hit) return null;
  const { part } = hit;
  return part.file ? positions(new STLLoader().parse(await read(part.file))) : positions(part.build!(cfg));
}

export const kitPartQty = (key: string, cfg: Cfg) => kitPartByKey(key)?.part.qty(cfg) ?? 1;

// ---------- bought rows -> part pages (parts.ts) ----------

// first match on "name spec" wins; a row with no match stays plain text. Ids must exist in parts.ts (a test checks).
const BOUGHT_IDS: [RegExp, string[]][] = [
  [/^M2 screws/i, ['screw-m2']], [/^(M3 screws|M3x\d|Self-tapping screw)/i, ['screw-m3']],
  [/^Brushless motor 1102/i, ['motor-1102']], [/^Propeller 31 mm/i, ['prop-31mm']], [/^AIO flight controller/i, ['aio-fc-1s']],
  [/^Nano FPV camera/i, ['camera-nano-14']], [/^LiPo battery 1S/i, ['lipo-1s']],
  [/SG90|MG90S/, ['servo-sg90']], [/^ESP32 dev board/i, ['board-esp32-devkit']],
];
const boughtRow = (b: Bought): BoughtItem => {
  const text = `${b.qty}x ${b.name}: ${b.spec}${typeof b.typical === 'string' ? ` (typical source: ${b.typical})` : ''}`;
  const hit = BOUGHT_IDS.find(([re]) => re.test(`${b.name} ${b.spec}`));
  return hit ? { text, parts: hit[1] } : text;
};

// ---------- Kit objects ----------

function toKit(s: Source, o: { id: string; title: string; product?: string; bought?: Bought[]; cfg?: Cfg }): Kit {
  const cfg = { ...s.defaults(), ...o.cfg, ...(o.product ? { product: o.product } : {}) };
  const own = (g: AssemblyPart['geometry']) => {
    const hit = typeof g === 'string' ? s.parts.find((p) => p.id === g || p.file === g) : null;
    return hit ? kitPartKey(s.id, hit.id) : g;
  };
  return {
    id: o.id, title: o.title, blurb: s.blurb, category: s.category,
    items: s.parts.filter((p) => !o.product || p.product === o.product).map((p) => ({ templateId: kitPartKey(s.id, p.id), label: p.label, config: cfg, qty: p.qty(cfg) } satisfies KitItem)),
    boughtParts: (o.bought ?? s.bought).map(boughtRow),
    // sizes: the page's measured boxes are ignored, the kit files carry their own part sizes
    assembly: () => s.assembly(cfg).map((p) => ({ ...p, geometry: own(p.geometry) })),
    ...(s.credit ? { credit: { ...s.credit, files: s.parts.flatMap((p) => p.file ?? []) } } : {}),
    ...(s.approximate ? { approximate: true } : {}),
    ...(s.assemblyData === false ? { assemblyData: false as const, ...(s.plates ? { plates: s.plates.map((g) => g.map((id) => kitPartKey(s.id, id))) } : {}) } : {}),
    ...(s.badge ? { badge: s.badge } : {}),
    ...(s.refs ? { refs: s.refs } : {}),
  };
}

/** The kits of this folder in the Kit shape. A kit of several products (led-decor) has `variants`, one Kit each, and itself shows the first. */
export const adaptedKits = (): Kit[] => SOURCES.map((s) => {
  if (!s.variants) return toKit(s, { id: s.id, title: s.title });
  const variants = s.variants.map((v) => toKit(s, { id: `${s.id}/${v.id}`, title: v.title, product: v.product, bought: LED.products[v.product as 'matrix'].boughtParts }));
  return { ...variants[0], id: s.id, title: s.title, boughtParts: LED.boughtParts.map(boughtRow), variants };
});

// ---------- customer settings ----------

/** The settings a kit page offers: the kit's config fields (for a multi-product kit only those of that product) and a builder of the Kit for a config.
 * `build` throws (the kit's own strict validation message) for a config that cannot be made; null for kits without settings. */
export function kitSettings(kit: Kit): { fields: Field[]; defaults: Cfg; build: (cfg: Cfg) => Kit } | null {
  const [sid, vid] = kit.id.split('/');
  const s = bySource.get(sid);
  const v = s?.variants?.find((x) => x.id === vid);
  const fields = s && (v ? s.fields.filter((f) => v.fields.includes(f.key)) : s.fields.filter((f) => f.key !== 'product'));
  if (!s || !fields?.length) return null;
  const base = { id: kit.id, title: kit.title, ...(v ? { product: v.product, bought: LED.products[v.product as 'matrix'].boughtParts } : {}) };
  return { fields, defaults: Object.fromEntries(fields.map((f) => [f.key, f.default])), build: (cfg) => toKit(s, { ...base, cfg: s.validate({ ...s.defaults(), ...cfg, ...(v ? { product: v.product } : {}) }) }) };
}

/** One-line text of the chosen settings, for a cart line: "Duct size 75 mm, Camera tilt up from level 25 deg". Parentheses in labels are dropped. */
export function settingsSummary(fields: Field[], cfg: Cfg): string {
  const short = (t: string) => t.replace(/\s*\([^)]*\)/g, '').trim();
  return fields.map((f) => {
    const v = cfg[f.key];
    const val = f.type === 'range' ? `${v} ${f.unit}` : f.type === 'select' ? short(f.options.find((o) => o.value === v)?.label ?? String(v)) : v ? 'yes' : 'no';
    return `${short(f.label)} ${val}`;
  }).join(', ');
}
