// Pure upload rules shared by the upload routes, the direct-to-Blob flow and the browser. No fs, no React, no store.
export const ALLOWED_EXTS = ['.stl', '.obj', '.glb', '.gltf', '.3mf'];
export const MAX_UPLOAD = 200 * 1024 * 1024;
/** Files above this go straight to Blob (Vercel rejects request bodies over 4.5 MB); the rest use POST /api/upload. */
export const DIRECT_MIN = 4 * 1024 * 1024;
/** Idea-request images must fit one 4.5 MB body: 3 images, 4 MB in all (the rest is form fields). */
export const IDEA_IMAGES_TOTAL = 4 * 1024 * 1024;

export const extOf = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
};

/** Why a file (name + byte size) is refused, or null. */
export function fileProblem(name: string, size: number): string | null {
  if (!ALLOWED_EXTS.includes(extOf(name))) return `Invalid file type. Allowed: ${ALLOWED_EXTS.join(', ')}`;
  if (size > MAX_UPLOAD) return 'File too large. Maximum size: 200MB';
  return null;
}

// the stored name scheme: Date.now()-uuid.ext (same as POST /api/upload)
const NAME_RE = /^\d{10,16}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)$/;
/** True for a well-formed random upload name with an allowed model extension. */
export const validUploadName = (name: unknown): name is string =>
  typeof name === 'string' && name.length < 100 && NAME_RE.test(name) && ALLOWED_EXTS.includes(extOf(name));

/** A fresh random name for a direct upload; the extension is the caller's (already checked) one. */
export const newUploadName = (ext: string): string => `${Date.now()}-${crypto.randomUUID()}${ext}`;

export const BLOB_PREFIX = 'uploads/';
/** The Blob pathname the browser must use for a stored name (blob names are `<namespace>/<key>`). */
export const blobPathFor = (name: string) => BLOB_PREFIX + name;
/** The stored name behind a client-chosen Blob pathname, or null when it is not exactly uploads/<valid name>. */
export const nameFromBlobPath = (pathname: unknown): string | null =>
  typeof pathname === 'string' && pathname.startsWith(BLOB_PREFIX) && validUploadName(pathname.slice(BLOB_PREFIX.length))
    ? pathname.slice(BLOB_PREFIX.length)
    : null;

/** Error text when the idea-request images together would not fit one request, or null. */
export const imagesTotalProblem = (sizes: number[]): string | null =>
  sizes.reduce((a, b) => a + b, 0) > IDEA_IMAGES_TOTAL ? 'The images are too large together. Use fewer or smaller images.' : null;
