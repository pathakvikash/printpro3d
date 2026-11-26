// Pocket FPV drone kit by 3dxl (CC BY-SA). The frame and motor base STLs were repaired (open surfaces closed, see CREDITS.md); derived files stay CC BY-SA. Prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/pocket-drone/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3, qty = 1): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty, size });
export const printedParts: Printed[] = [
  pp('cover', 'Top cover', 'cover.stl', [37.2, 37.2, 0.9], 1),
  pp('frame', 'Main frame', 'frame.stl', [69.9, 69.9, 25.2], 1),
  pp('motor-base', 'Motor base cup', 'base_motor.stl', [10.9, 8.9, 8.2], 1),
];

// From the upstream description; no prices here.
export const boughtParts = [
  { name: 'Nano multirotor motors', spec: 'one per rotor', qty: 4, typical: 'electronics store' },
  { name: 'Flight controller board', spec: 'nano size', qty: 1, typical: 'electronics store' },
  { name: 'Video transmitter', spec: '', qty: 1, typical: 'electronics store' },
  { name: 'FPV camera', spec: '', qty: 1, typical: 'electronics store' },
];

export const credit = { author: '3dxl', url: 'https://www.thingiverse.com/thing:272234', licence: 'CC BY-SA' };

// ponytail: upstream ships loose printable files and no assembly data, so the layout is a plain grid, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [(i % 3) * 150, Math.floor(i / 3) * 130, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const pocketDroneKit = { id: 'pocket-drone', title: 'Pocket FPV drone kit (PIXXY)', category: 'robot', blurb: 'Palm-sized FPV quad that weighs about 40 g: a printed top cover, main frame and motor base cup that snap together with no screws or glue, ABS recommended. Nano-sized multirotor and FPV hardware is soldered in: motors, a flight controller board, a video transmitter and a camera. Motors, flight controller, video transmitter, camera and battery are bought separately.', printedParts, assembly, boughtParts, credit, approximate, assemblyData };
