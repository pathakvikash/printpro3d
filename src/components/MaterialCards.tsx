import Link from 'next/link';
import { quote, MATERIALS, type MaterialKey } from '@/lib/quote';
import { MATERIAL_INFO } from '@/lib/materialInfo';

const KEYS = Object.keys(MATERIALS) as MaterialKey[];
// illustrative only, not measured from real prints; keep equal to PRESETS colours in PrintMaterial.tsx so the card matches the part
export const COLOUR: Record<MaterialKey, string> = { PLA: '#bfb49c', PETG: '#3f86ad', ABS: '#4a4f57', TPU: '#c2553f' };
const swatch = (c: string) => ({
  backgroundColor: c,
  backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.16) 0 1px, rgba(0,0,0,.14) 1px 2px, transparent 2px 4px), linear-gradient(100deg, rgba(255,255,255,.14) 0%, transparent 35%, rgba(0,0,0,.25) 100%)',
});

type Props = {
  /** Volume of the part in cm3; when set, each card shows this part's weight in that material (same maths as quote()). */
  partVolumeCm3?: number;
  selected?: MaterialKey;
  onSelect?: (k: MaterialKey) => void;
};

export default function MaterialCards({ partVolumeCm3, selected, onSelect }: Props) {
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KEYS.map((k) => {
          const m = MATERIAL_INFO[k];
          const body = (
            <>
              <span aria-hidden className="block h-16" style={swatch(COLOUR[k])} />
              <span className="block space-y-1 p-3 text-sm text-gray-600 dark:text-gray-300">
                <strong className="block text-base text-gray-900 dark:text-white">{m.label}</strong>
                <span className="block">{m.strength}, flexibility {m.flexibility.toLowerCase()}</span>
                <span className="block">Heat: {m.heat}</span>
                <span className="block">{m.use}</span>
                {partVolumeCm3 !== undefined && (
                  <span className="block pt-1 font-medium text-gray-900 dark:text-white">
                    This part: {quote({ volumeCm3: partVolumeCm3, sizeMm: { x: 0, y: 0, z: 0 } }, k, 1).grams.toFixed(1)} g
                  </span>
                )}
              </span>
            </>
          );
          const cls = `flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 dark:bg-gray-950 ${
            selected === k ? 'border-indigo-600 ring-1 ring-indigo-600 dark:border-indigo-400 dark:ring-indigo-400' : 'border-gray-200 dark:border-gray-700'
          }`;
          return (
            <li key={k}>
              {onSelect ? (
                <button type="button" aria-pressed={selected === k} onClick={() => onSelect(k)} className={`${cls} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        Swatch colours are illustrative; the printed colour may differ.
        {onSelect && <> <Link href="/materials" className="font-medium text-indigo-700 underline underline-offset-2 hover:no-underline dark:text-indigo-400">Compare materials</Link></>}
      </p>
    </div>
  );
}
