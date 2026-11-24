// Shop reference cards for the sourced motors. Not for sale: no price, no cart.
import Link from 'next/link';
import { MOTORS } from '@/lib/motors';

export default function MotorShelf() {
  return (
    <section aria-labelledby="motors-h" className="mt-10 border-t border-gray-200 pt-6 dark:border-gray-800">
      <h2 id="motors-h" className="text-xl font-semibold text-gray-900 dark:text-white">Motors &amp; electronics</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Reference data for motors our parts are designed around. Not sold here: buy them from the maker or a hobby shop.</p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOTORS.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{m.kind === 'prop' ? 'Drone motor' : 'Geared motor'}</span>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{m.name}</h3>
            <ul className="space-y-0.5 text-sm text-gray-700 dark:text-gray-300">
              {m.kind === 'prop'
                ? [<li key="p">Prop: {m.prop}</li>, ...m.runs.map((r) => <li key={r.volts}>{r.label}: {r.points[r.points.length - 1].thrustG} g thrust, {r.points[r.points.length - 1].amps} A at full throttle</li>)]
                : m.runs.map((r) => <li key={r.volts}>{r.volts} V: {r.noLoadRpm} rpm no-load, {r.stallKgCm} kg-cm stall, {r.stallA} A stall</li>)}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {m.source.kind}: <a href={m.source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline dark:text-indigo-400">{m.source.label}</a>
            </p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Not sold here — bought separately</p>
            <Link href="/build?example=drone-plate&sim=1" className="mt-auto text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Test it in Build →</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
