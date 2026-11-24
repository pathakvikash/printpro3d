// "Electronics & parts": the non-printed parts our kits list, offered by ENQUIRY. No prices, no SKUs, no stock, no brand names
// (the sourced motors from motors.ts excepted, shown with their citation). Every dimension is a typical class figure unless a source says otherwise.
// Pure data, safe for the browser. The 3D model of each part is built from `class` and `p` in partModels.ts.
import { MOTORS, type Motor } from './motors.ts';

export type PartCategory = 'motor' | 'prop' | 'fc-esc' | 'camera' | 'gps' | 'battery' | 'servo' | 'board' | 'hardware' | 'wheel' | 'gearmotor';
export type PartClass = 'motor-bell' | 'prop' | 'stack' | 'camera' | 'puck' | 'battery' | 'servo' | 'board' | 'screw' | 'gearmotor' | 'microgear';
export type PartSource = { label: string; url?: string; note: string };
export type PartSpec = { label: string; value: string; dim?: boolean }; // dim: a standard dimension, also drawn into the blueprint title block
export type Part = {
  id: string; category: PartCategory; class: PartClass; title: string;
  dims: [number, number, number]; // mm, the model's x y z envelope
  accuracy: 'typical' | 'sourced'; source?: PartSource;
  price?: undefined; sku?: undefined; // never set: parts are enquiry-only
  specs: PartSpec[];
  p: Record<string, number>; // builder parameters, mm
  blurb: string;
};

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  motor: 'Motors', prop: 'Propellers', 'fc-esc': 'Flight controller & ESC', camera: 'Cameras', gps: 'GPS', battery: 'Batteries', servo: 'Servos', board: 'Boards', hardware: 'Hardware', wheel: 'Wheels', gearmotor: 'Gear motors',
};
export const CATEGORY_ORDER: PartCategory[] = ['motor', 'gearmotor', 'prop', 'fc-esc', 'camera', 'gps', 'battery', 'servo', 'board', 'hardware', 'wheel'];

export const REFERENCE_BADGE = 'Reference model — typical dimensions, not a specific product';
export const LIPO_NOTE = 'Shipping of LiPo batteries is limited; enquire first.';

const s = (label: string, value: string, dim = false): PartSpec => ({ label, value, ...(dim ? { dim } : {}) });

const GENERIC: Part[] = [
  {
    id: 'motor-1404', category: 'motor', class: 'motor-bell', title: 'Brushless motor, 1404 class', dims: [17, 17, 18], accuracy: 'typical', p: { d: 17, h: 18, pattern: 9, bolt: 2.2, shaft: 2 },
    blurb: 'Small outrunner motor for 3 inch props.',
    specs: [s('Stator size class', '14 mm diameter, 4 mm tall'), s('Bolt pattern', '9 × 9 mm, M2', true), s('Bell diameter', 'about 17 mm', true), s('Shaft', 'about 2 mm', true)],
  },
  {
    id: 'motor-0802', category: 'motor', class: 'motor-bell', title: 'Brushless motor, 0802 class', dims: [9, 9, 10], accuracy: 'typical', p: { d: 9, h: 10, pattern: 0, bolt: 0, shaft: 1 },
    blurb: 'Tiny motor for 1S whoop frames; pressed or glued into the frame rather than bolted.',
    specs: [s('Stator size class', '8 mm diameter, 2 mm tall'), s('Bell diameter', 'about 9 mm', true), s('Shaft', 'about 1 mm', true)],
  },
  {
    id: 'motor-1102', category: 'motor', class: 'motor-bell', title: 'Brushless motor, 1102 class', dims: [13, 13, 12], accuracy: 'typical', p: { d: 13, h: 12, pattern: 0, bolt: 0, shaft: 1.5 },
    blurb: 'Small motor for 1S whoop frames.',
    specs: [s('Stator size class', '11 mm diameter, 2 mm tall'), s('Bell diameter', 'about 13 mm', true), s('Shaft', 'about 1.5 mm', true)],
  },
  {
    id: 'prop-3in', category: 'prop', class: 'prop', title: 'Propeller, 3 inch', dims: [76.2, 76.2, 5], accuracy: 'typical', p: { d: 76.2, n: 3, hub: 9, hubH: 5, w: 10 },
    blurb: 'Three-blade 3 inch prop, drawn as a swept disc with simplified blades.',
    specs: [s('Diameter', '3 in (76.2 mm)', true), s('Blades', '3 (typical)'), s('Hub', 'about 9 mm', true)],
  },
  {
    id: 'prop-31mm', category: 'prop', class: 'prop', title: 'Propeller, 31 mm', dims: [31, 31, 4], accuracy: 'typical', p: { d: 31, n: 4, hub: 5, hubH: 4, w: 4.5 },
    blurb: 'Four-blade 31 mm prop for 1S whoop frames, drawn as a swept disc with simplified blades.',
    specs: [s('Diameter', 'about 31 mm', true), s('Blades', '4 (typical)'), s('Hub', 'about 5 mm', true)],
  },
  {
    id: 'stack-20x20', category: 'fc-esc', class: 'stack', title: 'Flight controller / ESC stack, 20 × 20 mm', dims: [27, 27, 4.6], accuracy: 'typical', p: { side: 27, pitch: 20, hole: 2.2, t: 1.6 },
    blurb: 'A flight controller or ESC board on the 20 × 20 mm stack pattern.',
    specs: [s('Stack hole spacing', '20 × 20 mm, M2', true), s('Board size', 'about 27 × 27 mm', true), s('Hole diameter', 'about 2.2 mm', true)],
  },
  {
    id: 'aio-fc-1s', category: 'fc-esc', class: 'stack', title: 'All-in-one flight controller, 1S whoop, 25.5 × 25.5 mm holes', dims: [29, 29, 4.6], accuracy: 'typical', p: { side: 29, pitch: 25.5, hole: 2.2, t: 1.6 },
    blurb: 'A small all-in-one flight controller and ESC board for 1S whoop frames (typical size, check yours).',
    specs: [s('Mounting hole spacing', '25.5 × 25.5 mm, M2 (typical; some boards use 20 × 20 mm)', true), s('Board size', 'about 29 × 29 mm (typical)', true), s('Hole diameter', 'about 2.2 mm', true)],
  },
  {
    id: 'camera-19', category: 'camera', class: 'camera', title: 'FPV camera, 19 mm', dims: [19, 20, 19], accuracy: 'typical', p: { w: 19, depth: 14, lens: 14, lensL: 6 },
    blurb: 'Compact FPV camera about 19 mm wide.',
    specs: [s('Width', 'about 19 mm', true), s('Body depth', 'about 14 mm, plus a lens barrel of about 6 mm', true), s('Lens barrel diameter', 'about 14 mm', true)],
  },
  {
    id: 'camera-nano-14', category: 'camera', class: 'camera', title: 'Nano FPV camera, 14 mm', dims: [14, 15, 14], accuracy: 'typical', p: { w: 14, depth: 10, lens: 8, lensL: 5 },
    blurb: 'Nano FPV camera about 14 × 14 mm (typical size, check yours).',
    specs: [s('Board width', 'about 14 mm (typical)', true), s('Length', 'about 15 mm including the lens (typical)', true), s('Lens barrel diameter', 'about 8 mm (typical)', true)],
  },
  {
    id: 'gps-puck-25', category: 'gps', class: 'puck', title: 'GPS module, 25 mm puck', dims: [25, 25, 8], accuracy: 'typical', p: { d: 25, h: 6, base: 18, baseH: 2 },
    blurb: 'GPS module with a round puck about 25 mm across.',
    specs: [s('Puck diameter', 'about 25 mm', true), s('Height', 'about 8 mm including the base', true)],
  },
  {
    id: 'lipo-3s-4s', category: 'battery', class: 'battery', title: 'LiPo battery, 3S–4S small FPV size', dims: [80, 28, 20], accuracy: 'typical', p: { l: 65, w: 28, h: 20, lead: 15 },
    blurb: 'A small LiPo pack that fits a 65 × 28 × 20 mm tray, with its lead.',
    specs: [s('Pack envelope', 'about 65 × 28 × 20 mm, plus about 15 mm of lead', true), s('Cells', '3S or 4S'), s('Nominal voltage', '3.7 V per cell (11.1 V for 3S, 14.8 V for 4S)')],
  },
  {
    id: 'lipo-1s', category: 'battery', class: 'battery', title: 'LiPo battery, 1S whoop size', dims: [45, 10, 15], accuracy: 'typical', p: { l: 30, w: 10, h: 15, lead: 15 },
    blurb: 'A small single-cell LiPo pack for whoop frames, with its lead.',
    specs: [s('Pack envelope', 'about 30 × 10 × 15 mm, plus about 15 mm of lead', true), s('Cells', '1S'), s('Nominal voltage', '3.7 V')],
  },
  {
    id: 'servo-sg90', category: 'servo', class: 'servo', title: 'Micro servo, 23 × 12.2 mm body', dims: [32.5, 12.2, 29], accuracy: 'typical', p: { l: 23, w: 12.2, h: 22.5, ear: 32.5, earZ: 15, total: 29 },
    blurb: 'Micro servo with a 23 × 12.2 mm body and mounting ears.',
    specs: [s('Body', '23 × 12.2 mm', true), s('Overall height', 'about 29 mm with the output shaft', true), s('Across the mounting ears', 'about 32.5 mm', true)],
  },
  {
    id: 'board-esp32-devkit', category: 'board', class: 'board', title: 'ESP32 development board, about 51 × 28 mm', dims: [51, 28, 5], accuracy: 'typical', p: { l: 51, w: 28, t: 1.6 },
    blurb: 'A microcontroller development board with two pin-header strips.',
    specs: [s('Board', 'about 51 × 28 mm', true), s('Header pitch', '2.54 mm', true), s('Height', 'about 5 mm, pins below excluded', true)],
  },
  {
    id: 'screw-m2', category: 'hardware', class: 'screw', title: 'Socket head screw, M2 × 6', dims: [3.8, 3.8, 8], accuracy: 'sourced', p: { d: 2, len: 6, hd: 3.8, hk: 2 },
    source: { label: 'ISO 4762 socket head cap screw, standard dimensions', note: 'Head diameter and head height are the standard values for M2. The screw model is simplified.' },
    blurb: 'Standard M2 socket head screw.',
    specs: [s('Thread', 'M2', true), s('Length', '6 mm', true), s('Head', '3.8 mm across, 2 mm tall', true)],
  },
  {
    id: 'screw-m3', category: 'hardware', class: 'screw', title: 'Socket head screw, M3 × 8', dims: [5.5, 5.5, 11], accuracy: 'sourced', p: { d: 3, len: 8, hd: 5.5, hk: 3 },
    source: { label: 'ISO 4762 socket head cap screw, standard dimensions', note: 'Head diameter and head height are the standard values for M3. The screw model is simplified.' },
    blurb: 'Standard M3 socket head screw.',
    specs: [s('Thread', 'M3', true), s('Length', '8 mm', true), s('Head', '5.5 mm across, 3 mm tall', true)],
  },
];

// The sourced motors stay in motors.ts; here they are referenced, never copied. The citation and the figures come from there.
// The 3D model uses typical class dimensions (motors.ts holds performance data, not drawings).
const LINKED: Record<string, Pick<Part, 'category' | 'class' | 'dims' | 'p' | 'blurb'> & { dimSpecs: PartSpec[] }> = {
  'gr2306-buttercutter': { category: 'motor', class: 'motor-bell', dims: [28, 28, 31], p: { d: 28, h: 31, pattern: 16, bolt: 3.2, shaft: 5 }, blurb: 'Outrunner motor for 5 inch props.', dimSpecs: [s('Bolt pattern', '16 × 16 mm, M3 (typical for this class)', true), s('Bell diameter', 'about 28 mm (typical for this class)', true)] },
  'adafruit-tt-48': { category: 'gearmotor', class: 'gearmotor', dims: [70, 22.5, 18.5], p: { len: 70, w: 22.5, h: 18.5 }, blurb: 'Geared hobby motor for small rovers.', dimSpecs: [s('Body', 'about 70 × 22.5 × 18.5 mm (typical for this class, shaft excluded)', true)] },
  'pololu-n20-hp-50': { category: 'gearmotor', class: 'microgear', dims: [33, 12, 10], p: { len: 24, w: 12, h: 10, shaft: 3, shaftL: 9 }, blurb: 'Micro metal gearmotor.', dimSpecs: [s('Cross-section', '12 × 10 mm', true), s('Shaft', '3 mm D-shaft', true)] },
  'pololu-n20-lp-50': { category: 'gearmotor', class: 'microgear', dims: [33, 12, 10], p: { len: 24, w: 12, h: 10, shaft: 3, shaftL: 9 }, blurb: 'Micro metal gearmotor.', dimSpecs: [s('Cross-section', '12 × 10 mm', true), s('Shaft', '3 mm D-shaft', true)] },
};

function motorSpecs(m: Motor): PartSpec[] {
  if (m.kind === 'prop') {
    const r = m.runs[0], top = r.points[r.points.length - 1];
    return [s('Tested prop', m.prop), s('Test supply', r.label), s('At full throttle', `${top.thrustG} g thrust, ${top.amps} A`)];
  }
  return m.runs.map((r) => s(`${r.volts} V`, `${r.noLoadRpm} rpm no-load, ${r.stallKgCm} kg-cm stall, ${r.stallA} A stall`));
}

const linked = (m: Motor): Part => {
  const l = LINKED[m.id];
  return {
    id: m.id, category: l.category, class: l.class, title: m.name, dims: l.dims, accuracy: 'typical', p: l.p, blurb: l.blurb,
    source: { label: m.source.label, url: m.source.url, note: `${m.source.kind}. ${m.source.note} The 3D model uses typical dimensions for this class, not the maker's drawing.` },
    specs: [...l.dimSpecs, ...motorSpecs(m)],
  };
};

export const PARTS: Part[] = [...GENERIC.slice(0, 1), ...MOTORS.filter((m) => LINKED[m.id]).map(linked), ...GENERIC.slice(1)];

const byId = new Map(PARTS.map((x) => [x.id, x]));
export const partById = (id: unknown): Part | null => (typeof id === 'string' ? byId.get(id) ?? null : null);
export const partsByCategory = (c: PartCategory): Part[] => PARTS.filter((x) => x.category === c);
/** True for the motors that come from motors.ts: they keep their citation and their 'Test it in Build' link. */
export const isSourcedMotor = (id: string) => id in LINKED;
