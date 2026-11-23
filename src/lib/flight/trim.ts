// Static hover trim of a multirotor. Allocation B (4 x n), columns [1, y_i, -x_i, -s_i kappa_i] about the CG, maps motor
// thrusts u (N) to [total thrust, Mx, My, Mz]. Hover: B u = [m g, 0, 0, 0]. Static only: no dynamics, no controller,
// no arm-stress numbers. s = +1 for CCW props (their reaction torque on the frame is clockwise, -z).
import { combine, pointBody, type Body, type Vec3 } from './mass.ts';
import { G, makeRotor, maxThrustN, operating, type Basis, type Operating, type Rotor } from './rotor.ts';
import type { MassComponent, Motor } from './components.ts';

export const TW_MIN = 2, CG_OFFSET_FRAC = 0.05, USABLE_BATTERY = 0.8;
export type Warning = { code: 'low-tw' | 'cg-offset' | 'infeasible' | 'spin-imbalance' | 'prop-overlap' | 'esc-current' | 'blank-mass' | 'no-mass'; message: string };
export type TrimInput = {
  motors: Motor[]; components: MassComponent[];
  frame?: Body; // printed frame (see mass.meshBody; its mass is an ESTIMATE at the quote fill factor)
  batteryAh?: number; escAmps?: number;
};
export type MotorTrim = { id: string; thrustN: number; maxThrustN: number; throttlePct: number; rpm: number; amps: number; op: Operating; withinLimits: boolean };
export type MotorOut = { id: string; holdsAll: boolean; yawHeld: boolean; residual: { thrustN: number; Mx: number; My: number; Mz: number }; note: string };
export type TrimResult = {
  massKg: number; cgMm: Vec3; motors: MotorTrim[]; residual: { thrustN: number; Mx: number; My: number; Mz: number }; feasible: boolean;
  thrustToWeight: number; hoverThrottlePct: number; hoverAmps: number; maxPayloadG: number; flightMin: number | null;
  motorOut: MotorOut[]; warnings: Warning[]; basis: { thrust: Basis; current: Basis; torque: 'assumed'; flightTime: 'assumed' };
};

/** Solve a small linear system by Gaussian elimination with partial pivoting. null if singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

/** Least squares B u = b: normal equations for n <= 4, minimum-norm for n > 4. A tiny ridge keeps rank-deficient B (e.g. all same spin) solvable. */
function lsq(B: number[][], b: number[]): number[] {
  const n = B[0].length, m = B.length, ridge = 1e-9;
  const col = (j: number) => B.map((r) => r[j]);
  if (n <= m) {
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => col(i).reduce((s, v, k) => s + v * B[k][j], 0) + (i === j ? ridge : 0)));
    return solve(A, B[0].map((_, j) => col(j).reduce((s, v, k) => s + v * b[k], 0))) ?? new Array(n).fill(0);
  }
  const A = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => B[i].reduce((s, v, k) => s + v * B[j][k], 0) + (i === j ? ridge : 0)));
  const y = solve(A, b) ?? new Array(m).fill(0);
  return B[0].map((_, j) => B.reduce((s, r, i) => s + r[j] * y[i], 0));
}

const resid = (B: number[][], u: number[], b: number[]) => { const r = B.map((row, i) => row.reduce((s, v, j) => s + v * u[j], 0) - b[i]); return { thrustN: r[0], Mx: r[1], My: r[2], Mz: r[3] }; };

export function trim(inp: TrimInput): TrimResult {
  const { motors, components } = inp;
  if (!motors.length) throw new Error('At least one motor is required');
  const warnings: Warning[] = [];
  const blanks = components.filter((c) => c.massG === null);
  if (blanks.length) warnings.push({ code: 'blank-mass', message: `Mass not filled in (counted as 0 g): ${blanks.map((c) => c.name).join(', ')}` });
  const bodies: Body[] = components.filter((c) => c.massG !== null).map((c) => pointBody(c.massG as number, c.pos));
  if (inp.frame) bodies.push(inp.frame);
  const tot = combine(bodies);
  if (!(tot.massKg > 0)) { warnings.push({ code: 'no-mass', message: 'Total mass is 0: add component masses' }); }
  const W = tot.massKg * G, n = motors.length;
  const rotors: Rotor[] = motors.map((m) => makeRotor(m.motorId));
  const rel = motors.map((m) => [(m.pos[0] - tot.cgMm[0]) / 1000, (m.pos[1] - tot.cgMm[1]) / 1000]);
  const nominal = rotors.map((r) => operating(r, W / n));
  const column = (i: number) => { const s = motors[i].spin === 'ccw' ? 1 : -1; return [1, rel[i][1], -rel[i][0], -s * nominal[i].kappaM]; };
  const cols = motors.map((_, i) => column(i));
  const Bof = (idx: number[]) => [0, 1, 2, 3].map((r) => idx.map((j) => cols[j][r]));
  const all = motors.map((_, i) => i), b = [W, 0, 0, 0];
  const B = Bof(all), u = lsq(B, b), residual = resid(B, u, b);

  const span = Math.max(0, ...motors.flatMap((a, i) => motors.slice(i + 1).map((c) => Math.hypot(a.pos[0] - c.pos[0], a.pos[1] - c.pos[1])))); // mm
  const spanM = Math.max(span / 1000, 1e-6);
  const tol = (r: { thrustN: number; Mx: number; My: number; Mz: number }) => Math.abs(r.thrustN) <= 1e-3 * Math.max(W, 1e-9) && Math.max(Math.abs(r.Mx), Math.abs(r.My)) <= 1e-3 * Math.max(W, 1e-9) * spanM && Math.abs(r.Mz) <= 1e-3 * Math.max(W, 1e-9) * spanM;

  const per: MotorTrim[] = motors.map((m, i) => {
    const ut = Math.max(u[i], 0), op = operating(rotors[i], ut), tmax = maxThrustN(rotors[i]);
    return { id: m.id, thrustN: u[i], maxThrustN: tmax, throttlePct: op.throttlePct, rpm: op.rpm, amps: op.amps, op, withinLimits: u[i] >= 0 && u[i] <= tmax };
  });
  const feasible = tol(residual) && per.every((p) => p.withinLimits);
  const sumMax = per.reduce((s, p) => s + p.maxThrustN, 0), tw = W > 0 ? sumMax / W : 0;
  const hoverAmps = per.reduce((s, p) => s + p.amps, 0);

  const motorOut: MotorOut[] = n < 2 ? [] : all.map((k) => {
    const rest = all.filter((j) => j !== k), Bk = Bof(rest), uk = lsq(Bk, b), r = resid(Bk, uk, b);
    const ok = tol(r) && uk.every((v, j) => v >= 0 && v <= per[rest[j]].maxThrustN);
    const yawHeld = Math.abs(r.Mz) <= 1e-3 * W * spanM;
    return {
      id: motors[k].id, holdsAll: ok, yawHeld, residual: r,
      note: ok ? 'Static solve balances thrust and moments with this motor out. This is NOT a claim the craft would recover: no dynamics or controller are modelled.'
        : `Cannot hold ${[Math.abs(r.thrustN) > 1e-3 * W && 'thrust', Math.abs(r.Mz) > 1e-3 * W * spanM && 'yaw', Math.max(Math.abs(r.Mx), Math.abs(r.My)) > 1e-3 * W * spanM && 'roll/pitch', uk.some((v, j) => v < 0 || v > per[rest[j]].maxThrustN) && 'motor limits'].filter(Boolean).join(', ')} with this motor out; the least-squares solve leaves the residual shown.`,
    };
  });

  if (tw < TW_MIN) warnings.push({ code: 'low-tw', message: `Thrust-to-weight ${tw.toFixed(2)} is below ${TW_MIN}` });
  const cx = motors.reduce((s, m) => s + m.pos[0], 0) / n, cy = motors.reduce((s, m) => s + m.pos[1], 0) / n;
  const off = Math.hypot(tot.cgMm[0] - cx, tot.cgMm[1] - cy);
  if (off > CG_OFFSET_FRAC * span) warnings.push({ code: 'cg-offset', message: `CG is ${off.toFixed(1)} mm from the motor centre, over ${CG_OFFSET_FRAC * 100}% of the ${span.toFixed(0)} mm motor span` });
  if (!feasible && W > 0) warnings.push({ code: 'infeasible', message: 'Hover trim infeasible: ' + (tol(residual) ? 'a motor needs negative thrust or more than its maximum' : 'thrust and moments cannot all be balanced') });
  const sSum = motors.reduce((s, m) => s + (m.spin === 'ccw' ? 1 : -1), 0);
  if (sSum !== 0) warnings.push({ code: 'spin-imbalance', message: `Spins are unbalanced (${sSum > 0 ? '+' : ''}${sSum} net CCW): the frame gets a net yaw torque` });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.hypot(motors[i].pos[0] - motors[j].pos[0], motors[i].pos[1] - motors[j].pos[1]), D = Math.max(rotors[i].dMm, rotors[j].dMm);
    if (d < D) warnings.push({ code: 'prop-overlap', message: `Props ${motors[i].id} and ${motors[j].id} overlap: ${d.toFixed(0)} mm apart, prop diameter ${D.toFixed(0)} mm` });
  }
  if (inp.escAmps !== undefined) for (const p of per) if (p.amps > inp.escAmps) warnings.push({ code: 'esc-current', message: `${p.id} draws ${p.amps.toFixed(1)} A at hover, over the ${inp.escAmps} A ESC rating` });

  return {
    massKg: tot.massKg, cgMm: tot.cgMm, motors: per, residual, feasible, thrustToWeight: tw,
    hoverThrottlePct: per.reduce((s, p) => s + p.throttlePct, 0) / n, hoverAmps,
    maxPayloadG: Math.max(0, (sumMax / (TW_MIN * G) - tot.massKg) * 1000),
    flightMin: inp.batteryAh && hoverAmps > 0 ? ((inp.batteryAh * USABLE_BATTERY) / hoverAmps) * 60 : null,
    motorOut, warnings, basis: { thrust: per.some((p) => p.op.basis.thrust === 'model') ? 'model' : 'measured', current: per.some((p) => p.op.basis.current === 'model') ? 'model' : 'measured', torque: 'assumed', flightTime: 'assumed' },
  };
}
