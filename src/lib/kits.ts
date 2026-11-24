// Kits: a named bundle of existing shop parts with default settings, added to the cart as ordinary lines. No prices here:
// every line is priced from its mesh like any other (quote.ts). Pure data and one cart check, safe for the browser.
import { CATALOG } from './catalog.ts';
import { MAX_LINES, MAX_TPL_LINES, lineKey, type CartLine } from './cart.ts';
import { defaultCfg, templateById, type Cfg } from './templateDefs.ts';

// templateId is a template id (configured part, cart kind 'tpl') or a fixed catalogue id (cart kind 'shop', config ignored)
export type KitItem = { templateId: string; config: Cfg; qty: number };
export type Kit = { id: string; title: string; blurb: string; category: 'drone-rc' | 'robotics'; items: KitItem[]; boughtParts: string[] };

const tpl = (templateId: string, over: Cfg = {}, qty = 1): KitItem => ({ templateId, config: { ...defaultCfg(templateById(templateId)!), ...over }, qty });
const fixed = (templateId: string, qty = 1): KitItem => ({ templateId, config: {}, qty });

// A kit holds at most MAX_TPL_LINES distinct configured parts (one checkout rebuild each); repeats of a part are a quantity, not a line.
export const KITS: Kit[] = [
  {
    id: 'fpv-3in-kit', title: 'FPV 3-inch build kit', category: 'drone-rc',
    blurb: 'The printed parts for a small FPV quad built around 3 inch props: our X frame plate (a small sample plate, so check its motor holes against your motors), a camera mount, 4 prop guards, landing gear, a battery tray and a GPS puck mount. Motors, electronics and battery are bought separately.',
    items: [fixed('drone-plate'), tpl('drone-camera-mount', { cam: '19', pattern: '20' }), tpl('prop-guard', { prop: '3', motor: '12' }, 4), tpl('landing-gear'), tpl('battery-tray', { l: 65, w: 28, h: 20 }), tpl('gps-antenna-mount', { pattern: '20', puck: 25 })],
    boughtParts: [
      '4x brushless motors (1404 class is typical for 3-inch props)',
      '4x 3-inch propellers (a set of 4, typical)',
      '1x flight controller and ESC on a 20 x 20 mm mounting pattern (typical for this size)',
      '1x FPV camera, about 19 mm wide (typical)',
      '1x GPS module with a puck about 25 mm across (typical)',
      '1x LiPo battery that fits the tray (3S or 4S is typical)',
      'M2 and M3 screws, nuts, a battery strap and zip ties',
    ],
  },
  {
    id: 'rover-kit', title: 'Rover build kit (4WD)', category: 'robotics',
    blurb: 'The printed parts for a small 4WD rover: a chassis plate, 4 motor mounts, 4 wheels, a servo bracket and a battery tray. Motors, electronics and battery are bought separately.',
    items: [tpl('robot-chassis', { drive: '4wd' }), tpl('motor-mount', { motor: 'tt' }, 4), tpl('motor-wheel', { shaft: 'tt' }, 4), tpl('servo-bracket', { servo: 'sg90' }), tpl('battery-tray', { l: 77, w: 40, h: 22 })],
    boughtParts: [
      '4x TT gear motors (typical 3-6 V hobby motors)',
      '1x micro servo, SG90 class (typical 23 x 12.5 mm body)',
      '1x motor driver board and 1x microcontroller board',
      '1x battery pack that fits the tray (for example 2 x 18650 cells in a holder)',
      'M3 screws and nuts, standoffs, a battery strap and jumper wires',
    ],
  },
];

export const kitById = (id: unknown) => (typeof id === 'string' ? KITS.find((k) => k.id === id) ?? null : null);

/** The cart lines a kit adds. unitPrice per configured part comes from the page (mesh quote), never from this file. */
export const kitLines = (k: Kit, unitPrice: (i: KitItem) => number): CartLine[] =>
  k.items.map((i) => (templateById(i.templateId) ? { kind: 'tpl', id: i.templateId, cfg: i.config, qty: i.qty, unitPrice: unitPrice(i) } : { kind: 'shop', id: i.templateId, qty: i.qty }));

/** Null when the kit can be added; otherwise the reason. The cart is never half-filled: all lines go in or none. */
export function kitBlocked(cart: CartLine[], lines: CartLine[]): string | null {
  const keys = new Set([...cart, ...lines].map(lineKey));
  const tplKeys = new Set([...cart, ...lines].filter((l) => l.kind === 'tpl').map(lineKey));
  if (tplKeys.size > MAX_TPL_LINES) return `An order holds at most ${MAX_TPL_LINES} different configured parts and this kit adds ${lines.filter((l) => l.kind === 'tpl').length}. Check out or remove some configured parts from your cart first.`;
  if (keys.size > MAX_LINES) return `Your cart holds at most ${MAX_LINES} lines. Remove some, then add the kit.`;
  return null;
}

export const kitPartCount = (k: Kit) => k.items.reduce((n, i) => n + i.qty, 0);
export const isFixedItem = (id: string) => CATALOG.some((i) => i.id === id);
