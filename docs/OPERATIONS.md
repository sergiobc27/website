# IDEAM Operations

## Local Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

If local `npm` is broken on Windows, run the npm CLI through Node:

```bash
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
```

## Cloudflare Setup

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Recommended Worker secret:

- `SOCRATA_APP_TOKEN`

Configure it with:

```bash
npx wrangler secret put SOCRATA_APP_TOKEN
```

## Verification

```bash
npm run check
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
npm run e2e:prod
```

## Deployment

Direct pushes to `main` are blocked by a branch ruleset; merging a PR into `main`
triggers `.github/workflows/deploy-ideam.yml`.

The workflow has two jobs.

Build:

1. installs dependencies,
2. checks Worker syntax (`npm run check`),
3. typechecks frontend TypeScript,
4. runs Worker tests (`npm test`),
5. runs frontend unit tests (`npm run test:unit`),
6. audits production dependencies (`npm audit --omit=dev`),
7. builds the frontend,
8. validates the Worker bundle (`wrangler deploy --dry-run`).

Deploy (only if the Cloudflare secrets are present):

9. syncs the Worker secrets (`IDEAM_PROXY_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`),
10. deploys the Worker to Cloudflare,
11. runs a production smoke test (non-blocking).

## Troubleshooting

- `Unexpected token '<'`: the frontend received HTML instead of API JSON. Confirm the request path starts with `/api/` and the Worker route is active.
- `429 Too Many Requests`: the IP exceeded 30 export jobs per hour.
- Empty ZIP with no data: filters are valid but produced zero rows in Socrata for the selected dataset/date/territory.
- Wrangler auth errors locally: run `wrangler login` or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- `wrangler dev` dies at startup with `service core:user:ideam: Uncaught TypeError: Incorrect type for map entry '<NAME>': the provided value is not of type 'function or ExportedHandler'`: the entry module (`src/worker/index.js`) has a named export again. workerd treats every export of the entry module as a handler, so a constant or helper exported "just for the tests" stops the runtime from booting — and `wrangler deploy --dry-run` does **not** catch it, since it only bundles. Move the symbol to a sibling module (`chatPrompt.js`, `chatSession.js`, `proxyHeaders.js`, `chatData.js`) and import it from the tests there; `index.js` must keep only `export default { fetch }`.
- `The directory specified by the "assets.directory" field ... does not exist`: `dist/` is missing. Run `npm run build` before `wrangler dev` or `wrangler deploy --dry-run`.
