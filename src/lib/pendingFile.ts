// Hands a file picked on the home page to the quote page (client navigation keeps module state).
let pending: File | null = null;
export const setPendingFile = (f: File) => { pending = f; };
/** Returns the waiting file once, then forgets it. */
export const takePendingFile = (): File | null => { const f = pending; pending = null; return f; };
