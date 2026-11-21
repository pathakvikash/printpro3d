# PrintPro3D: context for the next AI

Read this file, then only the file for your task. Total reading time: a few minutes.

## What this is

A made-to-order 3D printing storefront run by one owner (Vikash, personal project, GitHub `pathakvikash`; not a Lyric project, never use the Lyric account or email for it). Customers get a price from a model file, a ready item, a builder design or an AI drawing, check out once, and track the order. The owner prints and ships by hand.

Ambition: a long-term 3D-printing business (games, gadgets, electronics frames, toys with motors, RC bodies, drones; one piece to wholesale). Keep the site fast and plain; it should look like a parts seller, not an AI template.

You are the maintainer. The owner delegated design decisions; still ask before pushing to remote, deploying, spending money or publishing.

## Files in this folder

| File | Read when |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | You change code: layout, flows, pricing, storage, AI, security rules |
| [DECISIONS.md](DECISIONS.md) | You wonder "why is it like this" before changing something |
| [GAPS.md](GAPS.md) | You pick the next piece of work, or owner actions that block go-live |
| [OPERATIONS.md](OPERATIONS.md) | You run, test, deploy or support it |

## Ten facts that save time

1. Next.js 15 App Router, React 19, TypeScript, Tailwind 4, three.js via @react-three/fiber. Node 22.18+ (tests run `.ts` directly).
2. Real pages with a nav bar (since 2026-11-21): `/quote` (file), `/request` (idea), `/ai`, `/draw`, `/shop`, `/build`, `/track`, `/materials`, `/how-it-works`, `/contact`, plus `/admin`. `/` is the landing page. Old `/?start=<step>` and `/upload` redirect. Each page is a server `page.tsx` mounting one component inside `PageShell`.
3. Pure logic lives in `src/lib` with tests next to it (`*.test.ts`, run by `npm test`). Import with explicit `.ts` extensions.
4. The server recomputes every price (`src/lib/quote.ts`, `src/lib/catalog.ts`). Browser prices are display only.
5. All storage goes through `src/lib/store.ts`: local disk, Vercel Blob, or `/tmp` (ephemeral, demo only).
6. Prices, rates and the 220x220x250 mm bed are placeholders until the owner sets them.
7. 3D code is lazy loaded; the home page ships ~110 kB JS and no 3D on phones. Keep it that way: check the build table after UI changes.
8. Dark mode uses Tailwind 4 `@custom-variant dark` plus a pre-paint script in `layout.tsx`. Do not rely on `tailwind.config` `darkMode`.
9. Never put real keys in code. AI keys are server-side. The `claude-cli` AI provider is development only.
10. Do not run `next build` while `next dev` or `next start` is using `.next`.

## Checks before you say you are done

```bash
npx tsc --noEmit -p .
npx eslint src scripts
npm test
npm run build        # stop any dev/start server first
```

Then open the production build and click through the flow (see OPERATIONS.md).
