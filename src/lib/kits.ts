// Kits: a named bundle of existing shop parts with default settings, added to the cart as ordinary lines. No prices here:
// every line is priced from its mesh like any other (quote.ts). Pure data and one cart check, safe for the browser.
import { CATALOG } from './catalog.ts';
import { MAX_KIT_LINES, MAX_LINES, MAX_TPL_LINES, lineKey, type CartLine } from './cart.ts';
import { defaultCfg, templateById, type Cfg } from './templateDefs.ts';
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
const fixed = (templateId: string, qty = 1): KitItem => ({ templateId, config: {}, qty });

type Over = Partial<AssemblyPart>;
const mat = (id: string): PartMaterial => (templateById(id)?.material as PartMaterial | undefined) ?? 'PETG';
// A printed part (a mesh of its template id) at its bounding box centre; the label defaults to the template name.
const printed = (id: string, key: string, label: string, size: V3, position: V3, explode: V3, o: Over = {}): AssemblyPart =>
  ({ id: key, label, geometry: id, material: mat(id), size, position, rotation: [0, 0, 0], explode, ...o });
const boughtPart = (id: string, label: string, size: V3, position: V3, explode: V3, o: Over = {}): AssemblyPart =>
  ({ id, label, material: 'bought', bought: true, size, position, rotation: [0, 0, 0], explode, ...o });
const NOMINAL: Record<string, V3> = {
  'drone-plate': [78, 78, 3], 'drone-camera-mount': [33.4, 76.6, 32.4], 'prop-guard': [86.2, 86.2, 12], 'landing-gear': [60, 38, 50], 'battery-tray': [69, 56, 23], 'gps-antenna-mount': [37, 37, 25.5],
  'robot-chassis': [160, 110, 3], 'motor-mount': [56.8, 34, 18.4], 'motor-wheel': [65, 65, 20], 'servo-bracket': [44, 26, 29.1],
};

// FPV 3-inch: legs (z 0..) carry the plate; arms (bought) under the plate reach 4 motors, each inside a prop guard that rests on a plate corner;
// battery tray on the plate with its battery, GPS mount on the tray, camera mount forward. mm, z up, +y forward.
function fpvAssembly(sizes: Sizes = {}): AssemblyPart[] {
  const s = (id: string) => sizes[id] ?? NOMINAL[id];
  const [pl, lg, tr, gp, cm, pg] = ['drone-plate', 'landing-gear', 'battery-tray', 'gps-antenna-mount', 'drone-camera-mount', 'prop-guard'].map(s);
  const deck = lg[2] + pl[2], ty = -3, camY = ty + tr[1] / 2 + 0.5 + cm[1] / 2, c = 75; // c: guard centre from the middle, clear of tray and camera mount
  const list: AssemblyPart[] = [
    printed('landing-gear', 'gear', 'Landing gear', lg, [0, 0, lg[2] / 2], [0, 0, -40]),
    printed('drone-plate', 'plate', 'Frame plate', pl, [0, 0, lg[2] + pl[2] / 2], [0, 0, 0]),
    printed('battery-tray', 'tray', 'Battery tray', tr, [0, ty, deck + tr[2] / 2], [0, 0, 30]),
    boughtPart('battery', 'Battery', [65, 28, 20], [0, ty, deck + 3 + 10], [0, 0, 55]),
    printed('gps-antenna-mount', 'gps', 'GPS mount', gp, [0, ty, deck + tr[2] + gp[2] / 2], [0, 0, 90]),
    boughtPart('puck', 'GPS puck', [25, 25, 6], [0, ty, deck + tr[2] + gp[2] + 3], [0, 0, 115], { shape: 'cylinder' }),
    printed('drone-camera-mount', 'cammount', 'Camera mount', cm, [0, camY, deck + cm[2] / 2], [0, 45, 25]),
    boughtPart('camera', 'FPV camera', [19, 19, 19], [0, camY + cm[1] / 2 - 14, deck + 15.5], [0, 70, 55]),
  ];
  for (const [i, [sx, sy]] of ([[1, 1], [-1, 1], [-1, -1], [1, -1]] as const).entries()) {
    const n = i + 1;
    list.push(
      boughtPart(`arm${n}`, 'Arm', [106, 8, 3], [sx * c / 2, sy * c / 2, lg[2] - 1.5], [sx * 25, sy * 25, -20], { rotation: [0, 0, sx * sy * 45] }),
      boughtPart(`motor${n}`, 'Motor', [19, 19, 14], [sx * c, sy * c, lg[2] + 7], [sx * 40, sy * 40, -5], { shape: 'cylinder' }),
      printed('prop-guard', `guard${n}`, 'Prop guard', pg, [sx * c, sy * c, deck + pg[2] / 2], [sx * 40, sy * 40, 25]),
      boughtPart(`prop${n}`, 'Propeller', [76.2, 7, 1], [sx * c, sy * c, lg[2] + 14.5], [sx * 40, sy * 40, 55], { spin: { axis: [0, 0, 1], rpm: i % 2 ? 90 : -90 } }),
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
    blurb: 'The printed parts for a small FPV quad built around 3 inch props: our X frame plate (a small sample plate, so check its motor holes against your motors), a camera mount, 4 prop guards, landing gear, a battery tray and a GPS puck mount. Motors, electronics and battery are bought separately.',
    items: [fixed('drone-plate'), tpl('drone-camera-mount', { cam: '19', pattern: '20' }), tpl('prop-guard', { prop: '3', motor: '12' }, 4), tpl('landing-gear'), tpl('battery-tray', { l: 65, w: 28, h: 20 }), tpl('gps-antenna-mount', { pattern: '20', puck: 25 })],
    assembly: fpvAssembly,
    boughtParts: [
      withParts('4x brushless motors (1404 class is typical for 3-inch props)', 'motor-1404'),
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

/** The cart lines a kit adds. unitPrice per configured part comes from the page (mesh quote), never from this file. */
export const kitLines = (k: Kit, unitPrice: (i: KitItem) => number): CartLine[] =>
  k.items.map((i) => (isKitKey(i.templateId) ? { kind: 'kit', id: i.templateId, label: i.label ?? i.templateId, cfg: i.config, qty: i.qty, unitPrice: unitPrice(i) } : templateById(i.templateId) ? { kind: 'tpl', id: i.templateId, cfg: i.config, qty: i.qty, unitPrice: unitPrice(i) } : { kind: 'shop', id: i.templateId, qty: i.qty }));

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
