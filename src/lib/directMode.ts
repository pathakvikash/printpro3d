// Browser side: asks once whether the server stores into Vercel Blob (then big bodies must bypass Vercel's 4.5 MB request limit).
let mode: Promise<boolean> | undefined;
export const canGoDirect = (): Promise<boolean> =>
  (mode ??= fetch('/api/upload/mode').then((r) => r.json()).then((d) => d?.direct === true).catch(() => false));
