'use client';

import { useMemo, useState } from 'react';
import { MOTORS } from '@/lib/motors';
import { G, makeRotor, maxThrustN, operating, type Basis } from '@/lib/flight/rotor';
import { trim, type TrimResult } from '@/lib/flight/trim';
import type { MassComponent, Motor } from '@/lib/flight/components';
import type { Body } from '@/lib/flight/mass';
import { CRR_ASSUMED, type GroundOut } from '@/lib/flight/ground';
import type { GearRun } from '@/lib/motors';

export const GROUND_ACCURACY = 'Indicative estimate, not a guarantee. Motor figures are the maker\'s own (about ±20%) at the stated voltage, with a straight-line torque-speed curve assumed. Rolling resistance is assumed. No battery sag, gearbox losses, tyre slip, drag or wheel and motor inertia, so real speed will be lower. Printed-part mass assumes uniform 40% fill; motors, wheels and wiring are not in the mass unless you add them as a Payload part.';
export type GroundView = { res: GroundOut | null; wheelMm: number; onWheelMm: (mm: number) => void; run: GearRun };

export const ACCURACY = 'Indicative estimate, not a flight guarantee. Thrust and current come from one independent bench test (±10–20%, about 16 V). Torque, response and battery sag are modelled with assumed values. No drag, ground effect or frame flex. Printed-part mass assumes uniform 40% fill; thin arms may weigh more.';

const Tag = ({ b }: { b: Basis }) => (
  <span className={`ml-1 rounded px-1 text-[10px] uppercase ${b === 'measured' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}`}>{b}</span>
);
const Chip = ({ children }: { children: React.ReactNode }) => (
  <li className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{children}</li>
);
const field = 'w-16 rounded border border-gray-300 bg-white px-1 py-0.5 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100';
const num = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) && v > 0 ? v : undefined; };
const f1 = (n: number) => n.toFixed(1);

export default function FlightHud({ motors, components, frame, frameMm, frameState, ground = null }: {
  ground?: GroundView | null; motors: Motor[]; components: MassComponent[]; frame: Body | null; frameMm: { x: number; y: number } | null; frameState: 'building' | 'ready';
}) {
  const [open, setOpen] = useState(true);
  const [mah, setMah] = useState('');
  const [cells, setCells] = useState('4');
  const [esc, setEsc] = useState('');
  const full = !ground && motors.length >= 3;

  const res = useMemo<{ t: TrimResult } | { err: string } | null>(() => {
    if (!full) return null;
    try { return { t: trim({ motors, components, frame: frame ?? undefined, batteryAh: num(mah) && num(mah)! / 1000, escAmps: num(esc) }) }; }
    catch (e) { return { err: e instanceof Error ? e.message : 'Could not solve' }; }
  }, [full, motors, components, frame, mah, esc]);
  const t = res && 't' in res ? res.t : null;

  const extra: string[] = [];
  if (frameMm) for (const m of motors) {
    const mo = MOTORS.find((x) => x.id === m.motorId);
    const d = mo && mo.kind === 'prop' ? makeRotor(m.motorId).dMm : 0;
    const msg = `The ${d.toFixed(0)} mm prop is larger than the ${frameMm.x.toFixed(0)} × ${frameMm.y.toFixed(0)} mm frame: this is a mount plate, not a flyable frame.`;
    if (d > Math.max(frameMm.x, frameMm.y) && !extra.includes(msg)) extra.push(msg);
  }
  if ((num(cells) ?? 4) !== 4) extra.push('Bench data is 4S (about 16 V); other cell counts are not modelled.');

  if (ground) return <GroundHud g={ground} n={motors.length} frameState={frameState} />;
  return (
    <div className="absolute left-2 top-2 z-10 max-h-[calc(100%-1rem)] w-[min(24rem,calc(100%-1rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white/95 p-3 text-xs text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between text-sm font-semibold">
        Simulation <span aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {!full && (
            <>
              <p className="text-amber-800 dark:text-amber-200">Bench numbers only: place at least 3 motors (or &lsquo;Make 4&rsquo;) to get weight, balance and hover.</p>
              <table className="w-full"><thead><tr className="text-left text-gray-500"><th>Motor</th><th>Max thrust</th><th>rpm</th><th>A</th></tr></thead><tbody>
                {motors.map((m) => { const r = makeRotor(m.motorId), o = operating(r, maxThrustN(r)); return (
                  <tr key={m.id}><td>{m.id}</td><td>{f1(o.thrustN / G * 1000)} g<Tag b={o.basis.thrust} /></td><td>{Math.round(o.rpm)}</td><td>{f1(o.amps)}</td></tr>
                ); })}
              </tbody></table>
            </>
          )}
          {res && 'err' in res && <p className="text-red-700 dark:text-red-300">{res.err}</p>}
          {t && (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <dt>All-up weight</dt><dd className="font-medium">{Math.round(t.massKg * 1000)} g{frameState === 'building' && ' (frame mass loading)'}</dd>
                <dd className="col-span-2 text-[11px] text-amber-800 dark:text-amber-200">Motors, props and wiring are not in this weight: add their total as a Payload part to count them.</dd>
                <dt>Thrust / weight</dt><dd className="font-medium">{t.thrustToWeight.toFixed(2)}</dd>
                <dt>Hover throttle <Tag b={t.basis.thrust} /></dt><dd className="font-medium">{f1(t.hoverThrottlePct)} %</dd>
                <dt>Hover current</dt><dd className="font-medium">{f1(t.hoverAmps)} A</dd>
                <dt>Flight time <Tag b="assumed" /></dt><dd className="font-medium">{t.flightMin === null ? 'enter capacity' : `${f1(t.flightMin)} min`}</dd>
                <dt>Max payload (T/W 2)</dt><dd className="font-medium">{Math.round(t.maxPayloadG)} g</dd>
                <dt>Motor-out margin</dt>
                <dd className="font-medium">{t.motorOut.filter((m) => m.holdsAll).length} of {t.motorOut.length} hold statically</dd>
              </dl>
              <table className="w-full"><thead><tr className="text-left text-gray-500"><th>Motor</th><th>Thr.</th><th>rpm</th><th>Thrust</th><th>A</th></tr></thead><tbody>
                {t.motors.map((m) => (
                  <tr key={m.id}><td>{m.id}</td><td>{f1(m.throttlePct)}%</td><td>{Math.round(m.rpm)}</td><td>{Math.round(m.thrustN / G * 1000)} g<Tag b={m.op.basis.thrust} /></td><td>{f1(m.amps)}</td></tr>
                ))}
              </tbody></table>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Motor out: {t.motorOut.map((m) => `${m.id} ${m.holdsAll ? 'holds' : 'fails'}`).join(', ')}. A static solve only, not a claim the craft would recover.</p>
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-0.5">Battery mAh<input className={field} inputMode="numeric" value={mah} onChange={(e) => setMah(e.target.value)} placeholder="e.g. 1300" /></label>
            <label className="flex flex-col gap-0.5">Cells (S)<input className={field} inputMode="numeric" value={cells} onChange={(e) => setCells(e.target.value)} /></label>
            <label className="flex flex-col gap-0.5">ESC rating A<input className={field} inputMode="numeric" value={esc} onChange={(e) => setEsc(e.target.value)} placeholder="optional" /></label>
          </div>
          {(t || extra.length > 0) && (
            <ul className="flex flex-wrap gap-1" aria-label="Warnings">
              {t?.warnings.map((w) => <Chip key={w.code + w.message}>{w.message}</Chip>)}
              {extra.map((m) => <Chip key={m}>{m}</Chip>)}
            </ul>
          )}
          <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{ACCURACY}</p>
        </div>
      )}
    </div>
  );
}

const box = 'absolute left-2 top-2 z-10 max-h-[calc(100%-1rem)] w-[min(24rem,calc(100%-1rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white/95 p-3 text-xs text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100';

/** Ground vehicle numbers: all from groundAt (flight/ground.ts), shown with the same measured/assumed tags and accuracy line as the drone. */
function GroundHud({ g, n, frameState }: { g: GroundView; n: number; frameState: 'building' | 'ready' }) {
  const [open, setOpen] = useState(true);
  const [wheel, setWheel] = useState(String(g.wheelMm));
  const r = g.res;
  return (
    <div className={box}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between text-sm font-semibold">
        Simulation: ground vehicle <span aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p>{n} driven wheel{n === 1 ? '' : 's'}, motor figures at {g.run.volts} V: {g.run.noLoadRpm} rpm no-load, {g.run.stallKgCm} kg·cm stall.</p>
          <label className="flex items-center gap-2">Wheel diameter (mm)
            <input className={field} inputMode="decimal" value={wheel} aria-label="Wheel diameter in mm"
              onChange={(e) => { setWheel(e.target.value); const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= 10 && v <= 300) g.onWheelMm(v); }} />
            <span className="text-gray-500">default from the wheel template</span>
          </label>
          {!r && <p className="text-amber-800 dark:text-amber-200">Add the mass of your parts (Battery, Payload ...) or a solid frame to get numbers. Total mass is 0 g now{frameState === 'building' ? ' (frame mass loading)' : ''}.</p>}
          {r && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <dt>Top speed, flat <Tag b="model" /></dt><dd className="font-medium">{r.moves ? `${r.topSpeedMs.toFixed(2)} m/s (${(r.topSpeedMs * 3.6).toFixed(1)} km/h)` : 'does not move'}</dd>
              <dt>Max slope <Tag b="model" /></dt><dd className="font-medium">{r.moves ? (r.maxSlopeDeg >= 90 ? 'torque is not the limit (grip is)' : `${r.maxSlopeDeg.toFixed(1)}° (${r.maxGradePct.toFixed(0)}% grade)`) : '0°'}</dd>
              <dt>Time to 90% of top speed <Tag b="model" /></dt><dd className="font-medium">{r.t90S === null ? 'n/a' : `${r.t90S.toFixed(2)} s`}</dd>
              <dt>Rolling resistance <Tag b="assumed" /></dt><dd className="font-medium">coefficient {CRR_ASSUMED} ({r.rollingN.toFixed(2)} N)</dd>
              <dt>No-load speed</dt><dd className="font-medium">{r.noLoadMs.toFixed(2)} m/s</dd>
              <dt>Stall force</dt><dd className="font-medium">{r.stallForceN.toFixed(2)} N</dd>
            </dl>
          )}
          {r && !r.moves && <Chip>Stall force is below the rolling resistance: this vehicle is too heavy for these motors and wheels.</Chip>}
          <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{GROUND_ACCURACY}</p>
        </div>
      )}
    </div>
  );
}
