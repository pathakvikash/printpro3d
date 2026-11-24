// Kits: a named bundle of existing shop parts with default settings, added to the cart as ordinary lines. No prices here:
// every line is priced from its mesh like any other (quote.ts). Pure data and one cart check, safe for the browser.
import { CATALOG } from './catalog.ts';
import { MAX_KIT_LINES, MAX_LINES, MAX_TPL_LINES, lineKey, type CartLine } from './cart.ts';
import { defaultCfg, frameMotorXY, templateById, type Cfg } from './templateDefs.ts';
import type { AssemblyPart, PartMaterial, V3 } from './assembly.ts';
import { adaptedKits, isKitKey } from './kits/adapt.ts';

// templateId is a template id (configured part, cart kind 'tpl') or a fixed catalogue id (cart kind 'shop', config ignored)
// or a kit part key `<kitId>:<partId>` (src/lib/kits/adapt.ts; cart kind 'kit', `label` names it)
export type KitItem = { templateId: string; config: Cfg; qty: number; label?: string };
/** A bought-separately line: plain text, or text plus the ids of its pages in parts.ts. */
export type BoughtItem = string | { text: string; parts: string[] };
/** For kits not in this file (src/lib/kits/*.ts): `withParts('4x motors ...', 'motor-1404')` gives a row that links to its part pages. */
export const withParts = (text: string, ...parts: string[]): BoughtItem => ({ text, parts });
export const boughtText = (b: BoughtItem) => (typeof b === 'string' ? b : b.text);
export const boughtPartIds = (b: BoughtItem) => (typeof b === 'string' ? [] : b.parts);
/** Kits (from the list given) whose bought-separately rows reference a part. */
export const kitsUsingPart = <K extends { id: string; title: string; boughtParts: readonly BoughtItem[] }>(partId: string, kits: readonly K[]) => kits.filter((k) => k.boughtParts.some((b) => boughtPartIds(b).includes(partId)));
/** Third-party design: shown wherever its parts are listed (kit page, card, /credits). `files`: the STL files we ship, for the GPL source link. */
export type KitCredit = { author: string; url: string; licence: string; files: string[] };
export type Kit = { id: string; title: string; blurb: string; category: 'drone-rc' | 'robotics' | 'toys-hobby' | 'smart-home'; items: KitItem[]; boughtParts: BoughtItem[];
  badge?: string; credit?: KitCredit; approximate?: boolean;
  /** assembly bought-part id (exact, else without trailing digits) -> part page id, so the assembly drawing uses its reference model */
  refs?: Record<string, string>;
  /** a kit that is several products: each is a Kit of its own (own items and finished build); the kit page lets the customer pick */
  variants?: Kit[];
  /** The finished build for the viewer. `sizes` = real mesh bounding boxes by template id (the page has them); missing ones use nominal ones. Printed parts carry geometry = template id. */
  assembly?: (sizes?: Sizes) => AssemblyPart[] };
export type Sizes = Partial<Record<string, V3>>;

const tpl = (templateId: string, over: Cfg = {}, qty = 1): KitItem => ({ templateId, config: { ...defaultCfg(templateById(templateId)!), ...over }, qty });

type Over = Partial<AssemblyPart>;
const mat = (id: string): PartMaterial => (templateById(id)?.material as PartMaterial | undefined) ?? 'PETG';
// A printed part (a mesh of its template id) at its bounding box centre; the label defaults to the template name.
const printed = (id: string, key: string, label: string, size: V3, position: V3, explode: V3, o: Over = {}): AssemblyPart =>
  ({ id: key, label, geometry: id, material: mat(id), size, position, rotation: [0, 0, 0], explode, ...o });
const boughtPart = (id: string, label: string, size: V3, position: V3, explode: V3, o: Over = {}): AssemblyPart =>
  ({ id, label, material: 'bought', bought: true, size, position, rotation: [0, 0, 0], explode, ...o });
// FPV 3-inch frame settings: the frame's motor centres come from its diagonal (frameMotorXY), the assembly and the tests read the same ones.
// 160 mm (the template's largest) is the diagonal at which the camera mount fits between the two front prop guards.
const FPV_FRAME = { diag: 160, t: 3, motor: '12' } as const; // 12 x 12 M2 matches the prop guard's motor holes
const FPV_PROP = 76.2; // 3 inch propeller, mm
const FPV_GUARD_H = 25; // tall enough for the prop disc to sit inside the ring

const NOMINAL: Record<string, V3> = {
  'fpv-frame-3in': [137.1, 137.1, 3], 'drone-camera-mount': [33.4, 76.6, 32.4], 'prop-guard': [86.2, 86.2, FPV_GUARD_H], 'landing-gear': [60, 50, 50], 'battery-tray': [69, 56, 23], 'gps-antenna-mount': [37, 37, 25.5],
  'robot-chassis': [160, 110, 3], 'motor-mount': [56.8, 34, 18.4], 'motor-wheel': [65, 65, 20], 'servo-bracket': [44, 26, 29.1],
};

// FPV 3-inch: legs (z 0..) carry the frame; each motor sits on its prop guard on the frame's motor pad, the prop inside the ring; the flight
// controller stack (25 mm) rises from the centre plate and everything above (battery tray with its battery, GPS mount, camera mount) rests
// on that level, which is also the top of the guards. mm, z up, +y forward.
function fpvAssembly(sizes: Sizes = {}): AssemblyPart[] {
  const s = (id: string) => sizes[id] ?? NOMINAL[id];
  const [fr, lg, tr, gp, cm, pg] = ['fpv-frame-3in', 'landing-gear', 'battery-tray', 'gps-antenna-mount', 'drone-camera-mount', 'prop-guard'].map(s);
  const deck = lg[2] + fr[2], up = deck + FPV_GUARD_H, m = frameMotorXY(FPV_FRAME.diag), camY = tr[1] / 2 + 0.5 + cm[1] / 2; // up: top of the stack and the guards
  const list: AssemblyPart[] = [
    printed('landing-gear', 'gear', 'Landing gear', lg, [0, 0, lg[2] / 2], [0, 0, -40]),
    printed('fpv-frame-3in', 'frame', 'Frame', fr, [0, 0, lg[2] + fr[2] / 2], [0, 0, 0]),
    boughtPart('stack', 'Flight controller stack', [28, 28, FPV_GUARD_H], [0, 0, deck + FPV_GUARD_H / 2], [0, 0, 25]),
    printed('battery-tray', 'tray', 'Battery tray', tr, [0, 0, up + tr[2] / 2], [0, 0, 55]),
    boughtPart('battery', 'Battery', [65, 28, 20], [0, 0, up + 3 + 10], [0, 0, 80]),
    printed('gps-antenna-mount', 'gps', 'GPS mount', gp, [0, 0, up + tr[2] + gp[2] / 2], [0, 0, 115]),
    boughtPart('puck', 'GPS puck', [25, 25, 6], [0, 0, up + tr[2] + gp[2] + 3], [0, 0, 140], { shape: 'cylinder' }),
    printed('drone-camera-mount', 'cammount', 'Camera mount', cm, [0, camY, up + cm[2] / 2], [0, 45, 55]),
    boughtPart('camera', 'FPV camera', [19, 19, 19], [0, camY + cm[1] / 2 - 14, up + 15.5], [0, 70, 80]),
  ];
  for (const [i, [sx, sy]] of ([[1, 1], [-1, 1], [-1, -1], [1, -1]] as const).entries()) {
    const n = i + 1, x = sx * m, y = sy * m;
    list.push(
      boughtPart(`motor${n}`, 'Motor', [17, 17, 18], [x, y, deck + 3 + 9], [sx * 40, sy * 40, 15], { shape: 'cylinder' }),
      printed('prop-guard', `guard${n}`, 'Prop guard', pg, [x, y, deck + pg[2] / 2], [sx * 40, sy * 40, 0]),
      boughtPart(`prop${n}`, 'Propeller', [FPV_PROP, 7, 1], [x, y, deck + 22], [sx * 40, sy * 40, 40], { spin: { axis: [0, 0, 1], rpm: i % 2 ? 90 : -90 } }),
    );
  }
  return list;
}

// Rover: chassis plate above the axles; 4 motor mounts (x +-58) hang upside down under it with their motors pointing outward, a wheel on each outer end;
// battery tray in the middle gap with the pack and the ESP32 board on top, servo bracket cantilevered at the front.
function roverAssembly(sizes: Sizes = {}): AssemblyPart[] {
  const s = (id: string) => sizes[id] ?? (id === 'battery-tray' ? [81, 68, 25] as V3 : NOMINAL[id]); // the rover's tray is bigger than the drone's
  const [ch, mm, mw, sb, tr] = ['robot-chassis', 'motor-mount', 'motor-wheel', 'servo-bracket', 'battery-tray'].map(s);
  const axle = mw[0] / 2, zb = axle + 13.25, top = zb + ch[2], mx = 58, my = 1 + mm[0] / 2 + 0.5, wy = my + mm[0] / 2 + mw[2] / 2; // zb/top: chassis underside/top, my: mount centre y (it points along y)
  const list: AssemblyPart[] = [
    printed('robot-chassis', 'chassis', 'Chassis', ch, [0, 0, zb + ch[2] / 2], [0, 0, 0]),
    printed('battery-tray', 'tray', 'Battery tray', tr, [0, 0, top + tr[2] / 2], [0, 0, 30]),
    boughtPart('pack', 'Battery pack', [77, 40, 22], [0, 0, top + 3 + 11], [0, 0, 55]),
    boughtPart('esp32', 'ESP32 board', [51, 28, 10], [0, 0, top + 3 + 22 + 5], [0, 0, 90]),
    printed('servo-bracket', 'servo', 'Servo bracket', sb, [mx + mm[1] / 2 + sb[0] / 2, 0, top + sb[2] / 2], [50, 0, 25]),
    boughtPart('sg90', 'Servo SG90', [23, 12.5, 22.5], [mx + mm[1] / 2 + sb[0] / 2, 0, top + 3 + 11.25], [50, 0, 60]),
  ];
  let n = 0;
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    n++;
    list.push(
      printed('motor-mount', `mount${n}`, 'Motor mount', mm, [sx * mx, sy * my, zb - mm[2] / 2], [sx * 20, sy * 40, -20], { rotation: [180, 0, 90] }),
      boughtPart(`motor${n}`, 'TT motor', [22.5, 50, 18.5], [sx * mx, sy * my, axle], [sx * 20, sy * 40, -50]),
      printed('motor-wheel', `wheel${n}`, 'Wheel', mw, [sx * mx, sy * wy, axle], [sx * 20, sy * 90, 0], { rotation: [90, 0, 0], spin: { axis: [0, 0, 1], rpm: 40 } }),
    );
  }
  return list;
}

// A kit holds at most MAX_TPL_LINES distinct configured parts (one checkout rebuild each); repeats of a part are a quantity, not a line.
const BASE: Kit[] = [
  {
    id: 'fpv-3in-kit', title: 'FPV 3-inch build kit', category: 'drone-rc',
    blurb: 'The printed parts for a small FPV quad built around 3 inch (76.2 mm) props: our true-X frame (160 mm motor to motor, so adjacent motors are 113 mm apart and the props have 37 mm between their tips; 12 x 12 mm M2 motor holes and a 20 x 20 mm stack pattern are typical, check yours), a camera mount, 4 prop guards, landing gear, a battery tray and a GPS puck mount. Motors, electronics and battery are bought separately.',
    items: [tpl('fpv-frame-3in', FPV_FRAME), tpl('drone-camera-mount', { cam: '19', pattern: '20' }), tpl('prop-guard', { prop: '3', motor: FPV_FRAME.motor, height: FPV_GUARD_H }, 4), tpl('landing-gear', { pad: 20 }), tpl('battery-tray', { l: 65, w: 28, h: 20 }), tpl('gps-antenna-mount', { pattern: '20', puck: 25 })],
    assembly: fpvAssembly,
    boughtParts: [
      withParts('4x brushless motors (1404 class is typical for 3-inch props; the frame takes a 12 x 12 mm M2 bolt pattern)', 'motor-1404'),
      withParts('4x 3-inch propellers (a set of 4, typical)', 'prop-3in'),
      withParts('1x flight controller and ESC on a 20 x 20 mm mounting pattern (typical for this size)', 'stack-20x20'),
      withParts('1x FPV camera, about 19 mm wide (typical)', 'camera-19'),
      withParts('1x GPS module with a puck about 25 mm across (typical)', 'gps-puck-25'),
      withParts('1x LiPo battery that fits the tray (3S or 4S is typical)', 'lipo-3s-4s'),
      withParts('M2 and M3 screws, nuts, a battery strap and zip ties', 'screw-m2', 'screw-m3'),
    ],
  },
  {
    id: 'rover-kit', title: 'Rover build kit (4WD)', category: 'robotics',
    blurb: 'The printed parts for a small 4WD rover: a chassis plate, 4 motor mounts, 4 wheels, a servo bracket and a battery tray. Motors, electronics and battery are bought separately.',
    items: [tpl('robot-chassis', { drive: '4wd' }), tpl('motor-mount', { motor: 'tt' }, 4), tpl('motor-wheel', { shaft: 'tt' }, 4), tpl('servo-bracket', { servo: 'sg90' }), tpl('battery-tray', { l: 77, w: 40, h: 22 })],
    assembly: roverAssembly,
    boughtParts: [
      withParts('4x TT gear motors (typical 3-6 V hobby motors)', 'adafruit-tt-48'),
      withParts('1x micro servo, SG90 class (typical 23 x 12.5 mm body)', 'servo-sg90'),
      withParts('1x motor driver board and 1x microcontroller board', 'board-esp32-devkit'),
      '1x battery pack that fits the tray (for example 2 x 18650 cells in a holder)',
      withParts('M3 screws and nuts, standoffs, a battery strap and jumper wires', 'screw-m3'),
    ],
  },
];
export const KITS: Kit[] = [...BASE, ...adaptedKits()];

export const kitById = (id: unknown) => (typeof id === 'string' ? KITS.find((k) => k.id === id) ?? null : null);

/** The cart lines a kit adds. unitPrice per configured part comes from the page (mesh quote), never from this file. `show`: kit name and chosen-settings text for the cart line (display only). */
export const kitLines = (k: Kit, unitPrice: (i: KitItem) => number, show: { name?: string; note?: string } = {}): CartLine[] =>
  k.items.map((i) => (isKitKey(i.templateId) ? { kind: 'kit', id: i.templateId, label: `${(show.name ?? k.title).split(':')[0]} · ${i.label ?? i.templateId}`.slice(0, 80), ...(show.note ? { note: show.note } : {}), cfg: i.config, qty: i.qty, unitPrice: unitPrice(i) } : templateById(i.templateId) ? { kind: 'tpl', id: i.templateId, cfg: i.config, qty: i.qty, unitPrice: unitPrice(i) } : { kind: 'shop', id: i.templateId, qty: i.qty }));

/** Null when the kit can be added; otherwise the reason. The cart is never half-filled: all lines go in or none. */
export function kitBlocked(cart: CartLine[], lines: CartLine[]): string | null {
  const keys = new Set([...cart, ...lines].map(lineKey));
  const tplKeys = new Set([...cart, ...lines].filter((l) => l.kind === 'tpl').map(lineKey));
  if (tplKeys.size > MAX_TPL_LINES) return `An order holds at most ${MAX_TPL_LINES} different configured parts and this kit adds ${lines.filter((l) => l.kind === 'tpl').length}. Check out or remove some configured parts from your cart first.`;
  const kitKeys = new Set([...cart, ...lines].filter((l) => l.kind === 'kit').map(lineKey));
  if (kitKeys.size > MAX_KIT_LINES) return `An order holds at most ${MAX_KIT_LINES} different kit parts and this kit adds ${lines.filter((l) => l.kind === 'kit').length}. Check out or remove some kit parts from your cart first.`;
  if (keys.size > MAX_LINES) return `Your cart holds at most ${MAX_LINES} lines. Remove some, then add the kit.`;
  return null;
}

export const kitPartCount = (k: Kit) => k.items.reduce((n, i) => n + i.qty, 0);
export const isFixedItem = (id: string) => CATALOG.some((i) => i.id === id);
