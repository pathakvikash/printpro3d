# Architecture

## Layout

```
src/app/page.tsx            home: hero, facts bar, guided flow, how it works, materials
src/app/layout.tsx          CartProvider, pre-paint theme script, fonts
src/app/admin/page.tsx      owner page (ADMIN_TOKEN), noindex, no nav link
src/app/api/
  upload (+[name], blob, finalize)  model upload, public fetch by random name, large-file path
  orders        multi-item checkout (POST)
  requests      "design this for me" requests with images
  track/[id]    public tracking view (limited fields)
  generate (+[id], [id]/size)   Meshy text/image to 3D, repair, scale
  design        "Draw it with AI" (shape model from photo/text)
  admin/orders, admin/files/[name]   owner list, status change, file download
src/components/   ProjectFlow (steps), UploadForm, QuoteOrder, ShopOrder, HomeShop, Playground (+scene),
                  ExamplePreview, HeroPart, AiDesign, AiGenerate, IdeaRequest, TrackOrder,
                  CartProvider, CartDrawer, ContactFields, AdminPanel, Navbar, Footer
src/lib/          pure logic and server helpers, each with a *.test.ts
scripts/          set-status.mjs (owner CLI), ai-models.mjs
```

## The flow

`ProjectFlow` shows steps `file | idea | shop | track | build | ai | design`. Heavy steps are `next/dynamic` imports so the home page stays light. Focus moves to the new step on change. `?start=track&id=<id>` deep links into tracking.

Customer paths:
- **File**: upload (`/api/upload`) → server parses STL/OBJ (`analyzeModel.ts`, `meshStats`) → volume, bounding box, bed fit → `.stats.json` sidecar → `QuoteOrder` shows per-material live prices → add to cart.
- **Shop**: 7 sample items in `catalog.ts`, each tied to a builder example (`examples.ts`). Previews are the built CSG result.
- **Build**: `Playground` composes shapes (box, cylinder, sphere, cone, torus, wedge; solid or hole, Z-up mm), CSG via `three-bvh-csg` in a Web Worker (`playground.worker.ts`), `cleanTriangles` repair, exports STL, uploads it, adds to cart. Max 20 shapes, autosaved in localStorage `printpro3d.playground.v1`.
- **AI**: `/api/design` (structured shape JSON → opens in the builder) and `/api/generate` (Meshy). Both gated by `aiGuard.ts` ledgers.
- **Cart**: `cart.ts` pure rules, stored in localStorage `printpro3d.cart.v1` and `printpro3d.saved.v1`. Changing a model line's quantity clears its estimate (we re-quote). Checkout is one `POST /api/orders` with `{items:[{kind:'shop',id,qty}|{kind:'model',file,material,qty}], contact...}`.
- **Track**: `tracking.ts` defines 7 order stages and 4 request stages and the status → sentence map. The public track route returns type, status, createdAt, total, currency, items, unpricedCount only.

## Pricing (`quote.ts`)

Materials PLA, PETG, ABS, TPU (placeholder rates), `SETUP_FEE` 50, `MIN_ORDER` 99, `FILL_FACTOR` 0.4, `MAX_QTY` 100, bed 220x220x250 mm, currency INR. Setup fee and minimum order apply per model line. Open or non-manifold meshes are rejected from auto pricing and become a manual quote (`needs_manual_quote`). Orders are saved as `pending_review`; the owner confirms before asking for payment.

## Storage (`store.ts`)

One small API (put/get/list/delete for JSON and binary) under namespaces `orders`, `requests`, `uploads`, `ai-jobs`, `ai-usage`, `ratelimit`.

| Backend | When |
| --- | --- |
| Local disk under `DATA_DIR` (default project root) | development, self-hosting |
| Vercel Blob (private store) | `BLOB_READ_WRITE_TOKEN` set |
| `os.tmpdir()` | `VERCEL` set, no token: ephemeral, one warning logged, demo only |

Upload names are random (`Date.now()-uuid.ext`); path traversal is rejected. Local data folders are gitignored.

Large uploads: Vercel refuses request bodies over 4.5 MB. In Blob mode, files over 4 MB go from the browser straight to Blob (`/api/upload/blob` issues the token, `/api/upload/finalize` fetches, analyses and validates the file server side, writes the sidecar, deletes it on failure). Smaller files and local mode use `POST /api/upload`. The Blob path is untested against a real store.

## AI

- `aiDesign.ts`/`aiProviders.ts`: providers `anthropic` (default model `claude-haiku-5-5`, structured JSON output, no sampling params), `openai`-compatible (presets openai, openrouter, opencode, groq, together, ollama, lmstudio), and `claude-cli` (dev only). Selection: `AI_PROVIDER`, else Anthropic key, else preset, else CLI in dev.
- `meshy.ts`: text-to-3D v2, image-to-3D v1, print/repair v1, STL output, moderation on. Downloads only from https `*.meshy.ai`, no redirects. `stlScale.ts` scales to size. Repairs run once per job.
- `aiGuard.ts`: per-email 3/day and global 40/day, separate ledgers for design vs generate, count taken just before the paid call, deny-list prompt check. `aiJobs.ts` tracks Meshy jobs.

## Security and abuse rules (keep)

- Server recomputes prices; client totals are ignored.
- Orders accept only model file extensions; unknown shop ids are dropped; duplicates that overflow `MAX_QTY` return 400; request body capped (32 KB for orders).
- Admin: Bearer `ADMIN_TOKEN`, `timingSafeEqual`, 1 s delay per wrong try, lockout after 10 per IP per hour, 503 when unset. Token lives in `sessionStorage`, never in a URL.
- Spam: honeypot field `website`, per-IP hourly limits (10 submissions, 30 uploads, 20 AI calls), kept in the store (soft limits per instance).
- Emails (`notify.ts`, Resend): owner on new order/request, customer on status change. Skipped with a log when keys are missing.
- No keys in code or logs; `.env*` ignored except `.env.example`.

## Performance rules

Home first-load JS about 110 kB (was 407 kB). The hero 3D part loads only at ≥1024 px, after idle, without reduced motion. `Geist_Mono` is not preloaded. Add heavy code behind `next/dynamic` and re-check the build table.
