// Shared bits for every form: class names, money format, contact inputs, success box.
import { CURRENCY } from '@/lib/quote';

export const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
export const input =
  'w-full min-h-[46px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
export const label = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1';
export const card = 'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5';
export const submitBtn =
  'inline-flex w-full min-h-11 whitespace-nowrap items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold transition-all duration-200';
export const secondaryBtn =
  'inline-flex min-h-11 whitespace-nowrap items-center justify-center gap-2 py-2.5 px-5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-medium hover:border-indigo-500 transition-colors';

export function ContactFields({
  addressRequired = true,
  notes = true,
  address = true,
  idPrefix = '', // keeps ids unique when two contact forms are on one page
}: {
  addressRequired?: boolean;
  notes?: boolean;
  address?: boolean; // false: no address box at all
  idPrefix?: string;
}) {
  const p = idPrefix;
  return (
    <>
      {/* honeypot: people never see or fill it, form-filling bots do; the server then drops the submission */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${p}website`}>Leave this field empty</label>
        <input id={`${p}website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label htmlFor={`${p}name`} className={label}>Name</label>
        <input id={`${p}name`} name="name" required maxLength={100} className={input} />
      </div>
      <div>
        <label htmlFor={`${p}email`} className={label}>Email</label>
        <input id={`${p}email`} name="email" type="email" required maxLength={200} className={input} />
      </div>
      <div>
        <label htmlFor={`${p}phone`} className={label}>Phone</label>
        <input id={`${p}phone`} name="phone" type="tel" required maxLength={30} className={input} />
      </div>
      {address && (
      <div>
        <label htmlFor={`${p}address`} className={label}>
          Shipping address{addressRequired ? '' : ' (optional for a 3D file only)'}
        </label>
        <textarea id={`${p}address`} name="address" required={addressRequired} maxLength={500} rows={3} className={input} />
      </div>
      )}
      {notes && (
        <div>
          <label htmlFor={`${p}notes`} className={label}>Notes (optional)</label>
          <textarea id={`${p}notes`} name="notes" maxLength={1000} rows={2} className={input} />
        </div>
      )}
    </>
  );
}

export function contactFrom(f: FormData) {
  return {
    name: f.get('name'), email: f.get('email'), phone: f.get('phone'),
    address: f.get('address'), notes: f.get('notes'), website: f.get('website'),
  };
}

export function Done({ title, id, lines }: { title: string; id: string; lines: string[] }) {
  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-1 text-sm text-green-700 dark:text-green-300">
      <p className="font-semibold text-base text-green-800 dark:text-green-300">{title}</p>
      <p className="break-all">Id: {id}</p>
      {lines.map((l) => <p key={l}>{l}</p>)}
    </div>
  );
}
