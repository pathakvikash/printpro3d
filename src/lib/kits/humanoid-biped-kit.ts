// Small biped humanoid kit by loguito (CC BY-SA). The servo axle bracket STL was repaired (a pinched edge separated, see CREDITS.md); derived file stays CC BY-SA. Prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/humanoid-biped/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3, qty = 1): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty, size });
export const printedParts: Printed[] = [
  pp('body-base', 'Body base plate', 'base_cuerpo-bujeros2.stl', [130, 120, 2], 1),
  pp('body-joint', 'Body joint', 'union_cuerpo.stl', [39, 8, 23], 1),
  pp('servo-bracket-u', 'U servo bracket', 'U_servos2.stl', [23, 60, 38.5], 1),
  pp('servo-axle-bracket', 'Servo axle bracket', 'servos_eje.stl', [52.3, 20.5, 37.8], 1),
  pp('hand', 'Hand', 'mano.stl', [36.1, 26.5, 77.6], 1),
  pp('foot', 'Hollow foot', 'pie_hueco.stl', [61, 92, 27.9], 1),
];

// From the upstream description; no prices here.
export const boughtParts = [
  { name: 'SG90 servo', spec: 'head; count per upstream documentation', qty: 1, typical: 'electronics store' },
  { name: 'MG995 servo', spec: 'legs; count per upstream documentation', qty: 1, typical: 'electronics store' },
  { name: 'S3003 servo', spec: 'arms; count per upstream documentation', qty: 1, typical: 'electronics store' },
  { name: 'Arduino Mega 2560', spec: '', qty: 1, typical: 'electronics store' },
];

// View-only picture(s) of the finished product (never priced or added to the cart); see CREDITS.md.
export const finished = { photos: [{ src: '/models/kits/humanoid-biped/finished-1.webp', alt: 'Hadron biped robot, fully assembled' }] };
export const credit = { author: 'loguito', url: 'https://www.thingiverse.com/thing:356398', licence: 'CC BY-SA' };

// ponytail: upstream ships loose printable files and no assembly data, so the layout is a plain grid, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [(i % 3) * 150, Math.floor(i / 3) * 130, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const humanoidBipedKit = { id: 'humanoid-biped', title: 'Small biped humanoid kit (Hadron)', category: 'robot', blurb: 'Printable biped robot with 17 degrees of freedom, built from a few repeated bracket parts plus a body plate, hands and hollow feet, for low-cost MG995 servos. Upstream also describes a four-legged build from the same parts. Uses SG90 servos for the head, MG995 for the legs, S3003 for the arms and one Arduino Mega 2560. Servos, Arduino and hardware are bought separately; the head design is a separate upstream download. Part counts are not stated upstream: we confirm how many of each bracket you need before printing.', printedParts, assembly, boughtParts, credit, finished, approximate, assemblyData };
