/** True when the first bytes match the image type implied by ext (png, jpg/jpeg, webp). */
export function isImage(b: Uint8Array, ext: string): boolean {
  const at = (o: number, s: number[]) => s.every((v, i) => b[o + i] === v);
  switch (ext) {
    case '.png': return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case '.jpg':
    case '.jpeg': return at(0, [0xff, 0xd8, 0xff]);
    case '.webp': return at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50]);
    default: return false;
  }
}
