import { SERVICE } from '@/lib/business';
import { INDIAN_STATES } from '@/lib/shipping';
import { input, label } from './ContactFields';

// Country is fixed (India only for now): shown, not editable, and the server sets it itself.
export default function ShippingFields({ idPrefix = '' }: { idPrefix?: string }) {
  const p = idPrefix;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${p}state`} className={label}>State</label>
          <select id={`${p}state`} name="state" required defaultValue="" className={input}>
            <option value="" disabled>Choose state</option>
            {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${p}pin`} className={label}>PIN code</label>
          <input id={`${p}pin`} name="pin" required inputMode="numeric" autoComplete="postal-code" maxLength={7} placeholder="800001" className={input} />
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">Country: {SERVICE.country} · {SERVICE.serviceArea}</p>
    </>
  );
}
