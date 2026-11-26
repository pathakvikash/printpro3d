# Architecture

## Layout

```
src/app/page.tsx            home: hero, facts bar, option cards, 3-part shop preview, how it works, materials teaser; redirects old ?start= links
src/app/{quote,request,ai,draw,shop,build,track,materials,how-it-works,contact}/page.tsx   one page per feature
src/app/sitemap.ts          public routes (no /admin)
src/app/layout.tsx          CartProvider, pre-paint theme script, fonts
src/app/admin/page.tsx      owner page (Google sign-in, ADMIN_EMAILS), noindex, no nav link
src/app/api/
  upload (+[name], blob, finalize)  model upload, public fetch by random name, large-file path
  orders        multi-item checkout (POST)
  requests      "design this for me" requests with images
  track/[id]    public tracking view (limited fields)
  generate (+[id], [id]/size)   Meshy text/image to 3D, repair, scale
  design        "Draw it with AI" (shape model from photo/text)
  admin/orders, admin/files/[name]   owner list, status change, file download
src/components/   PageShell, RoutePages (client wrappers: router callbacks, ssr:false imports), UploadForm, QuoteOrder, ShopOrder, HomeShop, Playground (+scene),
                  ExamplePreview, HeroPart, AiDesign, AiGenerate, IdeaRequest, TrackOrder,
                  CartProvider, CartDrawer, ContactFields, AdminPanel, Navbar, Footer
src/lib/          pure logic and server helpers, each with a *.test.ts
scripts/          set-status.mjs (owner CLI), ai-models.mjs
```

## The flow

Each feature is its own route (`/quote`, `/request`, `/ai`, `/draw`, `/shop`, `/build`, `/track`), so a route loads only its own code and three.js stays off the home page. `/ai` and `/draw` show a not-available note when their provider is off. `/track?id=<id>` deep links into tracking. The home page maps old `/?start=<step>` URLs to the new routes with `redirect()`.

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

One small API (put/get/list/delete for JSON and binary) under namespaces `orders`, `requests`, `uploads`, `ai-jobs`, `ai-usage`, `ratelimit`, `settings`.

| Backend | When |
| --- | --- |
| Local disk under `DATA_DIR` (default project root) | development, self-hosting |
| Vercel Blob (private store) | `BLOB_READ_WRITE_TOKEN` set |
| `os.tmpdir()` | `VERCEL` set, no token: ephemeral, one warning logged, demo only |

Upload names are random (`Date.now()-uuid.ext`); path traversal is rejected. Local data folders are gitignored.

Large uploads: Vercel refuses request bodies over 4.5 MB. In Blob mode, files over 4 MB go from the browser straight to Blob (`/api/upload/blob` issues the token, `/api/upload/finalize` fetches, analyses and validates the file server side, writes the sidecar, deletes it on failure). Smaller files and local mode use `POST /api/upload`. The Blob path is untested against a real store.

## AI

- `aiDesign.ts`/`aiProviders.ts`: providers `anthropic` (default model `claude-haiku-5-5`, structured JSON output, no sampling params), `openai`-compatible (presets openai, openrouter, opencode, groq, together, ollama, lmstudio), and `claude-cli` (dev only). Selection: stored admin choice, then `AI_PROVIDER`, then Auto. Auto (no provider, or `auto`) takes the first available of anthropic (`ANTHROPIC_API_KEY`), openai-compatible (`AI_BASE_URL`, or a preset with a key; keyless ollama/lmstudio only outside production), claude-cli. claude-cli is automatic only when NODE_ENV is not production, VERCEL is unset and a `claude` executable is on PATH (`claudeCli.ts`, PATH scanned with fs, cached); `AI_ALLOW_CLI=0` disables, `=1` forces it on locally; impossible in production. A named provider is strict. `/api/admin/ai` GET returns `auto` (provider id, model, label) and `/admin` shows what Auto resolves to. Admin is reachable from the account menu, the hamburger and the footer ("Owner admin"); it is gated by Google sign-in and shows sign-in / denied / off states.
- `meshy.ts`: text-to-3D v2, image-to-3D v1, print/repair v1, STL output, moderation on. Downloads only from https `*.meshy.ai`, no redirects. `stlScale.ts` scales to size. Repairs run once per job.
- AI settings (`aiSettings.ts`, `/api/admin/ai`, `AdminAiSettings` in `/admin`): the owner picks provider, preset, model and base URL; saved in store namespace `settings` (`ai.json`, non-secret only, strict PUT validation, production base URL must be https on a public host, `claude-cli` refused in production). `aiEnv()` lays the saved choice over `process.env`, so every AI route (`/api/design`, `/api/designs*`, `/api/suggest`, home, `/draw`) resolves stored > env > defaults. claude-cli model is a select (haiku, sonnet, opus or the full ids; anything else is rejected on save and ignored on read). The same form is at `/settings/ai`, linked from the account menu and the AI chat header; `aiSettingsGate` lets `/api/admin/ai` through without sign-in outside production (NODE_ENV not production and VERCEL unset) and uses the admin gate in production; all other admin routes always use the gate. Admin can list models and run a one-call Test; keys show as booleans only and are never accepted.
- **Build with AI chat** (`AiChat.tsx`, `AiChatLauncher.tsx`, `aiChat.ts`): header **AI** link (event opens the panel; plain `/ai` link without JS) and a floating button (bottom-right, `bottom-20` on phones above sticky bars, hidden on `/ai` and `/admin`). Panel on desktop, full-screen sheet on phones, focus trap, Escape closes. Loaded through `next/dynamic` only when opened, so no page's first load grows. Each turn posts to `/api/design`; a follow-up sends the last shapes back as `shapes` and the server re-validates them (`refineText`) before they reach the prompt. Edit/Price hand the design to `/playground?mode=build&from=ai[&price=1]` via sessionStorage `printpro3d.aidesign.v1`. History in sessionStorage `printpro3d.aichat.v1`, email in localStorage. Meshy is a labelled tab that mounts `AiGenerate`.
- OpenAI-compatible replies: if `content` is empty, `reasoning_content` is used as a last resort (LM Studio reasoning models).
- `aiGuard.ts`: per-email 3/day and global 40/day, separate ledgers for design vs generate, count taken just before the paid call, deny-list prompt check. `aiJobs.ts` tracks Meshy jobs.

## Security and abuse rules (keep)

- Server recomputes prices; client totals are ignored.
- Orders accept only model file extensions; unknown shop ids are dropped; duplicates that overflow `MAX_QTY` return 400; request body capped (32 KB for orders).
- Admin: Google sign-in via Auth.js (`next-auth@5.0.0-beta.32`, the v5 line that supports Next 16/React 19; JWT session, no database, no adapter). `src/auth.ts` (Google provider, `trustHost`), handlers at `/api/auth/[...nextauth]` (sign-in `/api/auth/signin`, callback `/api/auth/callback/google`). Allowlist `ADMIN_EMAILS` (comma-separated, lower-cased, exact match, Google `email_verified` required) is enforced on `/admin`, `/settings/ai` and every `/api/admin/*` request (`adminGate`, `src/lib/adminAuth.ts`): a signed-in non-admin gets 403 "not allowed", signed out 401. The `signIn` callback only requires a verified Google email, so any customer can sign in (session carries `id` = Google sub and `admin` flag). `ADMIN_EMAILS` unset: 503 "admin disabled". There is no password or bearer-token route: admin is Gmail-only (owner decision, 2026-11-26). Pages `/admin` and `/settings/ai` check the session in a server component (`AdminAccess`: sign-in button, "not allowed", panel + "Signed in as · Sign out"); panels call the APIs with the session cookie. No SessionProvider, no client auth JS, no proxy/middleware; `routeBundles.test.ts` keeps next-auth off public bundles. Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`.
- Customer accounts (no database): `src/lib/account.ts`. `/api/orders` and `/api/requests` store `userSub` + `userEmail` from the session (never the body) and append to the store index `user-orders/<sub>.json`. `/account` (server page, "My orders") lists records matching the sub or the verified email (email match scans all records, ponytail ceiling); `POST /account/signout`. The header menu fetches `/api/auth/session` lazily (`sessionClient.ts`, no next-auth client code) to show sign-in / initial + email / admin links; `ContactPrefill` fills name and email on forms. Stored per user: Google sub, email, name only.
- Spam: honeypot field `website`, per-IP hourly limits (10 submissions, 30 uploads, 20 AI calls), kept in the store (soft limits per instance).
- Emails (`notify.ts`, Resend): owner on new order/request, customer on status change. Skipped with a log when keys are missing.
- No keys in code or logs; `.env*` ignored except `.env.example`.

## Performance rules

Home first-load JS about 110 kB (was 407 kB). The hero 3D part loads only at ≥1024 px, after idle, without reduced motion. `Geist_Mono` is not preloaded. Add heavy code behind `next/dynamic` and re-check the build table.
