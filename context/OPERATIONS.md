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

Do not build while `next dev` or `next start` runs from the same folder; stop it first.

## Smoke test of a production build

1. Home loads, no console errors; header theme toggle switches light and dark and survives reload.
2. Upload a small closed STL: size, volume and four material prices appear; Add to cart.
3. Shop: seven cards with 3D previews, View in 3D opens a dialog (Escape closes), save and add to cart.
4. Build: add a box and a hole, price updates, add to cart.
5. Cart drawer: change quantity (a model line becomes "We'll quote this one"), checkout with a test contact.
6. Track: use the new order id; the demo order shows all stages.
7. `/admin`: wrong token is refused, right token lists the order; change status; the customer email is logged or sent.
8. Phone width (375 px): no horizontal scroll, no 3D canvas on the home hero.

## Data

Local data folders (gitignored): `uploads/`, `orders/`, `requests/`, `ai-jobs/`, `ai-usage/`, `ratelimit/`. Delete test data freely in development. On Vercel the data is in the private Blob store.

## Owner commands

```bash
npm run order:status -- <order-id> <status>   # also emails the customer
npm run ai:models                             # models the configured provider offers
```

## Deploy (Vercel)

See the README. The first deploy is a manual step by the owner: import the repo under the personal Vercel account, add the private Blob store and env vars, then check the smoke test on the preview URL before sharing it.

## Git

Remote: `https://github.com/pathakvikash/printpro3d`. Use the `pathakvikash` account only. The machine's default git email may be the work one: set a repo-local author before committing and push with the personal token, never through the work login.
