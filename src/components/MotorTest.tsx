'use client';

import { useState } from 'react';
import Icon from './Icon';
import { MOTORS, fitK, gearAt, propAt, thrustToWeight, type GearMotor, type GearRun, type PropMotor, type PropRun } from '@/lib/motors';

const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 sm:p-5';
const input = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white';
const lbl = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const f = (n: number, d = 0) => n.toFixed(d);

function Chip({ tone, children }: { tone: 'warn' | 'ok'; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${tone === 'warn' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200'}`}>
      <Icon name={tone === 'warn' ? 'bolt' : 'check'} className="h-3.5 w-3.5" />{children}
    </span>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-3">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white tabular-nums">{value} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{unit}</span></dd>
    </div>
  );
}

/** Spinning rotor + thrust arrow. Spin is visual only (capped rate); motion-safe: keeps it still for reduced-motion users. */
function Rotor({ gear, frac, level }: { gear: boolean; frac: number; level: number }) {
  const rps = (gear ? 2 : 5) * frac;
  const arrow = 6 + 54 * level;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={gear ? 'Spinning wheel' : 'Spinning propeller and thrust arrow'} className="mx-auto h-52 w-52 text-gray-800 dark:text-gray-200">
      <g className={rps > 0 ? 'motion-safe:animate-spin' : ''} style={{ transformOrigin: '100px 130px', transformBox: 'view-box', animationDuration: rps > 0 ? `${1 / rps}s` : undefined }}>
        {gear ? (
          <>
            <circle cx="100" cy="130" r="56" fill="none" stroke="currentColor" strokeWidth="10" />
            {[0, 60, 120].map((a) => <line key={a} x1="100" y1="130" x2="100" y2="74" stroke="currentColor" strokeWidth="4" transform={`rotate(${a} 100 130)`} />)}
            <line x1="100" y1="130" x2="100" y2="190" stroke="currentColor" strokeWidth="4" />
            <line x1="44" y1="130" x2="156" y2="130" stroke="currentColor" strokeWidth="4" />
          </>
        ) : (
          [0, 120, 240].map((a) => <ellipse key={a} cx="100" cy="86" rx="9" ry="42" fill="currentColor" opacity=".8" transform={`rotate(${a} 100 130)`} />)
        )}
      </g>
      <circle cx="100" cy="130" r="8" className="fill-blue-600" />
      {!gear && (
        <g className="text-blue-600" aria-hidden="true">
          <line x1="100" y1="64" x2="100" y2={64 - arrow + 6} stroke="currentColor" strokeWidth="6" />
          <path d={`M88 ${64 - arrow + 14} L100 ${64 - arrow} L112 ${64 - arrow + 14}z`} fill="currentColor" />
        </g>
      )}
    </svg>
  );
}

/** Thrust (props) or rpm vs torque (gear) chart. Solid dots = measured points, dashed line = model. */
function Chart({ motor, run, marker }: { motor: PropMotor | GearMotor; run: PropRun | GearRun; marker: { x: number; y: number } }) {
  const W = 320, H = 170, L = 38, B = 28;
  let xMax: number, yMax: number, xLab: string, yLab: string;
  let line: [number, number][] = [], dots: [number, number][] = [];
  if (motor.kind === 'prop') {
    const r = run as PropRun, k = fitK(r.points);
    xMax = 100; yMax = Math.ceil(r.points[r.points.length - 1].thrustG / 200) * 200; xLab = 'throttle %'; yLab = 'thrust g';
    dots = r.points.map((p) => [p.throttle, p.thrustG]);
    line = Array.from({ length: 21 }, (_, i) => [i * 5, k * propAt(r, i * 5).rpm ** 2] as [number, number]);
  } else {
    const r = run as GearRun;
    xMax = r.stallKgCm; yMax = r.noLoadRpm; xLab = 'torque kg·cm'; yLab = 'rpm';
    line = [[0, r.noLoadRpm], [r.stallKgCm, 0]];
    dots = [[0, r.noLoadRpm]];
  }
  const sx = (x: number) => L + (x / xMax) * (W - L - 8), sy = (y: number) => H - B - (y / yMax) * (H - B - 8);
  const path = line.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x)} ${sy(y)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLab} against ${xLab}`} className="w-full text-gray-500 dark:text-gray-400">
        <line x1={L} y1={H - B} x2={W - 8} y2={H - B} stroke="currentColor" /><line x1={L} y1="8" x2={L} y2={H - B} stroke="currentColor" />
        <path d={path} fill="none" strokeWidth="2" strokeDasharray="5 4" className="stroke-blue-500" />
        {dots.map(([x, y]) => <circle key={x} cx={sx(x)} cy={sy(y)} r="4" className="fill-gray-900 dark:fill-white" />)}
        <circle cx={sx(marker.x)} cy={sy(marker.y)} r="5" className="fill-none stroke-amber-500" strokeWidth="2" />
        <text x={L} y={H - 8} fontSize="10" fill="currentColor">0</text>
        <text x={W - 8} y={H - 8} fontSize="10" textAnchor="end" fill="currentColor">{f(xMax, motor.kind === 'prop' ? 0 : 1)} {xLab}</text>
        <text x={L - 4} y="16" fontSize="10" textAnchor="end" fill="currentColor">{f(yMax)}</text>
        <text x={L + 4} y="14" fontSize="10" fill="currentColor">{yLab}</text>
      </svg>
      <figcaption className="text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-900 dark:bg-white align-middle" /> {motor.kind === 'prop' ? 'measured points' : 'datasheet no-load point'}{' · '}
        <span className="inline-block w-4 border-t-2 border-dashed border-blue-500 align-middle" /> {motor.kind === 'prop' ? 'model: thrust = k × rpm²' : 'model: linear speed-torque line'}{' · '}
        <span className="inline-block h-2 w-2 rounded-full border-2 border-amber-500 align-middle" /> now
      </figcaption>
    </figure>
  );
}

export default function MotorTest() {
  const [id, setId] = useState(MOTORS[0].id);
  const [vi, setVi] = useState(0);
  const [throttle, setThrottle] = useState(50);
  const [auw, setAuw] = useState(600);
  const [limit, setLimit] = useState(45);
  const [load, setLoad] = useState(0.3);
  const motor = MOTORS.find((m) => m.id === id) ?? MOTORS[0];
  const run = motor.runs[Math.min(vi, motor.runs.length - 1)];
  const gear = motor.kind === 'gear';

  const p = motor.kind === 'prop' ? propAt(run as PropRun, throttle) : null;
  const g = motor.kind === 'gear' ? gearAt(run as GearRun, throttle, load) : null;
  const top = motor.kind === 'prop' ? (run as PropRun).points.at(-1)! : null;
  const amps = p?.amps ?? g!.amps;
  const tw = p ? thrustToWeight(p.thrustG, 4, auw) : 0;
  const frac = p ? p.rpm / top!.rpm : g!.rpm / (motor as GearMotor).runs.reduce((m, r) => Math.max(m, r.noLoadRpm), 1);
  const level = p ? p.thrustG / top!.thrustG : 0;
  const warns: string[] = [];
  if (amps > limit) warns.push(`Current ${f(amps, 2)} A is over your ${limit} A limit`);
  if (p && throttle > 0 && tw < 2) warns.push(`Thrust-to-weight ${f(tw, 1)} is under 2 (4 motors, ${auw} g)`);
  if (g?.stalled) warns.push('Stalled: the motor cannot turn this load; a stalled motor draws its highest current and overheats');

  return (
    <div className="space-y-4">
      <div className={`${card} grid gap-4 sm:grid-cols-3`}>
        <div>
          <label htmlFor="mt-motor" className={lbl}>Motor</label>
          <select id="mt-motor" className={input} value={id} onChange={(e) => { setId(e.target.value); setVi(0); }}>
            {MOTORS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {motor.kind === 'prop' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Prop: {motor.prop}</p>}
        </div>
        <div>
          <label htmlFor="mt-volts" className={lbl}>Voltage</label>
          <select id="mt-volts" className={input} value={vi} onChange={(e) => setVi(Number(e.target.value))}>
            {motor.runs.map((r, i) => <option key={i} value={i}>{'label' in r ? r.label : `${r.volts} V`}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mt-limit" className={lbl}>{gear ? 'Supply current limit (A)' : 'ESC / battery limit per motor (A)'}</label>
          <input id="mt-limit" type="number" min={0.1} step={gear ? 0.1 : 1} className={input} value={limit} onChange={(e) => setLimit(Math.max(0, Number(e.target.value)))} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <Rotor gear={gear} frac={frac} level={level} />
          <label htmlFor="mt-throttle" className={`${lbl} mt-2`}>{gear ? 'Duty (PWM)' : 'Throttle'}: {throttle}%</label>
          <input id="mt-throttle" type="range" min={0} max={100} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} className="w-full accent-blue-600" />
          {p && (
            <div className="mt-3">
              <label htmlFor="mt-auw" className={lbl}>Drone all-up weight (g), 4 motors</label>
              <input id="mt-auw" type="number" min={1} className={input} value={auw} onChange={(e) => setAuw(Math.max(0, Number(e.target.value)))} />
            </div>
          )}
          {g && (
            <div className="mt-3">
              <label htmlFor="mt-load" className={lbl}>Load: {Math.round(load * 100)}% of stall torque</label>
              <input id="mt-load" type="range" min={0} max={100} value={load * 100} onChange={(e) => setLoad(Number(e.target.value) / 100)} className="w-full accent-blue-600" />
            </div>
          )}
        </div>

        <div className={`${card} space-y-4`}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-live="polite">
            <Stat label="Speed" value={f(p?.rpm ?? g!.rpm)} unit="rpm" />
            {p ? <Stat label="Thrust" value={f(p.thrustG)} unit="g" /> : <Stat label="Torque" value={f(g!.torqueKgCm, 2)} unit="kg·cm" />}
            <Stat label="Current" value={f(amps, 2)} unit="A" />
            <Stat label="Power" value={f(p?.watts ?? g!.watts, 1)} unit="W" />
            {p ? <Stat label="Efficiency" value={f(p.gPerW, 2)} unit="g/W" /> : <Stat label="Efficiency" value={f(g!.effPct)} unit="%" />}
            {p && <Stat label="Thrust-to-weight" value={f(tw, 1)} unit=": 1" />}
          </dl>
          {p && p.basis === 'model' && <p className="text-xs text-gray-500 dark:text-gray-400">Below the tested range these values are model estimates (thrust = k × rpm²), not measurements.</p>}
          {g && <p className="text-xs text-gray-500 dark:text-gray-400">Model estimates, not measurements: a straight line between the datasheet no-load and stall points, with PWM duty treated as a lower voltage (a simplification).</p>}
          <div className="flex flex-wrap gap-2" role="status">
            {warns.map((w) => <Chip key={w} tone="warn">{w}</Chip>)}
            {!warns.length && <Chip tone="ok">No warnings at these settings</Chip>}
          </div>
          <Chart motor={motor} run={run} marker={p ? { x: throttle, y: p.thrustG } : { x: g!.torqueKgCm, y: g!.rpm }} />
        </div>
      </div>

      <div className={`${card} text-sm text-gray-600 dark:text-gray-300 space-y-2`}>
        <p className="font-medium text-gray-900 dark:text-white">±10–20% typical; figures from the maker datasheets and one independent bench test cited below, not certified.</p>
        <p>Real results vary with motor KV tolerance, battery sag, prop batch and temperature. {gear ? 'Gear-motor curves are a straight line between the datasheet no-load and stall points; PWM duty is treated as a lower effective voltage.' : 'Between the tested throttle points values are interpolated.'} This is a selection aid, not a flight-time promise.</p>
        <h2 className="pt-1 font-semibold text-gray-900 dark:text-white">Sources</h2>
        <ul className="list-disc pl-5 space-y-1">
          {Array.from(new Map(MOTORS.map((m) => [m.source.url, m.source])).values()).map((s) => (
            <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">{s.label}</a> ({s.kind}). {s.note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
