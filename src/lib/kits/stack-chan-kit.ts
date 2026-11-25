// Stack-chan desk companion, SG90 case, by the Stack-chan project (Apache-2.0). Printed parts are the unmodified upstream STLs; prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/stack-chan/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty: 1, size });
export const printedParts: Printed[] = [
  pp('shell', 'Shell', 'shell_SG90.stl', [54, 42.5, 54]),
  pp('feet', 'Feet', 'feet_SG90.stl', [48, 37, 8.2]),
  pp('bracket-f', 'Servo bracket (front)', 'bracket_SG90_f.stl', [40.4, 19.7, 39.1]),
  pp('bracket-b', 'Servo bracket (back)', 'bracket_SG90_b.stl', [26.5, 10.7, 39.1]),
];

// From the upstream case README; no prices here.
export const boughtParts = [
  { name: 'M5Stack Core', spec: 'Basic, Gray, Go or Fire', qty: 1, typical: 'electronics store' },
  { name: 'Stack-chan board', spec: 'servo and battery board from the upstream schematics', qty: 1, typical: 'electronics store' },
  { name: 'SG90 micro servo', spec: 'PWM servo (serial servos RS30X and SCS0009 need other case files)', qty: 2, typical: 'hobby store' },
  { name: 'Lithium polymer battery', spec: '3.7 V, 400 mAh or 640 mAh, PH 2-pin cable', qty: 1, typical: 'electronics store' },
  { name: 'M2 screws', spec: '4 mm x 4 pcs and 8 mm x 2 pcs (optional M3 15 mm x 2)', qty: 1, typical: 'hardware store' },
];

export const credit = { author: 'Stack-chan project', url: 'https://github.com/stack-chan/stack-chan', licence: 'Apache-2.0' };

// ponytail: no assembly data is read from upstream, so the layout is a plain row, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [i * 70, 0, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const stackChanKit = { id: 'stack-chan', title: 'Stack-chan desk companion kit', category: 'robot', blurb: 'Small pan-tilt desk robot that holds an M5Stack Core on two SG90 servos, with a snap-together bracket and a battery. Printed case parts only; the M5Stack, board, servos and battery are bought separately.', printedParts, assembly, boughtParts, credit, approximate, assemblyData };
