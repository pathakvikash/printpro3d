// "Pairs well with" and "you will also need" for a shop product. Pure rules; ids that do not exist in the shop are skipped,
// so parts added later show up here without a change. Motor figures are copied from motors.ts, never restated.
import { CATALOG, shopCat } from './catalog.ts';
import { TEMPLATES } from './templateDefs.ts';
import { MOTORS, type Motor } from './motors.ts';

export type BoughtPart = { name: string; spec: string; why: string };
export type Recommendation = { pairsWith: string[]; boughtParts: BoughtPart[] };

const exists = (id: string) => !!shopCat(id) && (CATALOG.some((x) => x.id === id) || TEMPLATES.some((x) => x.id === id));

const DRONE = ['drone-camera-mount', 'prop-guard', 'landing-gear', 'battery-tray', 'gps-antenna-mount'];
const PAIRS: Record<string, string[]> = {
  'drone-plate': DRONE,
  'fpv-3in-kit': DRONE,
  'drone-camera-mount': ['drone-plate', 'fpv-3in-kit', 'gps-antenna-mount'],
  'gps-antenna-mount': ['drone-plate', 'fpv-3in-kit', 'drone-camera-mount'],
  'prop-guard': ['drone-plate', 'fpv-3in-kit', 'landing-gear'],
  'landing-gear': ['drone-plate', 'fpv-3in-kit', 'prop-guard'],
  'battery-tray': ['drone-plate', 'fpv-3in-kit', 'drone-camera-mount'],
  'motor-mount': ['motor-wheel', 'robot-chassis', 'wheel-hub'],
  'motor-wheel': ['motor-mount', 'robot-chassis', 'wheel-hub'],
  'wheel-hub': ['motor-mount', 'motor-wheel', 'robot-chassis'],
  'robot-chassis': ['motor-mount', 'motor-wheel', 'robot-gripper', 'battery-tray'],
  'rover-kit': ['motor-wheel', 'wheel-hub', 'rc-bumper', 'battery-tray'],
  'rc-bumper': ['rover-kit', 'robot-chassis'],
  'robot-gripper': ['servo-bracket', 'robot-chassis'],
  'servo-bracket': ['robot-gripper', 'robot-chassis'],
};

const motorPart = (m: Motor, why: string): BoughtPart => ({
  name: m.name,
  spec: m.kind === 'prop'
    ? `${m.prop}; ${m.runs[0].label}. ${m.source.kind}: ${m.source.label}`
    : `${m.runs.map((r) => `${r.volts} V: ${r.noLoadRpm} rpm no-load, ${r.stallKgCm} kg-cm stall`).join('; ')}. ${m.source.kind}: ${m.source.label}`,
  why,
});
const typical = (name: string, spec: string, why: string): BoughtPart => ({ name, spec: `Typical: ${spec}`, why });

const PROP_IDS = new Set(['drone-plate', 'fpv-3in-kit', 'drone-camera-mount', 'gps-antenna-mount', 'prop-guard', 'landing-gear', 'battery-tray']);
const GEAR_IDS = new Set(['motor-mount', 'motor-wheel', 'wheel-hub', 'robot-chassis', 'rover-kit']);
const SERVO_IDS = new Set(['robot-gripper', 'servo-bracket']);
const BATTERY_IDS = new Set([...PROP_IDS, 'robot-chassis', 'rover-kit']);

export function recommendFor(productId: string): Recommendation {
  if (!exists(productId)) return { pairsWith: [], boughtParts: [] };
  const parts: BoughtPart[] = [];
  if (productId === 'drone-plate' || productId === 'fpv-3in-kit') {
    for (const m of MOTORS) if (m.kind === 'prop') parts.push(motorPart(m, 'Four motors turn the props; the frame has a mount for each.'));
  }
  if (GEAR_IDS.has(productId)) {
    for (const m of MOTORS) if (m.kind === 'gear') parts.push(motorPart(m, 'A geared motor drives the wheel; this part holds it.'));
  }
  if (SERVO_IDS.has(productId)) parts.push(typical('Hobby servo', 'a micro or standard hobby servo, sized to the bracket', 'Moves the printed part; check the servo body against the drawing before ordering.'));
  if (BATTERY_IDS.has(productId)) parts.push(typical('Battery', 'a LiPo or battery holder matched to the motor voltage', 'Powers the motors and electronics; this shop does not sell it.'));
  return { pairsWith: (PAIRS[productId] ?? []).filter((id) => id !== productId && exists(id)), boughtParts: parts };
}
