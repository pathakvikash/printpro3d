# PrintPro3D

Made-to-order 3D printing. A customer uploads a model, picks a ready-made part, builds one from shapes, or asks AI to draw it. They get a price, put it in a cart, check out once and track the order. The owner quotes, prints, ships and moves the order through its stages.

Scope: one piece to wholesale; games, gadgets, electronics enclosures and frames, toys and moving toys, RC and drone bodies. Deliver the printed part, the 3D file, or both.

Status: working end to end locally, no online payment yet. Prices in the code are placeholders. Commits after `3de4d31` are local, not pushed. See [context/GAPS.md](context/GAPS.md) and [context/OWNER-CHECKLIST.md](context/OWNER-CHECKLIST.md).

> AI assistants: read [context/README.md](context/README.md) first. It explains the whole project in a few minutes.

## Run locally

Node 22.18 or newer.

```bash
npm install
cp .env.example .env.local   # all keys are optional; the app runs without them
npm run dev                  # http://localhost:3000
npm test                     # unit and flow tests
npm run build && npm start   # production check
```

Without keys: quoting, the shop, the builder, the cart, checkout and tracking all work. AI drawing, Meshy generation and emails switch on when their keys are set.

## What the customer sees

Real pages with a nav bar: `/shop`, `/build`, `/quote`, `/request`, `/track`, `/materials`, `/how-it-works`, `/about`, `/contact`, plus `/blueprint/[id]`. `/ai` is the "Build with AI" chat (also opened as a panel by the header **AI** button and the floating AI button on every page); `/draw` and `/motor-test` redirect to `/build`; old `/?start=<step>` links redirect too. Per-route detail, the design-project API, caps and flight-physics assumptions are in [context/OPERATIONS.md](context/OPERATIONS.md).

| Step | What it does |
| --- | --- |
| File | Upload STL or OBJ, see size, volume and price per material, add to cart |
| Shop | Parametric templates with live 3D previews and size fields, server-repriced |
| Build | Blueprint-first: template, AI prompt or uploaded mesh, then Approve, Finalize, order. Place parts, Simulate drone hover, get next-part suggestions |
| AI chat | Describe or photograph a part, get a shape model with a live preview, refine it turn by turn, then Edit (builder) or Price (cart). Meshy organic 3D is a tab in the same chat when `MESHY_API_KEY` is set |
| Meshy | Meshy text/image to 3D as a mesh source (needs `MESHY_API_KEY`) |
| Idea | Describe something we should design, attach pictures |
| Track | Order and request tracking with a demo order to preview the stages |

Cart and saved list live in the browser. Checkout is one request; the server recomputes every price.

## Service area

India only (for now), based in Patna, Bihar (`src/lib/business.ts`). Checkout asks for an Indian state and 6-digit PIN (`src/lib/shipping.ts`). Address, pickup and delivery times are owner-pending.

## Owner tasks

```bash
npm run order:status -- <order-id> <status>   # move an order, emails the customer
npm run ai:models                             # list models the configured AI provider offers
npm run designs:prune                         # delete unordered design projects older than 30 days (weekly)
```

Or open `/admin` (needs `ADMIN_TOKEN`). Orders and requests are listed newest first; status changes and file downloads go through the admin API.

Order statuses: `pending_review`, `needs_manual_quote`, `quoted`, `awaiting_payment`, `paid`, `printing`, `shipped`, `delivered`, `cancelled`. Request statuses: `new`, `designing`, `quote_sent`, `approved`, `cancelled`. Source: `src/lib/tracking.ts`.

## Environment

Everything is listed with a comment in [.env.example](.env.example). Summary:

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Draw it with AI (Anthropic). Or `AI_PRESET` + `AI_API_KEY` + `AI_MODEL` for any OpenAI-compatible provider |
| `AI_DESIGN_TIER`, `AI_DESIGN_MODEL`, `AI_REVISIONS_PER_PROJECT`, `AI_DAILY_PER_EMAIL`, `AI_DAILY_TOTAL` | Blueprint AI model tier and caps |
| `MESHY_API_KEY` | Meshy text/image to 3D |
| `RESEND_API_KEY`, `ORDER_NOTIFY_TO`, `ORDER_NOTIFY_FROM`, `SITE_URL` | Owner email on new order, customer email on status change |
| `ADMIN_TOKEN` | `/admin` and the admin API (unset = disabled). `/admin` also picks the AI provider, preset, model and base URL (saved in the store, beats the `AI_*` env vars; keys stay env-only) |
| `BLOB_READ_WRITE_TOKEN` | Durable storage on Vercel (private Blob store) |
| `DATA_DIR` | Where local files go (default: project root) |

Keys are read on the server only. Never commit `.env*` (already ignored except `.env.example`).

## Deploy on Vercel

1. Import the GitHub repo in Vercel (personal account).
2. Storage > create a **private** Blob store and connect it; this sets `BLOB_READ_WRITE_TOKEN`.
3. Set `ADMIN_TOKEN`, `SITE_URL` (the live URL) and any AI, Meshy and Resend keys.
4. Deploy. Without the Blob store, Vercel only has `/tmp`: orders vanish between requests. Do not take real orders that way.

Vercel limits to know: request bodies over 4.5 MB are refused by the platform, so large models upload straight to Blob (see context/ARCHITECTURE.md). Function time caps depend on your plan.

## Where things live

```
src/app            home, one folder per page, API routes, admin page, sitemap
src/components     page components, Navbar, Footer
src/lib            pricing, cart, tracking, AI, storage, email (pure logic + tests)
scripts            owner CLI (order:status, ai:models)
context/           project brief for the next AI or developer
```

## Safety notes

- AI keys stay on the server. The `claude-cli` provider is development only and is off in production and on Vercel (using a personal Claude login to serve customers breaks Anthropic's terms).
- Uploaded file names are random. Uploads are not publicly listable; the admin route downloads them.
- Open or non-manifold meshes are not auto-priced; they go to manual quote.
- Spam: hidden honeypot field plus per-IP hourly limits on orders, uploads and AI calls.
