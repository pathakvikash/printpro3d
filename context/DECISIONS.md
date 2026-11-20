# Decisions and why

| Decision | Why |
| --- | --- |
| One guided page, no per-feature pages or nav | Owner asked for auto-navigation; separate empty pages scored the product 3/10 |
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

## Owner standing instructions

- Decide design and report; ask before commit, push, deploy, publish or spending money.
- Personal project: use GitHub account `pathakvikash` only (never the Lyric account or Lyric email).
- Confirm the UI builds and renders correctly before posting live.
- Keep the site fast; mobile first.
