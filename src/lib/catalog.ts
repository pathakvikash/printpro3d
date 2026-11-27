// SAMPLE ITEMS — replace with what you actually make and your real prices
export const CATEGORIES = [
  { id: 'game', label: 'Game models and pieces' },
  { id: 'gadget', label: 'Everyday gadgets and life hacks' },
  { id: 'enclosure', label: 'Frames and enclosures for electronics' },
  { id: 'toy', label: 'Toys and moving toys' },
  { id: 'drone', label: 'Drone and RC bodies' },
  { id: 'robotics', label: 'Robotics and hardware' },
  { id: 'laser', label: 'Laser cutting or engraving' },
  { id: 'material', label: 'Printing materials (filament, resin, sheets)' },
  { id: 'other', label: 'Something else' },
] as const;
export const QTY_BANDS = [
  { id: '1', label: '1' },
  { id: '2-10', label: '2–10' },
  { id: '11-100', label: '11–100' },
  { id: '100+', label: '100+ wholesale' },
] as const;
export const DELIVERABLES = [
  { id: 'print', label: 'Printed part' },
  { id: 'file', label: '3D file only' },
  { id: 'both', label: 'Both' },
] as const;

// exampleId is the id of the design in examples.ts that the item is printed from
export type Item = { id: string; exampleId: string; name: string; category: string; price: number; material: string; description: string; photo?: string; photoAlt?: string };
// photo: optional real photo path under /photos/ (see public/photos/README.md); unset keeps the live 3D preview

export const CATALOG: Item[] = [
  { id: 'pawn', exampleId: 'pawn', name: 'Chess-style pawn', category: 'game', price: 129, material: 'PLA', description: 'A pawn made of a round base, a tapered body, a collar and a ball head.' },
  { id: 'cable-clip', exampleId: 'cable-clip', name: 'Desk cable clip', category: 'gadget', price: 49, material: 'PETG', description: 'A small open ring on a flat pad; the cable snaps in through the slot in the ring.' },
  { id: 'pi-case', exampleId: 'pi-case', name: 'Raspberry Pi case base', category: 'enclosure', price: 299, material: 'PETG', description: 'An open tray sized for a Raspberry Pi board, with four mounting holes and a cable cut-out. The lid is not included.' },
  { id: 'spinner-toy', exampleId: 'spinner-toy', name: 'Spinner toy head', category: 'toy', price: 149, material: 'PLA', description: 'A three-bar spinner with a 3 mm hole in the middle for a motor shaft.' },
  { id: 'drone-plate', exampleId: 'drone-plate', name: 'Drone frame plate', category: 'drone', price: 349, material: 'ABS', description: 'An X-shaped frame plate with four motor mounts and shaft holes; hardware is not included. Adjacent motors are 56 mm apart, so props up to 53 mm across (2 inch at most) fit; 3 inch props (76.2 mm) would overlap.' },
  { id: 'phone-stand', exampleId: 'phone-stand', name: 'Phone stand', category: 'gadget', price: 199, material: 'PLA', description: 'A sloped back and a front lip hold a phone upright, with a hole in the base for the charging cable.' },
  { id: 'shelf-bracket', exampleId: 'shelf-bracket', name: 'Shelf bracket', category: 'gadget', price: 179, material: 'PETG', description: 'An L-shaped bracket with two screw holes in each leg.' },
];

// The shop sells drone/RC, robotics, toy/hobby and accessory parts only. Ids not listed here stay in CATALOG/TEMPLATES
// (old carts, orders and the builder examples still resolve them) but are not shown in the shop.
export const SHOP_CATEGORIES = [
  { id: 'drone-rc', label: 'Drone & RC' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'toys-hobby', label: 'Toys & Hobby' },
  { id: 'smart-home', label: 'Smart Home & Decor' },
  { id: 'accessories', label: 'Accessories' },
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['id'];
const SHOP_CAT: Record<string, ShopCategory> = {
  'drone-plate': 'drone-rc', 'drone-camera-mount': 'drone-rc', 'gps-antenna-mount': 'drone-rc', 'landing-gear': 'drone-rc', 'prop-guard': 'drone-rc', 'fpv-frame-3in': 'drone-rc', 'rc-bumper': 'drone-rc', 'battery-tray': 'drone-rc', 'wheel-hub': 'drone-rc',
  'servo-bracket': 'robotics', 'robot-chassis': 'robotics', 'robot-gripper': 'robotics',
  'fpv-3in-kit': 'drone-rc', 'rover-kit': 'robotics', 'whoop-kit': 'drone-rc', 'heli-kit': 'drone-rc', 'rc-car': 'drone-rc', 'desk-pet': 'robotics', 'so101-arm': 'robotics', 'stack-chan': 'robotics', 'open-rc-car': 'drone-rc', 'robot-dog': 'robotics', 'pocket-drone': 'drone-rc', 'humanoid-biped': 'robotics', 'car-robot': 'toys-hobby',
  'transformer-kit': 'toys-hobby', 'rolling-companion-kit': 'robotics', 'led-decor-kit': 'smart-home',
  'motor-mount': 'robotics', 'motor-wheel': 'robotics', 'spacer-set': 'robotics', 'board-case': 'robotics', 'pi-case': 'robotics', 'enclosure-box': 'robotics',
  'spinner-toy': 'toys-hobby', pawn: 'toys-hobby',
  'grid-bin': 'accessories',
};
export const shopCat = (id: string): ShopCategory | null => SHOP_CAT[id] ?? null;
export const shopCatLabel = (id: string) => SHOP_CATEGORIES.find((c) => c.id === id)?.label ?? id;
const rank = (id: string) => SHOP_CATEGORIES.findIndex((c) => c.id === shopCat(id));
// shop order: by shop category, then as listed
export const shopVisible = <T extends { id: string }>(xs: readonly T[]): T[] =>
  xs.filter((x) => shopCat(x.id)).sort((a, b) => rank(a.id) - rank(b.id));
