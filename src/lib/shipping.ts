// India-only shipping fields: state + PIN code (country is fixed). Pure, shared by the checkout form and /api/orders.
import { SERVICE } from './business.ts';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // union territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

// 6 digits, first digit 1-9 (India Post zones); a space after the 3rd digit ("800 001") is tolerated
const PIN_RE = /^[1-9]\d{5}$/;

export type Shipping = { country: string; state: string; pin: string };

/** Returns a friendly error message, or null when valid. */
export function shippingError(state: unknown, pin: unknown): string | null {
  if (typeof state !== 'string' || !(INDIAN_STATES as readonly string[]).includes(state)) {
    return 'Please choose your state from the list. We deliver within India only for now.';
  }
  if (typeof pin !== 'string' || !PIN_RE.test(pin.replace(/\s/g, ''))) {
    return 'Please enter a valid 6-digit Indian PIN code (it cannot start with 0).';
  }
  return null;
}

export function parseShipping(get: (k: string) => unknown): Shipping {
  const err = shippingError(get('state'), get('pin'));
  if (err) throw new Error(err);
  return { country: SERVICE.country, state: get('state') as string, pin: (get('pin') as string).replace(/\s/g, '') };
}
