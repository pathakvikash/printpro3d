# Decisions and why

| Decision | Why |
| --- | --- |
| Split into real pages with a nav bar, 2026-11-21 | Owner asked for it; the URL used to be state (`/?start=`), now each feature has its own route and old links redirect |
| Orders saved as `pending_review`, price shown as estimate | Flipped or overlapping meshes can under-count volume; owner confirms before payment |
| Manual payment for now (owner sends link or UPI request) | Online payment needs the owner's Razorpay/Stripe account |
| Server recomputes prices | Client totals can be forged |
| Cart and saved list in localStorage, no accounts | Fastest route to a first order; accounts later |
| Local disk first, `store.ts` abstraction, Vercel Blob in production | Vercel's disk is read-only; swap backend without touching routes |
| Random upload names, uploads not listable | Guessable links leaked customer models |
| Meshy for AI generation; Anthropic API for "Draw it with AI" | Meshy approved by owner; Anthropic gives structured shape JSON |
| `claude-cli` provider dev only | Anthropic terms: do not serve customers through a personal subscription login |
| Per-email and global daily AI limits, counted before the paid call | A race let parallel requests bypass limits and spend money |
| Models from Thingiverse are not scraped | Cloudflare bot check; owner downloads manually and checks licences |
| Heavy 3D code behind `next/dynamic`; hero part only on wide screens | Home JS 407 kB to 110 kB; phones get no 3D |
| Tailwind 4 `@custom-variant dark` + pre-paint script | `tailwind.config` `darkMode` is ignored in Tailwind 4; dark mode only worked in one browser |
| Home page modelled on professional manufacturing marketplaces (Protolabs Network pattern): hero, facts bar, ready-to-print, how it works, materials | Owner wanted a real parts-seller look, not an AI template |
| Setup fee and minimum order apply per model line | Simple and safe; revisit as per-order if owner prefers |
| Admin via bearer token, no accounts | One owner; smallest safe surface |
| Honeypot + per-IP limits, no CAPTCHA | No third-party dependency; add Turnstile if abuse appears |
| Blueprint-first flow: approve a plan before any mesh is built (Fable-decided, 2026-11) | The customer sees and approves dimensions and parts first; an AI mistake costs a revision, not a print |
| One `/build` page replaces `/draw`, `/ai`, `/motor-test` (Fable-decided) | One flow with a stepper; old URLs redirect |
| Design lines orderable only when finalized; server reprices from its own STL (Fable-decided) | The browser cannot set a price or order an unbuilt design |
| Template prices recomputed server-side from id + cfg (Fable-decided) | Sizes change volume; client totals can be forged |
| AI revision cap 5 per project, 20 per email per day, 200 per day total (Fable-decided, owner to confirm) | Bounds paid calls; counted before the call; repeats are cached and free |
| Default AI tier `mid` (Sonnet 5.5) (Fable-decided, owner to confirm) | Structured blueprints need more than the low tier; high is a switch away |
| Prune unordered designs after 30 days, by command not cron (Fable-decided) | Keeps the store small; a command keeps it simple until a scheduler is chosen |
| Rules first, AI only re-ranks suggestions; positions re-validated server-side (Fable-decided) | Works without a key and an AI cannot place a part outside the frame |
| Flight model is a static, indicative estimate with one sourced motor dataset and a stated accuracy line (Fable-decided) | Nothing invented; labels say measured vs modelled |
| Uploaded meshes are scale-only (Fable-decided) | Editing arbitrary meshes needs a real CAD kernel |
| TypeScript held at 6.0 | typescript-eslint does not support 7 yet |
| One repo per project: no `printpro3d-v2` | Push to the existing repo; the stray v2 repo is to be deleted by the owner |
| Layer height 0.2 mm assumed in quotes and copy | Not in code; owner to confirm |

## Owner standing instructions

- Decide design and report; ask before commit, push, deploy, publish or spending money.
- Personal project: use GitHub account `pathakvikash` only (never the Lyric account or Lyric email).
- Confirm the UI builds and renders correctly before posting live.
- Keep the site fast; mobile first.

| India only, starting from Patna (Bihar), 2026-11-24 | Owner decision. One source: `src/lib/business.ts`. Checkout fixes country to India and requires a state (static list) and a 6-digit PIN, checked in the browser and in `/api/orders` (`src/lib/shipping.ts`). Street address, pin of the base, pickup and delivery times are NOT decided and must not be invented |
