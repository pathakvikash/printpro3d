# Operations

## Run and test

```bash
npm install
npm run dev            # http://localhost:3000 (the Claude launch config uses port 3210)
npm test               # node:test, no framework
npx tsc --noEmit -p .
npx eslint src scripts # `npm run lint` also scans .next when present
npm run build && npm start
```

Run `next build` only when no other build is running (`ps aux | grep "next build"`). Do not build while `next dev` or `next start` runs from the same folder; stop it first.

## Smoke test of a production build

1. Home loads, no console errors; header theme toggle switches light and dark and survives reload.
2. `/quote`: upload a small closed STL: size, volume and four material prices appear; Add to cart.
3. `/shop`: template cards with 3D previews and size fields; change a size, the price and preview follow; add to cart.
4. `/build`: pick a template, Approve the blueprint, Finalize, add to cart; try Simulate on a drone frame.
5. Cart drawer: change quantity (a model line becomes "We'll quote this one"), checkout with a test contact.
6. `/track`: use the new order id; the demo order shows all stages.
7. `/admin`: wrong token is refused, right token lists the order; change status; the customer email is logged or sent.
8. Nav: every link opens its page (also `/request`, `/materials`, `/how-it-works`, `/contact`); old `/?start=file` and `/upload` land on `/quote`; hamburger works on mobile.
9. Phone width (375 px): no horizontal scroll, no 3D canvas on the home hero.

## Data

Local data folders (gitignored): `uploads/`, `orders/`, `requests/`, `ai-jobs/`, `ai-usage/`, `ratelimit/`. Delete test data freely in development. On Vercel the data is in the private Blob store.

## Owner commands

```bash
npm run order:status -- <order-id> <status>   # also emails the customer
npm run ai:models                             # models the configured provider offers
npm run designs:prune                         # delete unordered design projects older than 30 days (run weekly)
```

## What each route does

| Route | What it does |
| --- | --- |
| `/` | Home: hero, facts bar, shop strip, how it works, materials |
| `/shop` | Parametric templates (enclosure, Pi/Arduino case, phone stand, cable clip, name plate, spacer set, motor mount, motor wheel, grid bin, drone camera mount). Size fields rebuild the model; the price is recomputed from the built mesh. Owner `marketLinks` per template show only when filled |
| `/build` | Blueprint-first design flow with a Plan / Approve / Build / Order stepper. Start from a template, a prompt (AI) or an uploaded mesh. Canvas lets the customer place motors and parts; Simulate opens the flight HUD; a rule-based "what next / where" suggestion engine can be re-ranked by AI (every position is re-checked server-side) |
| `/quote` | Upload STL/OBJ: size, volume, price per material, blueprint drawing and a "What we detected" card from `analyzeMesh`; add to cart |
| `/blueprint/[id]` | Static three-view dimensioned drawing of one catalog item |
| `/materials` | Material comparison and price per cm3 |
| `/how-it-works` | Steps and FAQ |
| `/about` | Business identity; renders nothing until the owner fills it (see OWNER-CHECKLIST) |
| `/request`, `/track`, `/contact`, `/admin` | Idea request, order tracking, contact, owner admin |
| `/draw`, `/ai`, `/motor-test` | Redirect to `/build` |

## Design project lifecycle and API

Lifecycle: `draft` (edit, AI revise, undo) -> `approved` (frozen) -> `finalized` (STL built on the server, read-only) -> `ordered`. Every change is a numbered revision; undo steps back one.

| Endpoint | Does |
| --- | --- |
| `GET /api/designs` | Capabilities: `ai`, `meshy`, `tier`, `revisions` cap |
| `POST /api/designs` | Create: `source` = `prompt` (needs email, brief up to 600 chars, may ask questions first), `template` (cfg) or `mesh` (uploaded file) |
| `GET /api/designs/[id]` | Project plus final stats |
| `POST /api/designs/[id]/revise` | AI revision (counts against the caps below; 422 with a reason if the AI blueprint fails validation) |
| `POST /api/designs/[id]/manual` | Manual revision: full blueprint, or `longestMm` for an uploaded mesh |
| `POST /api/designs/[id]/undo` | Back one revision |
| `POST /api/designs/[id]/approve` | Freeze the current revision |
| `POST /api/designs/[id]/finalize` | Rebuild the print STL with CSG (up to 60 s) and write stats |

Caps: `AI_REVISIONS_PER_PROJECT` = 5 AI revisions per project (hard ceiling 30 revisions of any kind); `AI_DAILY_PER_EMAIL` = 20 AI calls per email per UTC day for this flow (3 for the older routes); `AI_DAILY_TOTAL` = 200 per day (40 older routes). Model: `AI_DESIGN_TIER` (`low`/`mid`/`high` = Haiku/Sonnet/Opus 5.5, default `mid`); `AI_DESIGN_MODEL` sets an exact id and wins. A repeated request on the same blueprint is served from `design-cache/` and costs nothing. Without an AI key the AI routes answer 503; templates and manual edits keep working.

Pruning: unordered projects older than 30 days are deleted with their STL by `npm run designs:prune`. Nothing runs it automatically: schedule it weekly or run it by hand.

## Order gate and pricing

- A design line is accepted only for a `finalized` project whose STL is in the store; otherwise the order is refused. `markOrdered` then moves the project to `ordered`, and the project id and revision go into the order notes.
- The server prices from its own STL and stats sidecar (`src/lib/orderPricing.ts`); no browser price is read. Open or non-manifold meshes and parts that do not fit the 220 x 220 x 250 mm bed become manual quotes.
- Template lines are rebuilt from the template id and cfg on the server and repriced; the browser's price is ignored (the cart also drops stale template configs). At most 6 configured template lines per order.
- The customer approves; the owner still reviews every order at `pending_review`.

## Flight simulation (Simulate) and its accuracy

Pure TypeScript in `src/lib/flight/`: mass, CG and inertia of the printed mesh (Eberly signed tetrahedra) plus point masses; rotor thrust/current/rpm interpolated from measured bench points, extrapolated by T = k rpm^2 outside the tested range; static hover trim (4 x n allocation about the CG, quad-X layout, props-in).

Assumptions: air density 1.225 kg/m3; shaft efficiency 0.75 (only sets the yaw coefficient); printed-part density = material density x 0.4 fill factor; typical part masses for unknown parts. No drag, ground effect, frame flex, controller or dynamics; no arm-stress numbers.

Accuracy statement shown in the HUD: "Indicative estimate, not a flight guarantee. Thrust and current come from one independent bench test (+/-10-20%, about 16 V). Torque, response and battery sag are modelled with assumed values. No drag, ground effect or frame flex. Printed-part mass assumes uniform 40% fill; thin arms may weigh more." Weigh the real part before trusting a hover figure.

## Known limits

- AI designs are built from primitive shapes (boxes, cylinders, holes); quality is limited to that vocabulary.
- Uploaded meshes (STL) are scale-only: no shape edits, only the longest side.
- Mass uses a fixed 40% fill-factor estimate.
- One sourced motor dataset (GEPRC SpeedX GR2306 2450kv on a 5x5x3 prop, MQTB bench) plus a TT gear motor; other motors need curated data first.
- Template hole sizes (screw, board and motor patterns) are from memory, not from datasheets: test-print before selling.
- The per-project lock is process-local; two server instances need a database lock.

## Design projects (blueprint-first flow)

Projects live in the `designs` namespace (`designs/<uuid>.json`); a finalized one also wrote its STL and `.stats.json` into `uploads/`. Lifecycle: draft -> approved -> finalized -> ordered. The customer approves; the owner still reviews the order at `pending_review`. Orders carry the project id and revision in the notes.

Caps (env, see `.env.example`): `AI_REVISIONS_PER_PROJECT` (default 5 AI revisions per project), `AI_DAILY_PER_EMAIL` (default 20 AI calls per email per UTC day for this flow). A repeated request (same normalised text on the same blueprint) is served from `design-cache/` and does not count. `AI_DESIGN_TIER` picks the model tier (default `mid`). Without an AI key, templates and manual edits work and AI routes answer 503 "AI is not configured". The Meshy source is offered only when `MESHY_API_KEY` is set (`GET /api/designs` reports `meshy`). Uploaded meshes are scale-only (STL).

`npm run designs:prune` deletes projects never ordered and older than 30 days, with their STL. Run it weekly (cron or by hand).

## Deploy (Vercel)

See the README. The first deploy is a manual step by the owner: import the repo under the personal Vercel account, add the private Blob store and env vars, then check the smoke test on the preview URL before sharing it.

## Live deployment

- URL: https://printpro3d.vercel.app (Vercel project `printpro3d`, personal account, Hobby plan, deploys from `main`).
- Env set in Vercel: `ADMIN_TOKEN`, `SITE_URL`, and from the private Blob store `printpro3d-blob`: `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`. Not yet set: AI, Meshy and Resend keys. Last pushed commit on origin/main: 3de4d31; later work is local only (see the tracker).
- Vercel blocks deploys of vulnerable Next.js versions (15.3.5 was refused). The project is now on Next 16.4.
- Hobby is for non-commercial use and caps function time at 60 s. Check Vercel's terms and move to Pro before taking paid orders.
- Env var changes need a redeploy (push a commit or use Redeploy on a deployment).

## Git

Remote: `https://github.com/pathakvikash/printpro3d`. Use the `pathakvikash` account only. The machine's default git email may be the work one: set a repo-local author before committing and push with the personal token, never through the work login.

## Service area and INTEGRATOR NOTE

Source of truth: `src/lib/business.ts` (India only for now, base Patna, Bihar). Footer shows it. Orders carry `country`, `state`, `pin` (validated in `src/lib/shipping.ts`). Pages that should mention the service area later, once the owner gives details: `/contact` (location, pickup), `/how-it-works` (delivery FAQ: India only), `/quote` and `/shop` (delivery note), `/about`. Do not invent address, pin, phone, pickup or delivery times.

CI: `.github/workflows/ci.yml` runs `npm ci`, tsc, `npm test` and `npm run build` (Turbopack) on every push and PR, so Vercel-only build failures show up on GitHub first; this Mac cannot run Turbopack's build.
