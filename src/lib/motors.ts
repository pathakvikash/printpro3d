// Curated motor data. Every number below was read from the cited page/datasheet; nothing is invented.
// Figures are typical, +/-10-20% (datasheets say so themselves); not certified.

export type Src = { label: string; url: string; kind: 'manufacturer-claimed' | 'independent bench'; note: string };
export type PropPoint = { throttle: number; rpm: number; thrustG: number; amps: number; watts: number };
export type PropRun = { volts: number; label: string; points: PropPoint[] };
export type GearRun = { volts: number; noLoadRpm: number; noLoadA: number; stallA: number; stallKgCm: number };
type Base = { id: string; name: string; source: Src };
export type PropMotor = Base & { kind: 'prop'; prop: string; basis: 'measured'; runs: PropRun[] };
export type GearMotor = Base & { kind: 'gear'; basis: 'model'; runs: GearRun[] };
export type Motor = PropMotor | GearMotor;

// MQTB reads 100% from the "avg max" columns; volts are supply sag under load (15.39 V at 100%, 16.09 V at 25%).
const MQTB: Src = {
  label: 'Mini Quad Test Bench, GEPRC SpeedX GR2306 2450kv',
  url: 'https://www.miniquadtestbench.com/assets/components/motordata/motorinfo.php?uid=261',
  kind: 'independent bench',
  note: 'Bench run by a reviewer, not the maker. Tested KV 2430. 60 A supply, voltage sags from about 16.1 V to 15.4 V.',
};
const ADAFRUIT: Src = {
  label: 'Adafruit product 3777, TT Motor 1:48',
  url: 'https://www.adafruit.com/product/3777',
  kind: 'manufacturer-claimed',
  note: 'No-load rpm/current and stall current are Adafruit bench numbers; stall torque is listed at 3 V and 6 V only.',
};
const POLOLU: Src = {
  label: 'Pololu micro metal gearmotor datasheet',
  url: 'https://www.pololu.com/file/0J1487/pololu-micro-metal-gearmotors.pdf',
  kind: 'manufacturer-claimed',
  note: 'No-load speed +/-20%, no-load current +/-50%. Stall values are theoretical extrapolations; real motors stall earlier and overheat.',
};

export const MOTORS: Motor[] = [
  {
    id: 'gr2306-buttercutter', kind: 'prop', basis: 'measured', name: 'GEPRC SpeedX GR2306 2450KV', prop: 'Lumenier Buttercutter 5x5x3',
    source: MQTB,
    runs: [{
      volts: 16, label: '4S bench (about 16 V, sags under load)',
      points: [
        { throttle: 25, rpm: 10911, thrustG: 181, amps: 3.0, watts: 48 },
        { throttle: 50, rpm: 18483, thrustG: 558, amps: 10.38, watts: 166 },
        { throttle: 75, rpm: 25032, thrustG: 1072, amps: 24.65, watts: 388 },
        { throttle: 100, rpm: 30284, thrustG: 1611, amps: 46.39, watts: 714 },
      ],
    }],
  },
  {
    id: 'adafruit-tt-48', kind: 'gear', basis: 'model', name: 'Adafruit TT motor 1:48', source: ADAFRUIT,
    runs: [
      { volts: 3, noLoadRpm: 120, noLoadA: 0.15, stallA: 1.1, stallKgCm: 0.4 },
      { volts: 6, noLoadRpm: 250, noLoadA: 0.16, stallA: 1.5, stallKgCm: 0.8 },
    ],
  },
  {
    id: 'pololu-n20-hp-50', kind: 'gear', basis: 'model', name: 'Pololu micro metal (N20) HP 6V, 50:1', source: POLOLU,
    runs: [{ volts: 6, noLoadRpm: 590, noLoadA: 0.1, stallA: 1.6, stallKgCm: 0.86 }],
  },
  {
    id: 'pololu-n20-lp-50', kind: 'gear', basis: 'model', name: 'Pololu micro metal (N20) LP 6V, 50:1', source: POLOLU,
    runs: [{ volts: 6, noLoadRpm: 270, noLoadA: 0.04, stallA: 0.36, stallKgCm: 0.44 }],
  },
];

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const power = (volts: number, amps: number) => volts * amps;
export const gramsPerWatt = (thrustG: number, watts: number) => (watts > 0 ? thrustG / watts : 0);

/** Piecewise-linear interpolation; clamped to the end values outside xs (xs ascending). */
export function interp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
  }
  return ys[ys.length - 1];
}

/** Least-squares k in thrust = k * rpm^2 (through the origin). Needs 3+ points, else NaN: never guess. */
export function fitK(points: PropPoint[]): number {
  if (points.length < 3) return NaN;
  let num = 0, den = 0;
  for (const p of points) { num += p.thrustG * p.rpm ** 2; den += p.rpm ** 4; }
  return num / den;
}

export type PropState = { rpm: number; thrustG: number; amps: number; watts: number; gPerW: number; basis: 'measured' | 'model' };

/** Inside the tested throttle range: interpolate the points. Below it: thrust = k rpm^2, power ~ rpm^3 (model). */
export function propAt(run: PropRun, throttlePct: number): PropState {
  const t = clamp(throttlePct, 0, 100);
  const pts = run.points, first = pts[0];
  if (t < first.throttle) {
    const rpm = first.rpm * (t / first.throttle);
    const r = first.rpm ? rpm / first.rpm : 0;
    const watts = first.watts * r ** 3;
    const thrustG = fitK(pts) * rpm ** 2;
    return { rpm, thrustG, amps: watts / (first.watts / first.amps), watts, gPerW: gramsPerWatt(thrustG, watts), basis: 'model' };
  }
  const xs = pts.map((p) => p.throttle);
  const f = (k: keyof PropPoint) => interp(xs, pts.map((p) => p[k]), t);
  const thrustG = f('thrustG'), watts = f('watts');
  return { rpm: f('rpm'), thrustG, amps: f('amps'), watts, gPerW: gramsPerWatt(thrustG, watts), basis: 'measured' };
}

export type GearState = { rpm: number; torqueKgCm: number; amps: number; watts: number; mechW: number; effPct: number; stalled: boolean };

/**
 * Linear DC-motor model. Throttle = PWM duty (effective volts = V*t, no-load rpm and stall torque/current scale with t).
 * load = fraction of the full-voltage stall torque the wheel needs.
 */
export function gearAt(run: GearRun, throttlePct: number, load: number): GearState {
  const t = clamp(throttlePct, 0, 100) / 100;
  const tau = clamp(load, 0, 1) * run.stallKgCm;
  const tauStall = run.stallKgCm * t;
  const stalled = t > 0 && tau >= tauStall;
  const frac = t === 0 ? 0 : stalled ? 1 : tau / tauStall;
  const rpm = stalled ? 0 : run.noLoadRpm * t * (1 - frac);
  const amps = t * (run.noLoadA + (run.stallA - run.noLoadA) * frac);
  const watts = power(run.volts * t, amps);
  const torque = t === 0 ? 0 : stalled ? tauStall : tau;
  const mechW = torque * 0.0980665 * ((rpm * 2 * Math.PI) / 60);
  return { rpm, torqueKgCm: torque, amps, watts, mechW, effPct: watts > 0 ? (mechW / watts) * 100 : 0, stalled };
}

/** Thrust-to-weight for a multi-motor craft: motors * thrust per motor / all-up weight, both in grams. */
export const thrustToWeight = (thrustG: number, motors: number, auwG: number) => (auwG > 0 ? (thrustG * motors) / auwG : 0);
