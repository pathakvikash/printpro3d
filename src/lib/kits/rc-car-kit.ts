// zcar, a 1/28 RC chassis by alexyu132 (GPL-3.0). Printed parts are the unmodified upstream STLs; prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/rc-car/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
export const printedParts: Printed[] = [
  { id: 'tray1', label: 'Chassis tray 1 (print at 0.15 mm)', file: DIR + 'tray1.stl', material: 'PLA', qty: 1, size: [140.2, 117.4, 49.5] },
  { id: 'tray2', label: 'Chassis tray 2 (print at 0.1 mm)', file: DIR + 'tray2.stl', material: 'PLA', qty: 1, size: [97.2, 93.1, 13.4] },
  { id: 'pinion', label: '10T motor pinion', file: DIR + '10T_pinion.stl', material: 'PLA', qty: 1, size: [5.4, 5.6, 6] },
  { id: 'gear', label: '43T spur gear', file: DIR + '43T_gear.stl', material: 'PLA', qty: 1, size: [21.4, 21.4, 9] },
  { id: 'motor-mount', label: 'Motor mount, 10T:43T, loose fit', file: DIR + 'motor_mount_10_43_loose.stl', material: 'PLA', qty: 1, size: [36.3, 18.8, 14] },
];

export const boughtParts = [
  { name: 'M3x20mm button head screw', spec: 'M3, 20 mm', qty: 7, typical: 'hardware store' },
  { name: 'M3x14mm button head screw', spec: 'M3, 14 mm', qty: 2, typical: 'hardware store' },
  { name: 'M3x10mm button head screw', spec: 'M3, 10 mm', qty: 8, typical: 'hardware store' },
  { name: 'M3 lock nut', spec: 'M3 nylon insert', qty: 17, typical: 'hardware store' },
  { name: '625 bearing', spec: '5x16x5 mm', qty: 4, typical: 'bearing supplier' },
  { name: 'Brushed motor', spec: '130 size, 2S compatible, 15 to 15.4 mm across flats', qty: 1, typical: 'hobby store' },
  { name: 'Micro servo', spec: 'SG90 class', qty: 1, typical: 'hobby store' },
  { name: 'Compression spring, front', spec: '~4 mm OD, ~5 mm long, soft', qty: 2, typical: 'cut from a pen spring' },
  { name: 'Compression spring, rear', spec: '~4 mm OD, ~22 mm long', qty: 2, typical: 'cut from a pen spring' },
  { name: 'LiPo battery', spec: '2S 300 to 350 mAh, up to 45x23x16 mm', qty: 1, typical: 'hobby store' },
  { name: 'Brushed ESC', spec: 'small, 2S compatible', qty: 1, typical: 'hobby store' },
  { name: 'Radio receiver', spec: '2+ channels, under 34x22x13 mm', qty: 1, typical: 'hobby store' },
  { name: 'MINI-Z body shell', spec: '90 mm wheelbase (M)', qty: 1, typical: 'hobby store' },
  { name: 'MINI-Z tires', spec: '8.5 mm wide, 25 mm OD, 20 mm ID', qty: 4, typical: 'come with the shell' },
];

export const credit = { author: 'alexyu132', url: 'https://github.com/alexyu132/zcar', licence: 'GPL-3.0' };

const bought = (id: string, label: string, size: V3, position: V3, explode: V3, shape?: 'box' | 'cylinder'): AssemblyPart =>
  ({ id, label, material: 'bought', size, position, rotation: [0, 0, 0], explode, bought: true, shape });

// ponytail: upstream ships print trays and no assembly info, so every position is APPROXIMATE (a stacked layout, not the real fit).
export const approximate = true;
export function assembly(): AssemblyPart[] {
  const p = (i: number): Printed => printedParts[i];
  const part = (i: number, position: V3, explode: V3, extra: Partial<AssemblyPart> = {}): AssemblyPart =>
    ({ id: p(i).id, label: p(i).label, geometry: p(i).file, material: p(i).material, size: p(i).size, position, rotation: [0, 0, 0], explode, ...extra });
  return [
    part(0, [0, 0, p(0).size[2] / 2], [0, 0, 0]),
    part(1, [0, 0, p(0).size[2] + p(1).size[2] / 2], [0, 0, 40]),
    part(4, [-30, 0, 62], [-30, 0, 30]),
    part(2, [-30, 0, 70], [-30, 0, 45], { spin: { axis: [0, 0, 1], rpm: 120 } }),
    part(3, [-10, 0, 70], [-10, 0, 45], { spin: { axis: [0, 0, 1], rpm: 30 } }),
    bought('motor', '130 motor', [15, 15, 25], [-45, 0, 58], [-60, 0, 20], 'cylinder'),
    bought('servo', 'SG90 servo', [23, 12, 22], [50, 0, 60], [50, 0, 40]),
    bought('battery', '2S LiPo', [45, 23, 16], [10, 0, 80], [10, 0, 60]),
  ];
}

export const rcCarKit = { id: 'rc-car', title: '1/28 RC car (zcar)', category: 'rc', blurb: 'Open-hardware 1/28 RC chassis with independent front suspension and Ackermann steering. Fits MINI-Z body shells.', printedParts, assembly, boughtParts, credit, approximate };
