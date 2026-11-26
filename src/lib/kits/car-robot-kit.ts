// Car-to-robot toy kit by SlightlyAbnormal (CC BY). The single-part head STL was repaired (pinched edges separated) and the large rear body STL was reduced to about 110k triangles (see CREDITS.md). Prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/car-robot/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3, qty = 1): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty, size });
export const printedParts: Printed[] = [
  pp('rear-outer', 'Rear body (outer)', 'RearOuter.stl', [31.7, 18.6, 28.3], 1),
  pp('rear-bottom', 'Rear body (bottom)', 'RearBottom.stl', [31.6, 6.7, 24.1], 1),
  pp('windows', 'Interior windows', 'InterriorWindows.stl', [24.3, 16.7, 20.4], 1),
  pp('head', 'Head (single part)', 'SingleHead.stl', [16, 11.1, 6], 1),
  pp('arm-l', 'Arm (left)', 'LeftArm.stl', [15.8, 7.1, 30.2], 1),
  pp('arm-r', 'Arm (right)', 'RightArm.stl', [15.8, 7.1, 30.2], 1),
  pp('leg-l', 'Leg (left)', 'LeftLeg.stl', [9.2, 4.9, 32.6], 1),
  pp('leg-r', 'Leg (right)', 'RightLeg.stl', [9.2, 4.9, 32.6], 1),
  pp('foot-l', 'Foot (left)', 'LeftFoot.stl', [15.8, 14.8, 19.3], 1),
  pp('foot-r', 'Foot (right)', 'RightFoot.stl', [15.8, 14.8, 19.3], 1),
  pp('foot-bottom-l', 'Foot bottom (left)', 'LeftFootBot.stl', [7.8, 10.8, 15.7], 1),
  pp('foot-bottom-r', 'Foot bottom (right)', 'RightFootBot.stl', [7.8, 10.8, 15.7], 1),
  pp('front-wheel', 'Front wheel', 'FrontWheel.stl', [4, 10.3, 10.3], 1),
  pp('rear-wheel', 'Rear wheel', 'RearWheel.stl', [4, 13, 13], 1),
  pp('axle-pin', 'Axle pin', 'AxlePin.stl', [7.4, 3.5, 3.5], 1),
];

// From the upstream description; no prices here.
export const boughtParts = [

];

export const credit = { author: 'SlightlyAbnormal', url: 'https://www.thingiverse.com/thing:2463084', licence: 'CC BY' };

// ponytail: upstream ships loose printable files and no assembly data, so the layout is a plain grid, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [(i % 5) * 150, Math.floor(i / 5) * 130, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const carRobotKit = { id: 'car-robot', title: 'Car-to-robot toy kit', category: 'robot', blurb: 'Small printable toy car that folds out into a robot, in the style of 1980s micro-series toy racers: body, wheels, axle pin, interior windows, arms, legs and feet, plus a head printed as one part for single-extrusion printers. Upstream also offers a two-part head for dual extrusion; this kit lists the single head. No bought parts are listed upstream.', printedParts, assembly, boughtParts, credit, approximate, assemblyData };
