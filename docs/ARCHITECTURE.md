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

- `src/worker/index.js`: Worker entry module — routes, `/api/*` proxy, chat/email handlers, R2 files. It exports **only** `export default { fetch }`: workerd refuses to start when the entry module has a named export (`Incorrect type for map entry '<NAME>': the provided value is not of type 'function or ExportedHandler'`), which breaks `wrangler dev` even though `wrangler deploy --dry-run` still passes. Anything a test needs to import on its own belongs in one of the modules below.
- `src/worker/chatPrompt.js`: assistant system prompt, citable sources, deterministic post-processing (`ensure*`) and the anti-manipulation guardrail.
- `src/worker/chatSession.js`: HMAC-signed chat session (TTL and per-session message cap).
- `src/worker/chatData.js`: "ask your data" pipeline (intent extraction, mirror queries, suggestions).
- `src/worker/proxyHeaders.js`: outbound header allowlist and proxy-secret injection for the box.
- `src/worker/idfPdfDoc.js`: IDF PDF generated inside the Worker for the email flow.
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
