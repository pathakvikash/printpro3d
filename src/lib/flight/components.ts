// Motor and mass-component types, strict parsing of untrusted JSON, and the quad-X layout helper.
import { MOTORS } from '../motors.ts';
import type { Vec3 } from './mass.ts';

export const MAX_MOTORS = 8, MAX_COMPONENTS = 12, MAX_POS_MM = 1000, MAX_MASS_G = 5000;
/** Frame: x right, y forward, z up, origin anywhere (trim works about the CG). */
export type Motor = { id: string; pos: Vec3; spin: 'cw' | 'ccw'; motorId: string };
export type MassComponent = { id: string; name: string; massG: number | null; pos: Vec3 };

const TYPICAL: [RegExp, number][] = [
  [/battery|lipo/i, 160], [/flight ?controller|\bfc\b/i, 8], [/\besc\b/i, 15], [/receiver|\brx\b/i, 3], [/camera/i, 20], [/vtx|transmitter/i, 8],
];
/** Rough typical mass for a part name. ALWAYS an estimate: weigh the real part. null when the name is unknown. */
export function typicalMass(name: string): { massG: number; estimate: true; note: string } | null {
  const t = TYPICAL.find(([re]) => re.test(name));
  return t ? { massG: t[1], estimate: true, note: `ESTIMATE: typical ${name}, real parts vary widely; weigh yours` } : null;
}

/**
 * Quad-X, props-in: front-right and rear-left spin CCW, front-left and rear-right spin CW (viewed from above).
 * mirror=true flips every spin (props-out). x/y are the motor offsets from the centre in mm.
 */
export function quadX(xMm: number, yMm: number, motorId: string, mirror = false): Motor[] {
  const f = (s: 'cw' | 'ccw'): 'cw' | 'ccw' => (mirror ? (s === 'cw' ? 'ccw' : 'cw') : s);
  return [
    { id: 'fr', pos: [xMm, yMm, 0], spin: f('ccw'), motorId },
    { id: 'fl', pos: [-xMm, yMm, 0], spin: f('cw'), motorId },
    { id: 'rl', pos: [-xMm, -yMm, 0], spin: f('ccw'), motorId },
    { id: 'rr', pos: [xMm, -yMm, 0], spin: f('cw'), motorId },
  ];
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
function keys(o: Record<string, unknown>, allowed: string[], what: string) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new Error(`${what}: unknown key "${k}"`);
  for (const k of allowed) if (!(k in o)) throw new Error(`${what}: missing "${k}"`);
}
const num = (x: unknown, lo: number, hi: number, what: string) => {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < lo || x > hi) throw new Error(`${what} must be a number in ${lo}..${hi}`);
  return x;
};
const pos = (x: unknown, what: string): Vec3 => {
  if (!Array.isArray(x) || x.length !== 3) throw new Error(`${what} must be [x,y,z] in mm`);
  return x.map((v, i) => num(v, -MAX_POS_MM, MAX_POS_MM, `${what}[${i}]`)) as Vec3;
};
const id = (x: unknown, seen: Set<string>, what: string) => {
  if (typeof x !== 'string' || !x || x.length > 32) throw new Error(`${what}: id must be a non-empty string up to 32 chars`);
  if (seen.has(x)) throw new Error(`${what}: duplicate id "${x}"`);
  seen.add(x);
  return x;
};

/** Strict validation of untrusted {motors, components}. Throws Error with a readable message. */
export function parseComponents(raw: unknown): { motors: Motor[]; components: MassComponent[] } {
  if (!isObj(raw)) throw new Error('Expected an object');
  keys(raw, ['motors', 'components'], 'root');
  const { motors, components } = raw;
  if (!Array.isArray(motors) || motors.length < 1 || motors.length > MAX_MOTORS) throw new Error(`motors: 1-${MAX_MOTORS} required`);
  if (!Array.isArray(components) || components.length > MAX_COMPONENTS) throw new Error(`components: at most ${MAX_COMPONENTS}`);
  const mi = new Set<string>(), ci = new Set<string>();
  return {
    motors: motors.map((m, i): Motor => {
      const w = `motors[${i}]`;
      if (!isObj(m)) throw new Error(`${w} must be an object`);
      keys(m, ['id', 'pos', 'spin', 'motorId'], w);
      if (m.spin !== 'cw' && m.spin !== 'ccw') throw new Error(`${w}.spin must be "cw" or "ccw"`);
      if (typeof m.motorId !== 'string' || !MOTORS.some((x) => x.id === m.motorId && x.kind === 'prop')) throw new Error(`${w}.motorId is not a known propeller motor`);
      return { id: id(m.id, mi, w), pos: pos(m.pos, `${w}.pos`), spin: m.spin, motorId: m.motorId };
    }),
    components: components.map((c, i): MassComponent => {
      const w = `components[${i}]`;
      if (!isObj(c)) throw new Error(`${w} must be an object`);
      keys(c, ['id', 'name', 'massG', 'pos'], w);
      if (typeof c.name !== 'string' || !c.name || c.name.length > 60) throw new Error(`${w}.name must be 1-60 characters`);
      return { id: id(c.id, ci, w), name: c.name, massG: c.massG === null ? null : num(c.massG, 0, MAX_MASS_G, `${w}.massG`), pos: pos(c.pos, `${w}.pos`) };
    }),
  };
}
