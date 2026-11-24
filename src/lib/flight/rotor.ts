// Rotor model on top of the measured bench points in motors.ts. Thrust/current/rpm are interpolated from measurements
// inside the tested throttle range ('measured') and extrapolated by T ~ rpm^2 from the first point below it ('model').
// Torque uses an ASSUMED electrical-to-shaft efficiency; it only sets the yaw coefficient kappa = Q/T.
import { MOTORS, propAt, fitK, type PropMotor, type PropRun } from '../motors.ts';

export type Basis = 'measured' | 'model' | 'assumed';
export const RHO = 1.225; // kg/m3, sea level
export const G = 9.80665;
export const ETA_ASSUMED = 0.75; // ASSUMED: shaft power / electrical power. Not measured.
const N_PER_G = G / 1000;

export type Rotor = { motor: PropMotor; run: PropRun; dMm: number; ct: number };

/** Prop diameter in mm parsed from the catalog prop name ("Lumenier Buttercutter 5x5x3" -> 5 in). */
export function propDiameterMm(prop: string): number {
  const m = /(\d+(?:\.\d+)?)x\d/i.exec(prop);
  if (!m) throw new Error(`Cannot read prop diameter from "${prop}"`);
  return parseFloat(m[1]) * 25.4;
}

/** Ct from T = Ct rho n^2 D^4 (n in rev/s), calibrated by the least-squares k of the measured thrust vs rpm^2. */
export function makeRotor(motorId: string): Rotor {
  const motor = MOTORS.find((m) => m.id === motorId);
  if (!motor || motor.kind !== 'prop') throw new Error(`Unknown propeller motor "${motorId}"`);
  const run = motor.runs[0], dMm = propDiameterMm(motor.prop), D = dMm / 1000;
  const kN = fitK(run.points) * N_PER_G; // N per rpm^2
  return { motor, run, dMm, ct: (kN * 3600) / (RHO * D ** 4) };
}

/** Model thrust (N) from rpm: Ct rho n^2 D^4. */
export const thrustFromRpm = (r: Rotor, rpm: number) => r.ct * RHO * (rpm / 60) ** 2 * (r.dMm / 1000) ** 4;

export const thrustN = (r: Rotor, throttlePct: number) => { const s = propAt(r.run, throttlePct); return { value: s.thrustG * N_PER_G, basis: s.basis as Basis }; };
export const maxThrustN = (r: Rotor) => thrustN(r, 100).value;

/** Throttle (%) giving the requested thrust, by bisection (thrust is monotonic in throttle). Clamps at 0 / 100. */
export function throttleForThrust(r: Rotor, T: number): { throttlePct: number; saturated: 'low' | 'high' | null } {
  if (T <= 0) return { throttlePct: 0, saturated: 'low' };
  if (T >= maxThrustN(r)) return { throttlePct: 100, saturated: T > maxThrustN(r) ? 'high' : null };
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (thrustN(r, mid).value < T) lo = mid; else hi = mid; }
  return { throttlePct: (lo + hi) / 2, saturated: null };
}

export type Operating = {
  thrustN: number; throttlePct: number; rpm: number; amps: number; watts: number;
  torqueNm: number; kappaM: number; saturated: 'low' | 'high' | null;
  basis: { thrust: Basis; current: Basis; torque: 'assumed' };
};

/** Operating point for a requested thrust. Amps are the bench amps at the bench voltage (not rescaled to your battery). */
export function operating(r: Rotor, T: number): Operating {
  const { throttlePct, saturated } = throttleForThrust(r, T);
  const s = propAt(r.run, throttlePct);
  const omega = (s.rpm * 2 * Math.PI) / 60;
  const torqueNm = omega > 0 ? (ETA_ASSUMED * s.watts) / omega : 0;
  const t = s.thrustG * N_PER_G;
  return {
    thrustN: t, throttlePct, rpm: s.rpm, amps: s.amps, watts: s.watts, torqueNm, kappaM: t > 0 ? torqueNm / t : 0, saturated,
    basis: { thrust: s.basis, current: s.basis, torque: 'assumed' },
  };
}
