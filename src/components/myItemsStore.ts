// Browser storage for My items. Storage can be blocked: every access is guarded.
import { parseItems, type MyItem } from '@/lib/myItems';

export const ITEMS_KEY = 'printpro3d.myitems.v1';

export function loadItems(): MyItem[] {
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    return raw === null ? [] : parseItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Returns false when the browser refused the write. */
export function storeItems(items: MyItem[]): boolean {
  try {
    window.localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
