// Hands a file picked on the home page / playground to the quote page (client navigation keeps module state).
import type { MaterialKey } from '@/lib/quote';
let pending: { file: File; material?: MaterialKey } | null = null;
export const setPendingFile = (file: File, material?: MaterialKey) => { pending = { file, material }; };
/** Returns the waiting file (and the material picked with it) once, then forgets it. */
export const takePendingFile = () => { const p = pending; pending = null; return p; };
