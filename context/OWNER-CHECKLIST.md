# Owner checklist

Only the owner can supply or do these. Nothing here is invented in code; the site hides anything left empty.

## Accounts and keys

- [ ] Vercel: private Blob store connected (`BLOB_READ_WRITE_TOKEN`), `SITE_URL` (live URL). Done on the live site; re-check after any change. Env changes need a redeploy.
- [ ] Resend: `RESEND_API_KEY`, `ORDER_NOTIFY_TO`, `ORDER_NOTIFY_FROM` (real sending untested).
- [ ] Admin login (Google, only you): Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application. Authorised redirect URIs: `https://printpro3d.vercel.app/api/auth/callback/google` and `http://localhost:3001/api/auth/callback/google`. Then set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` (`npx auth secret` or `openssl rand -base64 32`) and `ADMIN_EMAILS` (your Google email; comma-separated for more) in Vercel Production and `.env.local`, then redeploy. `/admin` and `/settings/ai` (account menu, footer) show "Sign in with Google". `ADMIN_TOKEN` is now optional: only for scripts such as `npm run order:status`. AI provider is Auto; the Claude Code CLI works only when running locally.
- [ ] AI for the blueprint flow: `ANTHROPIC_API_KEY`, or `AI_PRESET` + `AI_API_KEY` + `AI_MODEL`. Optionally `AI_DESIGN_TIER` / `AI_DESIGN_MODEL`.
- [ ] Meshy: `MESHY_API_KEY` (paid plan) to offer the Meshy source.

## Business details (public, optional until you decide)

- [ ] WhatsApp number (`NEXT_PUBLIC_WHATSAPP_NUMBER`) and phone (`NEXT_PUBLIC_PHONE`)
- [ ] Business name, city (`NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_BUSINESS_CITY`), address on `/about` and `/contact` (marked `// OWNER:`)
- [ ] Patna base details still pending: full address and PIN, phone, whether local pickup exists, delivery times and charges (decided so far: India only, base Patna, Bihar; see `src/lib/business.ts`)
- [ ] GSTIN (`NEXT_PUBLIC_GSTIN`), or state "not registered"

## Content

- [ ] Photos of printed parts in `public/photos` (see its README), then set `photo` in `src/lib/catalog.ts`
- [ ] Real prices: `src/lib/quote.ts` (materials, setup fee, minimum) and `src/lib/catalog.ts` (sample prices today)
- [ ] `marketLinks` per template in `src/lib/templateDefs.ts` (empty today)
- [ ] Showcase STLs in `public/models/showcase/` (check each licence)
- [ ] Refund, shipping, privacy and terms policies (none exist yet); confirm the files-handling sentence in `src/app/page.tsx`
- [ ] Test-print templates before selling: hole sizes were set from memory

## Operations

- [ ] Delete the GitHub repo `pathakvikash/printpro3d-v2` at https://github.com/pathakvikash/printpro3d-v2/settings (one repo per project)
- [ ] Move to Vercel Pro before taking paid orders (Hobby is non-commercial, 60 s function cap; finalize and AI routes use up to 60 s)
- [ ] Run `npm run designs:prune` weekly
- [ ] If npm reports cache permission errors: `sudo chown -R 501:20 ~/.npm`
- [ ] Review the local commits after `3de4d31`, then say when to push and deploy

## Decisions to confirm

- [ ] Layer height 0.2 mm (assumed, not set in code)
- [ ] AI tier (`mid` default) and caps: 5 revisions per project, 20 per email per day, 200 per day total
- [ ] Setup fee per line vs per order (open from before)
