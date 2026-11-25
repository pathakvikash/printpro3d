// SO-101 6-axis robot arm (follower) by TheRobotStudio (Apache-2.0). Printed parts are the unmodified upstream STLs; prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/so101-arm/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty: 1, size });
export const printedParts: Printed[] = [
  pp('base', 'Base', 'Base_SO101.stl', [110.9, 72, 87]),
  pp('base-holder', 'Base motor holder', 'Base_motor_holder_SO101.stl', [47.6, 31.4, 80.2]),
  pp('holder-base', 'Motor holder (base)', 'Motor_holder_SO101_Base.stl', [28, 38.1, 55.1]),
  pp('holder-wrist', 'Motor holder (wrist)', 'Motor_holder_SO101_Wrist.stl', [28, 36.9, 56.4]),
  pp('under-arm', 'Under arm', 'Under_arm_SO101.stl', [130.7, 24, 64.4]),
  pp('upper-arm', 'Upper arm', 'Upper_arm_SO101.stl', [142.1, 24.5, 67.3]),
  pp('rotation-pitch', 'Rotation pitch', 'Rotation_Pitch_SO101.stl', [59.8, 84.2, 46]),
  pp('wrist-roll-pitch', 'Wrist roll pitch', 'Wrist_Roll_Pitch_SO101.stl', [62.3, 35.7, 77.8]),
  pp('wrist-roll', 'Wrist roll (follower)', 'Wrist_Roll_Follower_SO101.stl', [65.2, 52, 105.4]),
  pp('moving-jaw', 'Moving jaw', 'Moving_Jaw_SO101.stl', [22.3, 92, 48]),
  pp('waveshare-plate', 'Motor board mounting plate (Waveshare)', 'WaveShare_Mounting_Plate_SO101.stl', [51, 42, 7.6]),
];

// From the upstream "Parts for One Follower Arm" table; no prices here.
export const boughtParts = [
  { name: 'STS3215 servo', spec: '7.4 V, 1/345 gear (the 12 V version is an option with a 12 V supply)', qty: 6, typical: 'electronics store' },
  { name: 'Motor control board', spec: 'Waveshare serial bus servo driver board', qty: 1, typical: 'electronics store' },
  { name: 'USB-C cable', spec: 'data', qty: 1, typical: 'electronics store' },
  { name: 'Power supply', spec: '5 V (12 V with 12 V servos)', qty: 1, typical: 'electronics store' },
  { name: 'Table clamp', spec: 'to hold the base to the desk', qty: 2, typical: 'hardware store' },
];

export const credit = { author: 'TheRobotStudio', url: 'https://github.com/TheRobotStudio/SO-ARM100', licence: 'Apache-2.0' };

// ponytail: upstream ships one-plate files and no assembly data, so the layout is a plain grid, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [(i % 4) * 150, Math.floor(i / 4) * 130, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const so101ArmKit = { id: 'so101-arm', title: '6-axis robot arm kit (SO-101)', category: 'robot', blurb: 'Open-source 6-axis desktop robot arm driven by six STS3215 serial bus servos and a USB motor control board. Upstream print settings: PLA+, 0.2 mm layers, 15% infill, supports on. Servos, board and power supply are bought separately.', printedParts, assembly, boughtParts, credit, approximate, assemblyData };
