// The optional 2D design file on a laser request: .svg, .dxf (ASCII) or .pdf, checked by content, never by the client's word.
// SVG is never served inline (the admin route sends every upload as an octet-stream attachment).
import { extOf } from './uploadRules.ts';

export const DESIGN_EXTS = ['.svg', '.dxf', '.pdf'];
/** Blob mode caps the whole request body; images + design file share IDEA_IMAGES_TOTAL (4 MB). */
export const MAX_DESIGN = 4 * 1024 * 1024;
const BAD = 'Design file must be a real SVG, ASCII DXF or PDF, up to 4MB.';

// SVG: after an optional BOM, whitespace, <?xml ...?>, <!DOCTYPE ...> and comments, the root must be <svg, within the first ~1 KB
const SVG_START = /^\uFEFF?(?:\s|<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->)*<svg[\s>]/i;

/** Why a design file (name + bytes) is refused, or null. */
export function designFileProblem(name: string, bytes: Uint8Array): string | null {
  const ext = extOf(name);
  if (!DESIGN_EXTS.includes(ext) || bytes.length === 0 || bytes.length > MAX_DESIGN) return BAD;
  const dec = new TextDecoder('latin1');
  if (ext === '.pdf') return dec.decode(bytes.subarray(0, 4)) === '%PDF' ? null : BAD;
  if (bytes.includes(0)) return BAD; // SVG and ASCII DXF are text
  if (ext === '.dxf') return dec.decode(bytes.subarray(0, 2048)).includes('SECTION') ? null : BAD;
  const text = new TextDecoder().decode(bytes); // UTF-8; a BOM is dropped
  if (/<html|<script/i.test(text)) return BAD;
  return SVG_START.test(text.slice(0, 1024)) ? null : BAD;
}
