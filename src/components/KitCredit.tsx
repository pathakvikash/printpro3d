// "Design by <author>, <licence>, source: <url>" for kits that carry a third-party design (rc-car, desk-pet). Plain text, no buttons.
// GPL kits also link the corresponding source files we ship (the STL files and the licence text); Apache gets the licence text.
import type { KitCredit } from '@/lib/kits';

const link = 'text-indigo-600 underline dark:text-indigo-400';

export default function CreditLine({ credit, files = false, className = '' }: { credit: KitCredit; files?: boolean; className?: string }) {
  const dir = credit.files[0]?.replace(/[^/]+$/, '') ?? '';
  return (
    <p className={`text-xs text-gray-600 dark:text-gray-400 ${className}`}>
      Design by {credit.author}, {credit.licence}, source: <a href={credit.url} target="_blank" rel="noopener noreferrer" className={link}>{credit.url}</a>.
      {files && dir && (
        <> Licence text: <a href={`${dir}LICENSE`} className={link}>LICENSE</a>.{' '}
          {credit.licence.startsWith('GPL') && <>Source files we print from (unmodified): {credit.files.map((f, i) => <span key={f}>{i > 0 && ', '}<a href={f} className={link}>{f.split('/').pop()}</a></span>)}.</>}
        </>
      )}
    </p>
  );
}
