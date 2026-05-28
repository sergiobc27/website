# IDEAM Web Architecture

## Goal

`ideam.sergiobc.com` lets users query IDEAM datasets hosted on Socrata and download organized ZIP exports without running Python or local scripts.

## Runtime Flow

1. Cloudflare routes `ideam.sergiobc.com/*` to the `ideam` Worker.
2. Static React/Vite assets are served through Workers Assets.
3. `/api/*` requests execute in `src/worker/index.js`.
4. The Worker queries `https://www.datos.gov.co/resource/<dataset>.json`.
5. Advanced filter catalogs are read from R2 when warm.
6. Export jobs run through Durable Objects and write temporary ZIP files to R2.
7. R2 lifecycle deletes `exports/` objects older than 1 hour.

## Main Modules

- `src/worker/index.js`: Worker routes, Socrata queries, export planning, Durable Objects.
- `src/worker/catalogConfig.js`: dataset, department and catalog-filter definitions.
- `src/shared/ideamContracts.ts`: shared frontend API response contracts.
- `src/app/components/DataExtractor.tsx`: current extraction workflow UI.
- `src/app/lib/ideamApi.ts`: frontend API client and JSON/error handling.
- `tests/worker.test.mjs`: Worker unit and integration-style tests with mocked bindings.
- `tests/e2e/ideam-production.spec.ts`: production smoke test for API/catalog/job/ZIP.

## Cost Controls

- Global downloads are blocked; each export requires at least one valid department.
- Export creation is rate-limited to 30 requests per hour per IP.
- ZIP files are compressed and stored under `exports/<jobId>/`.
- Downloads remain available during the 1-hour TTL.
- The lifecycle policy only targets `exports/`, not persistent catalog cache objects.

## Known Engineering Debt

- `src/worker/index.js` is still large and should continue moving toward smaller route/service modules.
- `DataExtractor.tsx` remains the largest frontend file and should continue being split into hooks.
- Generated unused UI components under `src/app/components/ui` are excluded from typecheck until either installed or removed.
