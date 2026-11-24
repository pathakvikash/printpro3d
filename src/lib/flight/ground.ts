// First-principles ground mode for a gear-motor vehicle. Linear DC torque-speed line from the motor's sourced no-load rpm and
// stall torque, the gearbox output driving the wheel directly. Force at the ground F(v) = N tau_s / r (1 - v / v0), v0 = omega0 r.
// Resistance = crr m g cos(slope) + m g sin(slope). Ignored: battery sag, gearbox losses, wheel/motor inertia, tyre slip, drag.
import { MOTORS, type GearMotor, type GearRun } from '../motors.ts';
import { TEMPLATES } from '../templateDefs.ts';
import { combine, pointBody, type Body } from './mass.ts';
import { G } from './rotor.ts';
import type { MassComponent } from './components.ts';

/** 1 kgf*cm in N*m (same factor as motors.gearAt). */
export const KGCM_TO_NM = 0.0980665;
/** ASSUMED, not measured: small plastic/TPU wheels on a hard flat floor. Real surfaces vary from about 0.01 to 0.1. */
export const CRR_ASSUMED = 0.03;
/** Wheel diameter (mm) default: the motor-wheel template's own default, so the model matches the part you can order. */
export const DEFAULT_WHEEL_MM = (() => {
  const f = TEMPLATES.find((t) => t.id === 'motor-wheel')?.fields.find((x) => x.key === 'd');
  return f && f.type === 'range' ? f.default : 65;
})();

export const gearMotor = (id: string): GearMotor | null => MOTORS.find((m): m is GearMotor => m.id === id && m.kind === 'gear') ?? null;
/** The sourced run with the highest supply voltage (the 6 V figures; the TT motor also lists 3 V). */
export const topRun = (m: GearMotor): GearRun => m.runs.reduce((a, b) => (b.volts > a.volts ? b : a));

export type GroundIn = { run: GearRun; motors: number; wheelMm: number; massKg: number; crr?: number };
export type GroundOut = {
  moves: boolean; topSpeedMs: number; noLoadMs: number; maxSlopeDeg: number; maxGradePct: number; t90S: number | null;
  stallForceN: number; rollingN: number; omegaTop: number;
};

export function groundAt({ run, motors, wheelMm, massKg, crr = CRR_ASSUMED }: GroundIn): GroundOut {
  if (!(motors >= 1) || !(wheelMm > 0) || !(massKg > 0) || !(crr >= 0) || !(run.noLoadRpm > 0) || !(run.stallKgCm > 0)) throw new Error('Ground mode needs a motor, a wheel diameter, a mass above 0 and a rolling-resistance coefficient of 0 or more');
  const r = wheelMm / 2000, w0 = (run.noLoadRpm * 2 * Math.PI) / 60, v0 = w0 * r;
  const Fs = (motors * run.stallKgCm * KGCM_TO_NM) / r, mg = massKg * G, R = crr * mg;
  const moves = Fs > R;
  if (!moves) return { moves, topSpeedMs: 0, noLoadMs: v0, maxSlopeDeg: 0, maxGradePct: 0, t90S: null, stallForceN: Fs, rollingN: R, omegaTop: 0 };
  const vTop = v0 * (1 - R / Fs);
  const k = Fs / mg, A = Math.sqrt(1 + crr * crr); // sin(theta) + crr cos(theta) = k at stall, no slip
  const slope = k >= A ? 90 : (Math.asin(k / A) - Math.atan(crr)) * (180 / Math.PI);
  return {
    moves, topSpeedMs: vTop, noLoadMs: v0, maxSlopeDeg: slope, maxGradePct: slope >= 90 ? Infinity : Math.tan((slope * Math.PI) / 180) * 100,
    t90S: (Math.LN10 * massKg * v0) / Fs, // v = vTop (1 - exp(-t Fs / (m v0))), so 90% at ln(10) m v0 / Fs
    stallForceN: Fs, rollingN: R, omegaTop: vTop / r,
  };
}

/** Total mass (kg) from the same mass engine as the drone: typed component masses (blank = 0 g) plus the printed frame. */
export function groundMassKg(components: MassComponent[], frame?: Body | null): number {
  const bodies: Body[] = components.filter((c) => c.massG !== null).map((c) => pointBody(c.massG as number, c.pos));
  if (frame) bodies.push(frame);
  return combine(bodies).massKg;
}
