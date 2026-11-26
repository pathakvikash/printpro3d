'use client';

import { useEffect } from 'react';
import { loadUser } from '@/lib/sessionClient';

// Fills the empty name and email boxes from the Google session (idle, after paint). Uses the native setter and an input event so React forms notice.
export default function ContactPrefill({ idPrefix = '' }: { idPrefix?: string }) {
  useEffect(() => {
    let off = false;
    void loadUser().then((u) => {
      if (off || !u) return;
      for (const [f, v] of [['name', u.name], ['email', u.email]] as const) {
        const el = document.getElementById(`${idPrefix}${f}`) as HTMLInputElement | null;
        if (!el || el.value || !v) continue;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    return () => { off = true; };
  }, [idPrefix]);
  return null;
}
