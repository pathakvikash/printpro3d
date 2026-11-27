# Known gaps and next work

## Owner actions that block going live

The full grouped list is in [OWNER-CHECKLIST.md](OWNER-CHECKLIST.md). Everything after `3de4d31` is local, not pushed or deployed.

1. Create a **private** Vercel Blob store and connect it to the project (sets `BLOB_READ_WRITE_TOKEN`).
2. Set `ADMIN_EMAILS` and the `AUTH_*` Google sign-in vars, `SITE_URL`, and for emails `RESEND_API_KEY`, `ORDER_NOTIFY_TO`, `ORDER_NOTIFY_FROM`.
3. For AI: `ANTHROPIC_API_KEY` (or `AI_PRESET` + `AI_API_KEY` + `AI_MODEL`) and `MESHY_API_KEY`.
4. Set real prices in `src/lib/quote.ts` (materials, setup fee, minimum) and `src/lib/catalog.ts` (shop items are sample prices).
5. Confirm copy: "We use your files only to quote and print your order." and the files line in `page.tsx` marked `// OWNER:`.
6. Download the showcase STLs from Thingiverse manually into `public/models/showcase/` (check each licence; skip the gears set until its parent licence is confirmed).

## Owner data needed: materials and laser

Materials for sale and laser cutting are enquiry-only until the owner gives: prices; brands; filament colours and spool sizes; resin types and bottle sizes; sheet sizes, thicknesses and colours; stock; laser bed size, laser power and what it can cut or engrave; laser rates (cut time, engrave area, setup, minimum). Then add them to `src/lib/supplies.ts` and the `/laser` page.

Made to order (`src/lib/madeToOrder.ts`, `/shop#made-to-order`) is also enquiry-only, original designs only (no licensed characters, team or league logos, resold STLs). Per item the owner still gives: a price or price rule, a real photo of a made sample, and a design file or template (the `needs` list per item in the file; today every item needs all three). Also owner decisions: which Devanagari fonts for name signs, lead times, and whether lithophane and photo keychains need a photo upload step.

## Not built

| Gap | Note |
| --- | --- |
| Online payment | Add Razorpay/UPI or Stripe; today the owner sends a payment link and sets `awaiting_payment` then `paid` |
| Direct-to-Blob upload verified on a real store | Built, tested with fakes only |
| Admin extras | No search, pagination (lists all records per call), notes, or CSV export |
| Order storage in a database | Blob JSON is fine for tens of orders; move to Postgres/SQLite when volume grows |
| Community models gallery | Needs licensed files first |
| Setup fee per order instead of per line | Owner decision |
| Client-side re-quote after quantity change | Server quotes it manually today (shows "We'll quote this one") |
| CAPTCHA | Add Cloudflare Turnstile if the honeypot and limits are not enough |
| Accounts and order history across devices | Orders are tracked by id |
| Shipping and tax | Not modelled |

## Known limits (blueprint flow)

AI shapes are primitives only; uploaded meshes are scale-only; mass uses a 40% fill estimate; one sourced motor dataset; template hole sizes from memory; no live push or live verification of the new flow yet.

## Unverified

- Real calls to Anthropic, OpenAI-compatible providers, Meshy and Resend (stubs and unit tests only). The AI chat, refine and admin Test/List were checked against a local fake OpenAI-compatible server only; the Meshy tab in the chat was not shown (no `MESHY_API_KEY` locally).
- AI chat: one chat per tab (sessionStorage); the saved email cannot be changed in the chat yet (clear site data); only the latest design gets a 3D preview.
- `claude-cli` provider (sandbox blocked the test; dev only anyway).
- Hero 3D part at full desktop width, Safari, light mode visuals, keyboard focus on material cards.
- Meshy download host: any `*.meshy.ai` is allowed; narrow it once the real asset host is known.
- Vercel function time caps (`maxDuration` up to 120 s on the size route) depend on the plan.
