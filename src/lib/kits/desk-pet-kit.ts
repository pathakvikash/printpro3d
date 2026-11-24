// Sesame, an ESP32 desk quadruped by dorianborian (Apache-2.0). Printed parts are the unmodified upstream STLs; prices come from quote.ts on the real mesh.
import type { AssemblyPart, V3 } from '../assembly.ts';

const DIR = '/models/kits/desk-pet/';
type Printed = { id: string; label: string; file: string; material: 'PLA'; qty: number; size: V3 };
const pp = (id: string, label: string, file: string, size: V3): Printed => ({ id, label, file: DIR + file, material: 'PLA', qty: 1, size });
export const printedParts: Printed[] = [
  pp('frame', 'Internal frame', 'Internal-Frame-v121.stl', [79.2, 15.7, 68.1]),
  pp('bottom', 'Bottom cover', 'Bottom-Cover-v121.stl', [79.2, 7.3, 54.2]),
  pp('top', 'Top cover (no ears)', 'Top-Cover-No-Ears-v100.stl', [79.2, 33.7, 37.4]),
  pp('R1', 'Joint R1', 'R1-v117.stl', [20.3, 30.5, 49.5]),
  pp('R2', 'Joint R2', 'R2-v117.stl', [20.3, 30.5, 49.5]),
  pp('R3', 'Joint R3', 'R3-v117.stl', [9.5, 19, 58.4]),
  pp('R4', 'Joint R4', 'R4-v117.stl', [9.5, 19, 58.4]),
  pp('L1', 'Joint L1', 'L1-v117.stl', [20.3, 30.5, 49.5]),
  pp('L2', 'Joint L2', 'L2-v117.stl', [20.3, 30.5, 49.5]),
  pp('L3', 'Joint L3', 'L3-v117.stl', [9.5, 19, 58.4]),
  pp('L4', 'Joint L4', 'L4-v117.stl', [9.5, 19, 58.4]),
];

export const boughtParts = [
  { name: 'MG90S metal-gear micro servo', spec: '180 degree version (not 360 or continuous)', qty: 8, typical: 'hobby store' },
  { name: 'OLED display', spec: '0.96 inch SSD1306, 128x64, I2C', qty: 1, typical: 'electronics store' },
  { name: 'ESP32 board', spec: 'ESP32-S2 Mini, or Sesame distro board with ESP32', qty: 1, typical: 'electronics store' },
  { name: 'Buck converter', spec: '5 to 12 V in, 5 V 3 A out', qty: 1, typical: 'electronics store' },
  { name: 'Rocker switch', spec: 'KCD1 panel mount, 2 pin', qty: 1, typical: 'electronics store' },
  { name: 'Li-ion cell', spec: '14500 (recommended by the designer)', qty: 1, typical: 'electronics store' },
  { name: 'USB-C cable', spec: 'data, 5 V 3 A', qty: 1, typical: 'electronics store' },
  { name: 'Silicone wire', spec: '22 AWG and 30 AWG', qty: 1, typical: 'electronics store' },
  { name: 'Heat-shrink tubing and zip ties', spec: 'assorted, small', qty: 1, typical: 'hardware store' },
];

export const credit = { author: 'dorianborian', url: 'https://github.com/dorianborian/sesame-robot', licence: 'Apache-2.0' };

// ponytail: the upstream CAD is STEP only (not read), so every position is APPROXIMATE, not the real fit. Add real poses by exporting the STEP to per-part transforms.
export const approximate = true;
// No real assembly data (the upstream assembly is STEP only, not read): the shop shows the printed parts on a print plate, never an assembled robot.
export const assemblyData = false as const;
export function assembly(): AssemblyPart[] {
  const parts: AssemblyPart[] = printedParts.map((p) => {
    const leg = /^[LR]/.test(p.id);
    const sx = p.id.startsWith('R') ? 1 : -1;
    const lower = /3|4/.test(p.id);
    const sy = /[13]/.test(p.id) ? 1 : -1;
    const position: V3 = p.id === 'frame' ? [0, 0, 45] : p.id === 'bottom' ? [0, 0, 25] : p.id === 'top' ? [0, 0, 75]
      : [sx * 50, sy * 20, lower ? 28 : 45];
    const explode: V3 = leg ? [sx * 25, sy * 10, lower ? -25 : 0] : [0, 0, p.id === 'top' ? 45 : p.id === 'bottom' ? -35 : 0];
    return { id: p.id, label: p.label, geometry: p.file, material: p.material, size: p.size, position, rotation: [0, 0, 0] as V3, explode,
      ...(leg ? { joint: { axis: [1, 0, 0] as V3, pivot: [sx * 40, sy * 20, 55] as V3, min: -30, max: 30 } } : {}) };
  });
  for (let i = 0; i < 8; i++) {
    const sx = i < 4 ? 1 : -1, sy = i % 2 ? -1 : 1;
    parts.push({ id: `servo${i + 1}`, label: `MG90S servo ${i + 1}`, material: 'bought', size: [23, 12, 22], position: [sx * 35, sy * (i % 4 < 2 ? 15 : 28), 48], rotation: [0, 0, 0], explode: [sx * 15, sy * 15, 15], bought: true });
  }
  return parts;
}

export const deskPetKit = { id: 'desk-pet', title: 'Sesame desk pet', category: 'robot', blurb: 'ESP32 desk quadruped on eight MG90S servos, with an OLED face. Open hardware, PLA.', printedParts, assembly, boughtParts, credit, approximate, assemblyData };
