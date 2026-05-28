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

Push to `main` triggers `.github/workflows/deploy-ideam.yml`.

The workflow:

1. installs dependencies,
2. checks Worker syntax,
3. typechecks frontend TypeScript,
4. runs Worker tests,
5. audits production dependencies,
6. builds frontend,
7. applies R2 lifecycle,
8. deploys the Worker,
9. warms catalog bundles,
10. runs a production smoke test.

## Troubleshooting

- `Unexpected token '<'`: the frontend received HTML instead of API JSON. Confirm the request path starts with `/api/` and the Worker route is active.
- `429 Too Many Requests`: the IP exceeded 30 export jobs per hour.
- Empty ZIP with no data: filters are valid but produced zero rows in Socrata for the selected dataset/date/territory.
- Wrangler auth errors locally: run `wrangler login` or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
