// SAMPLE ITEMS — replace with what you actually make and your real prices
export const CATEGORIES = [
  { id: 'game', label: 'Game models and pieces' },
  { id: 'gadget', label: 'Everyday gadgets and life hacks' },
  { id: 'enclosure', label: 'Frames and enclosures for electronics' },
  { id: 'toy', label: 'Toys and moving toys' },
  { id: 'drone', label: 'Drone and RC bodies' },
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
  { id: 'cable-clip', exampleId: 'cable-clip', name: 'Desk cable clip', category: 'gadget', price: 49, material: 'PETG', description: 'A small open ring on a flat pad that holds a cable against a desk.' },
  { id: 'pi-case', exampleId: 'pi-case', name: 'Raspberry Pi case base', category: 'enclosure', price: 299, material: 'PETG', description: 'An open box with four screw posts sized for a Raspberry Pi board, and a cable cut-out; the lid is not included.' },
  { id: 'spinner-toy', exampleId: 'spinner-toy', name: 'Spinner toy head', category: 'toy', price: 149, material: 'PLA', description: 'A three-bar spinner with a 3 mm hole in the middle for a motor shaft.' },
  { id: 'drone-plate', exampleId: 'drone-plate', name: 'Drone frame plate', category: 'drone', price: 349, material: 'ABS', description: 'An X-shaped frame plate with four motor mounts and shaft holes; hardware is not included.' },
  { id: 'phone-stand', exampleId: 'phone-stand', name: 'Phone stand', category: 'gadget', price: 199, material: 'PLA', description: 'A sloped back and a front lip hold a phone upright, with a notch for the charging cable.' },
  { id: 'shelf-bracket', exampleId: 'shelf-bracket', name: 'Shelf bracket', category: 'gadget', price: 179, material: 'PETG', description: 'An L-shaped bracket with two screw holes in each leg.' },
];
