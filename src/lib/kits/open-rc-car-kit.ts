// Open RC Car V3 chassis by CreativeElectronics (CC BY). Printed parts are the unmodified upstream STLs; prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/open-rc-car/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3, qty = 1): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty, size });
export const printedParts: Printed[] = [
  pp('part1', 'Part 1', 'Part1_-_OpenRC_V3.stl', [163, 108.8, 17], 1),
  pp('part2', 'Part 2', 'Part2_-_OpenRC_V3.stl', [25, 20, 12], 1),
  pp('part3', 'Part 3', 'Part3_-_OpenRC_V3.stl', [104.8, 27, 9], 1),
  pp('part4', 'Part 4', 'Part4_-_OpenRC_V3.stl', [50, 50, 15], 1),
  pp('part4-mirror', 'Part 4 (mirrored)', 'Part4Mirror_-_OpenRC_V3.stl', [50, 50, 15], 1),
  pp('part5', 'Part 5', 'Part5_-_OpenRC_V3.stl', [78, 80, 34], 1),
  pp('part6', 'Part 6', 'Part6_-_OpenRC_V3.stl', [50, 29.1, 10], 1),
  pp('part7', 'Part 7', 'Part7_-_OpenRC_V3.stl', [15, 57, 57], 1),
  pp('part7-mirror', 'Part 7 (mirrored)', 'Part7_Mirror_-_OpenRC_V3.stl', [15, 57, 57], 1),
  pp('part8', 'Part 8', 'Part8_-_OpenRC_V3.stl', [103.5, 23, 43.5], 1),
  pp('part9', 'Part 9', 'Part9_-_OpenRC_V3.stl', [12, 12, 20], 1),
  pp('part10', 'Part 10', 'Part10_-_OpenRC_V3.stl', [35.2, 84.3, 28], 1),
  pp('gear-z12', 'Gear Z12', 'Gear_z12.stl', [15.9, 15.9, 10], 1),
  pp('gear-z36', 'Gear Z36', 'Gear_z36.stl', [40.4, 40.4, 15], 1),
];

// From the upstream description; no prices here.
export const boughtParts = [
  { name: 'Receiver and transmitter', spec: '2.4 GHz, 3 channels', qty: 1, typical: 'electronics store' },
  { name: 'Servo FS90', spec: '120 degree micro servo', qty: 1, typical: 'electronics store' },
  { name: 'Brushless motor A2212', spec: '1000KV', qty: 1, typical: 'electronics store' },
  { name: 'Brushless ESC', spec: '30 A, SimonK firmware', qty: 1, typical: 'electronics store' },
  { name: 'LiPo battery', spec: '7.2 V 750 mAh, 2 cell', qty: 1, typical: 'electronics store' },
  { name: '608ZZ ball bearing', spec: '', qty: 4, typical: 'electronics store' },
  { name: 'M3 bolts', spec: '8 x M3-12 and 4 x M3-19, with 12 M3 nuts and 8 M3 washers', qty: 1, typical: 'hardware store' },
  { name: 'M4 bolts', spec: 'M4-12', qty: 1, typical: 'hardware store' },
  { name: 'M6 bolts', spec: '2 x M6-12 and 2 x M6-25, with 2 M6 nuts', qty: 1, typical: 'hardware store' },
  { name: 'M8 bolts', spec: 'M8-30, with 2 M8 nuts', qty: 2, typical: 'hardware store' },
];

export const credit = { author: 'CreativeElectronics', url: 'https://www.thingiverse.com/thing:4584657', licence: 'CC BY' };

// ponytail: upstream ships loose printable files and no assembly data, so the layout is a plain grid, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [(i % 4) * 150, Math.floor(i / 4) * 130, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const openRcCarKit = { id: 'open-rc-car', title: 'Open RC car chassis kit', category: 'robot', blurb: 'Open-source RC car chassis: printed chassis, steering, drive and gear parts for a 2-cell battery, an A2212 1000KV brushless motor with a 30 A ESC, an FS90 steering servo and a 2.4 GHz receiver and transmitter. Needs four 608ZZ bearings and M3, M4, M6 and M8 bolts. Receiver, transmitter, motor, ESC, servo, battery and hardware are bought separately.', printedParts, assembly, boughtParts, credit, approximate, assemblyData };
