'use client';

import { useMemo, useState } from 'react';
import { MOTORS } from '@/lib/motors';
import { G, makeRotor, maxThrustN, operating, type Basis } from '@/lib/flight/rotor';
import { trim, type TrimResult } from '@/lib/flight/trim';
import type { MassComponent, Motor } from '@/lib/flight/components';
import type { Body } from '@/lib/flight/mass';

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

export default function FlightHud({ motors, components, frame, frameMm, frameState }: {
  motors: Motor[]; components: MassComponent[]; frame: Body | null; frameMm: { x: number; y: number } | null; frameState: 'building' | 'ready';
}) {
  const [open, setOpen] = useState(true);
  const [mah, setMah] = useState('');
  const [cells, setCells] = useState('4');
  const [esc, setEsc] = useState('');
  const full = motors.length >= 3;

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
