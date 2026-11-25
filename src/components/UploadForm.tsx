'use client';

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import QuoteOrder from './QuoteOrder';
import FlowStrip from './FlowStrip';
import type { MaterialKey, MeshStats } from '@/lib/quote';
import { canGoDirect } from '@/lib/directMode';
import { takePendingFile } from '@/lib/pendingFile';
import { BLOB_PREFIX, DIRECT_MIN, extOf, fileProblem, newUploadName } from '@/lib/uploadRules';

// three.js loads only once a file is uploaded, not in /quote's first load
import ModelWithBlueprint from './ModelWithBlueprint';

const validateFile = (f: File): string | null => fileProblem(f.name, f.size);

// Vercel rejects request bodies over 4.5 MB, so on the Blob backend big files go straight to Blob, then /api/upload/finalize
async function uploadDirect(f: File) {
  const { upload } = await import('@vercel/blob/client');
  const name = newUploadName(extOf(f.name));
  await upload(BLOB_PREFIX + name, f, { access: 'private', handleUploadUrl: '/api/upload/blob', multipart: true });
  const res = await fetch('/api/upload/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, originalName: f.name }),
  });
  return res;
}

// idle: filler shown beside / under the drop zone until a file is chosen (side = right column at lg, below = full width)
export default function UploadForm({ initialFile, onQuote, idle }: { initialFile?: File; onQuote?: () => void; idle?: { side: ReactNode; below: ReactNode } }) {
  const [file, setFile] = useState<File | null>(initialFile ?? null); // initialFile: a model built in the playground
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ file: string; name: string; stats: MeshStats | null } | null>(null);
  const [positions, setPositions] = useState<Float32Array | null>(null); // from the preview, for the blueprint
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [material, setMaterial] = useState<MaterialKey>('PLA'); // QuoteOrder's pick, shown on the preview
  const handoffMaterial = useRef<MaterialKey>('PLA'); // picked in the playground, applied when the upload finishes
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    setUploadedUrl(null);
    setUploaded(null);
    setPositions(null);
    const err = validateFile(f);
    if (err) {
      setError(err);
    } else {
      setFile(f);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const runUpload = useCallback(async (f: File) => {
    setUploading(true);
    setError(null);
    const startMaterial = handoffMaterial.current; // read once: a failed upload must not leave it for a later one
    handoffMaterial.current = 'PLA';

    try {
      let res: Response;
      if (f.size > DIRECT_MIN && (await canGoDirect())) {
        res = await uploadDirect(f);
      } else {
        const formData = new FormData();
        formData.append('file', f);
        res = await fetch('/api/upload', { method: 'POST', body: formData });
      }
      const data = await res.json().catch(() => ({}));
      // a hosting limit (Vercel: 4.5 MB per request) answers 413 with plain text, not our JSON
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'This file is too large to upload here. Try a smaller file.' : 'Upload failed'));
      setUploadedUrl(data.url);
      setUploaded({ file: data.file, name: f.name, stats: data.stats });
      setMaterial(startMaterial); // a new QuoteOrder starts on the handed-off material (PLA by default)
      setFile(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleUpload = () => {
    if (file) void runUpload(file);
  };

  // "Add another model" for an uploaded file: clears the quote and shows the drop zone again
  const resetUpload = () => {
    setUploaded(null);
    setUploadedUrl(null);
    setPositions(null);
    setError(null);
  };

  // a playground model uploads once, by itself; the ref keeps React strict mode from uploading twice
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!initialFile || autoStarted.current) return;
    autoStarted.current = true;
    void runUpload(initialFile);
  }, [initialFile, runUpload]);

  // a file picked on the home page: validate and upload it like a dropped one
  useEffect(() => {
    if (initialFile) return;
    const p = takePendingFile();
    if (!p) return;
    const f = p.file;
    handoffMaterial.current = p.material ?? 'PLA';
    const err = validateFile(f);
    if (err) { setError(err); handoffMaterial.current = 'PLA'; }
    else void runUpload(f);
  }, [runUpload, initialFile]);

  // runs after the quote section has rendered (the ref keeps an inline callback from re-firing on every render)
  const onQuoteRef = useRef(onQuote);
  useEffect(() => { onQuoteRef.current = onQuote; });
  useEffect(() => {
    if (uploaded) onQuoteRef.current?.();
  }, [uploaded]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const replacing = !!uploadedUrl && !initialFile; // after upload the drop zone shrinks to a "Replace file" bar
  const showIdle = !!idle && !initialFile && !uploadedUrl && !uploading;

  return (
    <div className="space-y-6 lg:space-y-8">
      {!initialFile && <FlowStrip current={uploadedUrl ? 'adjust' : 'pick'} />}
      <div className={showIdle ? 'grid items-start gap-6 lg:grid-cols-2 lg:gap-8' : 'space-y-6 lg:space-y-8'}>
      <div className="space-y-6 lg:space-y-8">
      {/* Drop Zone (hidden when the file is already chosen) */}
      {!initialFile && (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer border-2 border-dashed text-center transition-all duration-300 ${replacing ? 'rounded-xl px-4 py-3' : 'rounded-2xl p-12'} ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-gray-900'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".stl,.obj,.glb,.gltf,.3mf"
          onChange={handleInputChange}
          className="hidden"
        />
        {replacing ? (
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span className="truncate font-medium">{uploaded?.name}</span>
            <span title="Replace file" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap font-semibold text-indigo-600 dark:text-indigo-400">Replace</span>
          </p>
        ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <svg className="w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              {dragOver ? 'Drop your file here' : 'Drag & drop your 3D model'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to browse &middot; STL, OBJ, GLB, 3MF (max 200MB)
            </p>
          </div>
        </div>
        )}
      </div>
      )}

      {/* File selected */}
      {file && !initialFile && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[300px]">{file.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatSize(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              aria-label="Remove file"
              title="Remove file"
              className="flex h-10 w-10 items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            aria-label="Get my price"
            title="Get my price"
            className="w-full min-h-11 whitespace-nowrap py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Price
              </>
            )}
          </button>
        </div>
      )}

      {/* ponytail: indeterminate, fetch gives no byte progress; real percent needs XHR/onUploadProgress */}
      {uploading && <div role="progressbar" aria-label="Uploading your model" className="pp-bar" />}

      {/* Playground model: status while it uploads */}
      {initialFile && !uploadedUrl && !error && (
        <p role="status" className="text-center text-lg font-medium text-gray-700 dark:text-gray-200">Preparing your quote…</p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-2">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            {initialFile && (
              <button
                type="button"
                onClick={() => void runUpload(initialFile)}
                disabled={uploading}
                aria-label="Try again"
                title="Try again"
                className="min-h-10 whitespace-nowrap rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      {uploadedUrl && (
        <div className="pp-fade grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Model Preview</h3>
            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
              Uploaded successfully
            </span>
          </div>
          <ModelWithBlueprint url={uploadedUrl} name={uploaded?.name ?? 'Your model'} onPositions={setPositions} material={material} />
          </div>
          {uploaded && (
            <div className="lg:sticky lg:top-20">
            <QuoteOrder
              key={uploaded.file}
              initialMaterial={material}
              file={uploaded.file}
              stats={uploaded.stats}
              positions={positions}
              onMaterial={setMaterial}
              label={initialFile ? 'Model from the builder' : uploaded.name}
              // the builder owns its own model, so only uploads can be reset from here
              onAnother={initialFile ? undefined : resetUpload}
            />
            </div>
          )}
        </div>
      )}
      </div>
      {showIdle && <div>{idle.side}</div>}
      </div>
      {showIdle && idle.below}
    </div>
  );
}
