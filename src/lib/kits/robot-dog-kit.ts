// Quadruped robot dog by KDY0523 (CC BY), Arduino Mega + MG995/MG996R variant. Leg part quantities (x4 legs, L/R pairs x2) follow the twelve-servo, three-per-leg design. Printed parts are the unmodified upstream STLs; prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/robot-dog/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3, qty = 1): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty, size });
export const printedParts: Printed[] = [
  pp('top-cover', 'Top cover', 'T_cover_mg.stl', [180, 34.5, 114], 1),
  pp('back-cover', 'Back cover', 'B_cover_mg.stl', [180, 42.5, 114], 1),
  pp('front-cover', 'Front cover', 'F_cover.stl', [92.8, 114, 70], 1),
  pp('rear-cover', 'Rear cover', 'R_cover.stl', [70, 114, 69.8], 1),
  pp('plate', 'Arduino Mega plate', 'plate.stl', [107, 7, 95], 1),
  pp('side-plate-l', 'Side plate (left)', 'L_side_plate.stl', [6.5, 130, 29], 1),
  pp('side-plate-r', 'Side plate (right)', 'R_side_plate.stl', [6.5, 130, 29], 1),
  pp('shoulder-inner', 'Inner shoulder', 'I_shoulder_mg.stl', [110, 51, 70], 4),
  pp('shoulder-outer', 'Outer shoulder', 'O_shoulder.stl', [110, 5, 66], 4),
  pp('arm-l', 'Leg arm (left)', 'L_arm_mg.stl', [38.2, 39.8, 137.4], 2),
  pp('arm-r', 'Upper leg (right)', 'R_arm_mg.stl', [38.2, 39.8, 137.4], 2),
  pp('arm-cover-l', 'Leg arm cover (left)', 'L_arm_cover.stl', [41.2, 45, 143.5], 2),
  pp('arm-cover-r', 'Upper leg cover (right)', 'R_arm_cover.stl', [41.2, 45, 143.5], 2),
  pp('arm-joint-l', 'Leg arm joint (left)', 'L_arm_joint_mg.stl', [37.5, 46, 56.5], 2),
  pp('arm-joint-r', 'Knee joint (right)', 'R_arm_joint_mg.stl', [37.5, 46, 56.5], 2),
  pp('wrist-l', 'Leg wrist (left)', 'L_wrist_mg.stl', [150, 36.9, 30], 2),
  pp('wrist-r', 'Lower leg (right)', 'R_wrist_mg.stl', [150, 36.9, 30], 2),
  pp('foot', 'Foot', 'foot.stl', [38.3, 20, 19.4], 4),
  pp('ultrasonic-l', 'Ultrasonic sensor mount (left)', 'L_ultra_sonic.stl', [38.6, 19.5, 46.2], 1),
  pp('ultrasonic-r', 'Ultrasonic sensor mount (right)', 'R_ultra_sonic.stl', [38.6, 19.5, 46.2], 1),
];

// From the upstream description; no prices here.
export const boughtParts = [
  { name: 'MG996R servo', spec: 'MG995 also fits', qty: 12, typical: 'electronics store' },
  { name: 'Arduino Mega', spec: '', qty: 1, typical: 'electronics store' },
  { name: 'HC-SR04 ultrasonic sensor', spec: '', qty: 2, typical: 'electronics store' },
  { name: 'HC-06 Bluetooth module', spec: '', qty: 1, typical: 'electronics store' },
  { name: 'MPU-6050 gyro sensor', spec: '', qty: 1, typical: 'electronics store' },
  { name: 'I2C 16x2 LCD module', spec: '', qty: 1, typical: 'electronics store' },
  { name: 'Rocker switch', spec: 'RL3-4', qty: 1, typical: 'electronics store' },
  { name: 'Battery', spec: '7.4 V', qty: 1, typical: 'electronics store' },
  { name: 'Screws and nuts', spec: '8 x M5x15, 40 x M4x20, 8 x M4x15, 48 M4 nuts, 4 x M3x20, 28 x M3x10, 16 M3 nuts', qty: 1, typical: 'hardware store' },
  { name: 'Flange ball bearing', spec: 'F625zz', qty: 8, typical: 'electronics store' },
];

// View-only picture(s) of the finished product (never priced or added to the cart); see CREDITS.md.
export const finished = { photos: [{ src: '/models/kits/robot-dog/finished-1.webp', alt: 'Quadruped robot dog, assembled (design render)' }, { src: '/models/kits/robot-dog/finished-2.webp', alt: 'Quadruped robot dog, side view (design render)' }] };
export const credit = { author: 'KDY0523', url: 'https://www.thingiverse.com/thing:3445283', licence: 'CC BY' };

// ponytail: upstream ships loose printable files and no assembly data, so the layout is a plain grid, not the real fit.
export const approximate = true;
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  return printedParts.map((p, i) => ({ id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position: [(i % 5) * 150, Math.floor(i / 5) * 130, p.size[2] / 2] as V3, rotation: [0, 0, 0] as V3, explode: [0, 0, 0] as V3 }));
}

export const robotDogKit = { id: 'robot-dog', title: 'Quadruped robot dog kit', category: 'robot', blurb: 'Open-source quadruped robot dog with twelve MG996R servos (three per leg) controlled by an Arduino Mega, with two ultrasonic sensors, a Bluetooth module, a gyro sensor and a small LCD. Prints the MG995/MG996R servo version for the Arduino Mega plate. Upstream note: attach servo horns to the printed parts with hot glue. No firmware is included. Electronics, servos, battery and hardware are bought separately.', printedParts, assembly, boughtParts, credit, finished, approximate, assemblyData };
