// Parametric template definitions: pure data and config validation. No three.js, so the cart and the
// orders route can import it cheaply. The mesh builders live in templates.ts.

export type Cfg = Record<string, number | string | boolean>;
export type Field =
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; default: number; unit: string; help?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string; help?: string }
  | { key: string; label: string; type: 'bool'; default: boolean; help?: string };
// owner fills these in; each entry is shown as an off-the-shelf alternative, not made by us
export type MarketLink = { label: string; url: string; checkedOn: string; priceBand?: string };

export type TemplateDef = {
  id: string;
  name: string;
  category: string;
  material: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  colour: string; // suggested colour, shown as text
  blurb: string;
  fields: Field[];
  marketLinks: MarketLink[];
};

const sel = (key: string, label: string, options: [string, string][], dflt: string, help?: string): Field => ({
  key, label, type: 'select', options: options.map(([value, l]) => ({ value, label: l })), default: dflt, help,
});
const rng = (key: string, label: string, min: number, max: number, step: number, dflt: number, unit = 'mm', help?: string): Field => ({
  key, label, type: 'range', min, max, step, default: dflt, unit, help,
});
const bool = (key: string, label: string, dflt: boolean, help?: string): Field => ({ key, label, type: 'bool', default: dflt, help });

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'enclosure-box', name: 'Enclosure box with lid', category: 'enclosure', material: 'PETG', colour: 'black or grey',
    blurb: 'A box and a matching lid for a PCB or small electronics. You set the inside size.',
    fields: [
      rng('l', 'Inner length', 40, 98, 1, 80), rng('w', 'Inner width', 30, 100, 1, 50), rng('h', 'Inner height', 15, 60, 1, 30),
      rng('wall', 'Wall thickness', 1.6, 3, 0.2, 2),
      sel('lid', 'Lid', [['slip', 'Slip-fit lid'], ['screw', 'Screw lid (4 x M3)']], 'slip'),
      bool('vents', 'Vent slots in the long sides', true),
    ],
    marketLinks: [],
  },
  {
    id: 'board-case', name: 'Raspberry Pi / Arduino case', category: 'enclosure', material: 'PETG', colour: 'black',
    blurb: 'A tray with standoffs for the mounting holes, an optional lid and a header slot.',
    fields: [
      sel('board', 'Board', [['pi4', 'Raspberry Pi 4 / 5'], ['zero', 'Raspberry Pi Zero'], ['uno', 'Arduino Uno']], 'pi4'),
      rng('wall', 'Wall thickness', 1.6, 3, 0.2, 2),
      bool('lid', 'Include a slip-fit lid', true),
      bool('slot', 'Header slot in one long wall', true),
      bool('vents', 'Vent slots in the lid', true),
    ],
    marketLinks: [],
  },
  {
    id: 'phone-stand-pro', name: 'Adjustable phone stand', category: 'gadget', material: 'PLA', colour: 'white or black',
    blurb: 'A stand sized to your phone (with its case) and the viewing angle you want.',
    fields: [
      rng('t', 'Phone thickness with case', 7, 15, 0.5, 9), rng('angle', 'Viewing angle from flat', 50, 75, 1, 65, 'deg'),
      rng('width', 'Stand width', 50, 100, 1, 70), bool('cable', 'Charging cable hole', true),
    ],
    marketLinks: [],
  },
  {
    id: 'cable-clip-pro', name: 'Cable clip', category: 'gadget', material: 'PETG', colour: 'black',
    blurb: 'Open clips on one pad. Press the cable in through the slot.',
    fields: [
      rng('d', 'Cable diameter', 3, 12, 0.5, 6), rng('slots', 'Number of clips', 1, 3, 1, 1, ''),
      sel('mount', 'Mount', [['adhesive', 'Adhesive pad (flat underside)'], ['screw', 'Two screw holes']], 'adhesive'),
    ],
    marketLinks: [],
  },
  {
    id: 'name-plate', name: 'Name plate / keychain blank', category: 'gadget', material: 'PLA', colour: 'any',
    blurb: 'A plain plate with a key-ring or screw hole. The name itself is not modelled.',
    fields: [
      rng('l', 'Length', 40, 120, 1, 70), rng('w', 'Width', 15, 40, 1, 25), rng('t', 'Thickness', 2, 5, 0.5, 3),
      sel('holes', 'Holes', [['ring', 'One key-ring hole'], ['screw', 'Two screw holes'], ['none', 'No holes']], 'ring'),
    ],
    marketLinks: [],
  },
  {
    id: 'spacer-set', name: 'Spacer / standoff set', category: 'robotics', material: 'PETG', colour: 'any',
    blurb: 'Plain round spacers with a clearance hole for the screw size you pick.',
    fields: [
      sel('screw', 'Screw size', [['M2', 'M2'], ['M2.5', 'M2.5'], ['M3', 'M3'], ['M4', 'M4']], 'M3'),
      rng('od', 'Outer diameter', 4, 12, 0.5, 6), rng('len', 'Length', 2, 40, 1, 10), rng('count', 'Spacers in the set', 1, 12, 1, 6, ''),
    ],
    marketLinks: [],
  },
  {
    id: 'motor-mount', name: 'Motor mount', category: 'robotics', material: 'PETG', colour: 'black',
    blurb: 'A cradle for N20 and TT gear motors, or a plate for 16 mm square or 16 x 19 mm brushless motor patterns.',
    fields: [
      sel('motor', 'Motor', [['n20', 'N20 gear motor'], ['tt', 'TT gear motor'], ['16x16', 'Brushless 16 x 16 mm (M3)'], ['16x19', 'Brushless 16 x 19 mm (M3)']], 'n20'),
      rng('base', 'Base thickness', 3, 6, 0.5, 4),
    ],
    marketLinks: [],
  },
  {
    id: 'motor-wheel', name: 'Wheel for N20 / TT motors', category: 'robotics', material: 'TPU', colour: 'black',
    blurb: 'A flat-tread wheel with a round bore and optional lightening holes.',
    fields: [
      sel('shaft', 'Motor shaft', [['n20', 'N20 (3 mm)'], ['tt', 'TT (5.4 mm)']], 'tt'),
      rng('d', 'Diameter', 30, 80, 1, 65), rng('width', 'Width', 8, 30, 1, 20),
      sel('light', 'Lightening holes', [['0', 'None'], ['5', '5 holes'], ['6', '6 holes']], '5'),
    ],
    marketLinks: [],
  },
  {
    id: 'grid-bin', name: 'Grid storage bin (42 mm module)', category: 'gadget', material: 'PLA', colour: 'any',
    blurb: 'A storage bin sized in 42 mm grid units, with a simple stepped base that drops into the bin below. Not certified Gridfinity: check fit on your baseplate.',
    fields: [
      rng('ux', 'Units along X', 1, 4, 1, 2, '', '42 mm per unit'), rng('uy', 'Units along Y', 1, 4, 1, 2, '', '42 mm per unit'),
      rng('hu', 'Height in units', 2, 6, 1, 3, '', '7 mm per unit'), rng('wall', 'Wall thickness', 1.2, 2, 0.2, 1.2),
      rng('div', 'Dividers', 0, 3, 1, 0, ''), bool('label', 'Label tab on the front wall', false),
    ],
    marketLinks: [],
  },
  {
    id: 'drone-camera-mount', name: 'Drone camera mount (TPU-friendly)', category: 'drone', material: 'TPU', colour: 'black',
    blurb: 'A base plate with four 3.2 mm (M3) holes on a square pattern and two cheeks that hold an FPV camera at a tilt. Camera sizes and hole patterns are typical (smaller stacks often use M2): check your camera and frame.',
    fields: [
      sel('cam', 'Camera width', [['14', '14 mm (micro)'], ['19', '19 mm'], ['20', '20 mm']], '19'),
      rng('tilt', 'Tilt angle', 0, 40, 1, 25, 'deg', 'Typical FPV is 15 to 35'),
      sel('pattern', 'M3 hole spacing', [['20', '20 x 20 mm'], ['25.5', '25.5 x 25.5 mm'], ['30.5', '30.5 x 30.5 mm']], '25.5'),
      rng('strap', 'Strap slot width', 8, 20, 1, 12, 'mm', 'Width of the strap or tie that goes through'),
    ],
    marketLinks: [],
  },
];

export const COMING_SOON: { id: string; name: string }[] = [];

export const templateById = (id: unknown) => (typeof id === 'string' ? TEMPLATES.find((t) => t.id === id) ?? null : null);

export const defaultCfg = (t: TemplateDef): Cfg => Object.fromEntries(t.fields.map((f) => [f.key, f.default]));

const snap = (f: Extract<Field, { type: 'range' }>, v: number) => {
  const s = Math.round((v - f.min) / f.step) * f.step + f.min;
  return Math.min(f.max, Math.max(f.min, Math.round(s * 1000) / 1000));
};

/** Validate a config against the template's schema. strict (server): any bad, missing or unknown value throws.
 * lenient (browser storage): bad values fall back to the default. Returns every field, snapped to its step. */
export function normalizeCfg(t: TemplateDef, raw: unknown, strict = false): Cfg {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (strict) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('config must be an object');
    for (const k of Object.keys(o)) if (!t.fields.some((f) => f.key === k)) throw new Error(`unknown config field "${k}"`);
  }
  const out: Cfg = {};
  for (const f of t.fields) {
    const v = o[f.key];
    let ok = false;
    if (f.type === 'range') ok = typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max;
    else if (f.type === 'select') ok = typeof v === 'string' && f.options.some((x) => x.value === v);
    else ok = typeof v === 'boolean';
    if (!ok && strict) throw new Error(`bad value for "${f.key}"`);
    out[f.key] = !ok ? f.default : f.type === 'range' ? snap(f, v as number) : (v as number | string | boolean);
  }
  return out;
}

/** Stable text key for a config (field order of the schema), for merging identical cart lines. */
export const cfgKey = (t: TemplateDef, cfg: Cfg) => t.fields.map((f) => `${f.key}=${cfg[f.key]}`).join('&');
