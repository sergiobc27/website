# AGENTS.md - IDEAM Hydrology Data Automator

## Purpose

This file gives AI coding agents the minimum complete context needed to work safely and productively on this project.

The project is a web application for `https://ideam.sergiobc.com` that lets non-technical users query, filter, organize, and download hydrology data from IDEAM datasets published through Socrata / Open Data Colombia.

The product goal is not only to download data. The goal is to automate a complete workflow that would otherwise require local scripts: choose a hydrologic variable, select geographic and advanced filters, generate exports, organize files, show operational progress, and deliver a clean ZIP for later analysis.

## Core Product Goals

- Provide a browser-based workflow so users do not need Python, terminal commands, or local setup.
- Query IDEAM public datasets from Socrata safely and predictably.
- Require meaningful filtering before export, especially by department.
- Support CSV, JSON, and Parquet exports.
- Deliver one organized ZIP per export.
- Keep the user informed with progress, elapsed time in seconds, processed rows, generated formats, and availability status.
- Keep operating cost as close to `$0.00/month` as possible.
- Avoid storing full raw historical datasets unless a future architecture explicitly accepts the storage cost.

## Technical Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| Backend/API | Cloudflare Workers |
| Stateful jobs | Cloudflare Durable Objects |
| Temporary storage | Cloudflare R2 |
| Data source | Socrata SODA API / IDEAM Open Data Colombia |
| Deployment | GitHub Actions, Wrangler |
| Tests | Node test runner, TypeScript check, Vite build, Playwright smoke tests |

## Main Repository Context

- Main web repository: `https://github.com/sergiobc27/website`
- Production domain: `https://ideam.sergiobc.com`
- Earlier Python/pipeline repository: `IDEAM-Hydrology-Data-Automator`
- The web app is the product surface that should contain the operational workflow for end users.

## Critical Product Rules

Do not break these rules without explicit user approval.

1. Exports must require at least one valid department.
2. Do not allow global downloads of an entire dataset without filters.
3. Keep Parquet support. Do not remove it.
4. Export results must be delivered as one ZIP whenever possible.
5. The ZIP filename must follow `variable_DDMMYYYY.zip`.
6. The ZIP internal structure should follow:
   `variable/departamento/municipio/formato/archivo`
7. Example internal path:
   `precipitacion/atlantico/barranquilla/csv/precipitacion_atlantico_barranquilla_HHMM_DDMMYY.csv`
8. Separate formats inside the ZIP into `csv`, `json`, and `parquet` subfolders.
9. Do not delete the R2 object immediately after the first download.
10. The user should be able to download an available file multiple times during its availability window.
11. R2 files are temporary and should expire automatically, currently around 1 hour.
12. Do not embed Cloudflare, Socrata, GitHub, or other secrets in source code.
13. Keep logs useful but bounded; do not let repeated errors flood the UI.
14. Show time values to users in seconds, not milliseconds.

## Important Files

| File | Purpose |
| --- | --- |
| `src/worker/index.js` | Main Cloudflare Worker API, Socrata queries, export jobs, ZIP generation, catalog cache handling. |
| `src/shared/ideamContracts.ts` | Shared frontend/backend contracts and types. |
| `src/app/lib/ideamApi.ts` | Frontend API client for the Worker endpoints. |
| `src/app/components/DataExtractor.tsx` | Main extraction workflow UI. |
| `src/app/components/Dashboard.tsx` | Dashboard metrics and operational overview. |
| `src/app/components/DownloadHistory.tsx` | Download history and available exports. |
| `src/app/components/Navbar.tsx` | Top navigation and global status indicators. |
| `src/app/components/Sidebar.tsx` | Sidebar navigation. |
| `wrangler.jsonc` | Cloudflare Worker, R2, Durable Object, vars, and cron configuration. |
| `.github/workflows/deploy-ideam.yml` | CI/CD workflow for build, deploy, catalog warm, and smoke tests. |
| `scripts/warm-catalog-bundles.mjs` | Script for warming catalog cache. |
| `tests/worker.test.mjs` | Worker unit tests. |
| `tests/e2e/ideam-production.spec.ts` | Production smoke/e2e checks. |

## Worker API Overview

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Health check. |
| `/api/meta` | GET | Public metadata/configuration for datasets. |
| `/api/date-range` | GET/POST | Available date ranges. |
| `/api/catalog-bundle` | POST | Cached advanced filter catalog bundle. |
| `/api/catalog-options` | POST | Specific catalog options. |
| `/api/stations-helper` | POST | Station/filter helper. |
| `/api/coverage` | POST | Coverage calculation when applicable. |
| `/api/preview` | POST | Small preview query. |
| `/api/export-plan` | POST | Builds the export plan and estimates. |
| `/api/export-page` | POST | Fetches one page of export data. |
| `/api/jobs` | POST | Creates an asynchronous export job. |
| `/api/jobs/:id` | GET | Reads job status/progress. |
| `/api/jobs/:id/parts/:n` | GET | Downloads generated result while available. |
| `/api/export` | POST | Legacy direct export route; should stay disabled if async flow is required. |

## Current Architecture

The system uses a hybrid architecture:

```text
User browser
  -> React/Vite frontend
    -> Cloudflare Worker API
      -> R2 catalog cache for repetitive UI filter data
      -> Socrata SODA API for real observation data
      -> Durable Object for export job state
      -> Durable Object for rate limiting
      -> R2 for temporary ZIP storage
    -> Download URL available during the configured TTL
```

The app should not cache or store all raw IDEAM historical observations by default. Some datasets are extremely large, and full replication could break the cost goal. Instead, the app caches metadata/catalogs and queries Socrata for real export data.

## Catalog Cache Strategy

Advanced filter options should feel instant to the user. Avoid forcing the user to wait for live Socrata aggregation whenever possible.

Current/expected cache behavior:

- Catalog cache is stored in R2.
- Cache prefixes include:
  - `catalog-cache/bundles`
  - `catalog-cache/options`
  - `catalog-cache/date-ranges`
- `CATALOG_CACHE_VERSION` is used to invalidate old cache shapes.
- UI should call `/api/catalog-bundle` after dataset/department selection.
- If cache exists, return `200` quickly, usually with an `x-ideam-cache` style marker.
- If cache is missing, return a controlled pending state and warm in the background.
- A cron/warming script should keep important catalog combinations fresh.
- Use lightweight metadata/station datasets for UI catalogs where possible.
- Use heavy observation datasets only for preview/export of real data.

Important historical decision:
Socrata aggregations over very large observation datasets caused slow responses/timeouts. For advanced UI lists, prefer cached metadata or station catalog sources rather than live aggregation over hundreds of millions of rows.

## Export Strategy

Exports are asynchronous.

Expected flow:

1. Frontend validates required fields.
2. Worker validates again server-side.
3. Worker builds an export plan.
4. Durable Object creates and tracks the job.
5. Worker fetches pages from Socrata with controlled page size and concurrency.
6. Rows are normalized and serialized to selected formats.
7. A final ZIP is generated with stable internal hierarchy.
8. ZIP is written to R2 with a temporary TTL/lifecycle policy.
9. Frontend polls job status and enables download when ready.
10. Download remains available until expiration.

Avoid loading massive result sets into memory at once. Prefer paging, bounded buffers, controlled concurrency, and resumable job state.

## Data And ZIP Naming

ZIP filename:

```text
variable_DDMMYYYY.zip
```

Internal structure:

```text
variable/
  departamento/
    municipio/
      csv/
        variable_departamento_municipio_HHMM_DDMMYY.csv
      json/
        variable_departamento_municipio_HHMM_DDMMYY.json
      parquet/
        variable_departamento_municipio_HHMM_DDMMYY.parquet
```

If one municipality is not selected or the export groups multiple municipalities, use the best available hierarchy without mixing all files at the ZIP root.

## Socrata Query Guidelines

- Always validate `datasetId` against known configuration.
- Always validate department input against canonical department mappings.
- Normalize text to handle accents, casing, mojibake, and common variants.
- Avoid global count/export queries.
- Use `$limit` and `$offset` or another stable paging strategy supported by Socrata.
- Prefer explicit `$select` fields instead of fetching unnecessary columns.
- Use server-side filters in Socrata query parameters where possible.
- Add timeout handling and clear error mapping.
- Treat HTML responses from API routes as routing/deployment/cache errors, not valid data.
- Do not retry forever. Use bounded retries/backoff for transient errors.

## Known Error Patterns To Handle

| Error | Likely meaning | Expected handling |
| --- | --- | --- |
| `Unexpected token '<'` | HTML returned where JSON was expected. Could be wrong route, SPA fallback, cached page, or bad deploy. | Detect response content type/status, show clear UI message, log route and status. |
| `Socrata timeout` | Query too broad or Socrata too slow. | Partition query, reduce page size, retry bounded, tell user which segment failed. |
| `Provided readable stream must have a known length` | Worker/R2 response or upload stream issue. | Ensure generated body has known length or use Cloudflare-compatible stream handling. |
| `null pointer passed to rust` | Often serialization/Parquet/wasm/native edge case or invalid data passed into library. | Validate rows before serialization, isolate format, add test case for failing payload. |
| Empty ZIP after successful job | Plan produced no rows, filters mismatched, or output creation skipped. | Fail with explicit no-data state and expose query summary. |

## Frontend UX Requirements

The page should behave like a guided workflow.

- Keep the main configuration controls visible and easy to reach.
- Avoid making the user scroll to the bottom before configuring essential filters.
- Preserve filter state and active downloads when navigating between dashboard sections.
- Show a global active-download indicator in the top bar.
- Keep advanced filters dependent on selected dataset/department.
- Do not show filter options that do not apply to the selected dataset/department.
- Show progress visually and numerically.
- Prefer seconds for elapsed/estimated time.
- Do not spam the operational log with repeated identical errors.
- Help/profile buttons should have real functionality or be removed/replaced.
- Sidebar expanded/collapsed states should not break icons or labels.

## Metrics Worth Showing To Users

- Rows processed.
- Total estimated rows, when available.
- Pages completed and total pages, when available.
- Percentage complete.
- Elapsed time in seconds.
- Estimated remaining time once enough progress samples exist.
- Number of departments, municipalities, stations, and zones included.
- Output formats generated.
- Estimated or final ZIP size.
- Download expiration time.
- Cache freshness for advanced filter catalogs.

## Cost And Abuse Constraints

- Keep the default architecture low-cost/free-tier friendly.
- Do not store full raw datasets in R2/D1 unless explicitly approved.
- Enforce export rate limiting, currently expected around 30 export requests/hour/IP.
- Require department filter to reduce accidental or abusive massive exports.
- Use R2 lifecycle expiration for generated ZIPs.
- Add no-index/security headers on download routes where appropriate.
- Avoid expensive cron jobs that scan all raw observations too frequently.

## Security Rules

- Never commit API tokens, Cloudflare tokens, Socrata app tokens, GitHub tokens, or secrets.
- Use Cloudflare secrets and GitHub Secrets for deployment credentials.
- Keep `.env.example` documented but without real values.
- Validate all user-controlled filters server-side.
- Restrict dataset IDs to configured allowlists.
- Sanitize generated filenames and ZIP paths.
- Avoid path traversal inside ZIP entry names.
- Avoid logging secrets or full signed download URLs.

## Testing Commands

Run these before proposing a production deploy when relevant:

```bash
node --test tests/worker.test.mjs
node --check src/worker/index.js
node --check scripts/warm-catalog-bundles.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

If Cloudflare credentials are available and the change touches Worker configuration:

```bash
npx wrangler deploy --dry-run
```

If the change touches production behavior, run or update the Playwright smoke tests:

```bash
npx playwright test tests/e2e/ideam-production.spec.ts
```

## Development Guidelines For AI Agents

Before editing:

1. Read the relevant files first.
2. Identify whether the change is frontend, Worker, cache, export, deployment, or tests.
3. Preserve existing user changes and do not reset the worktree.
4. Explain risky architecture changes before implementing them.
5. Prefer small, incremental changes with tests.

When editing:

- Follow existing code style.
- Keep API contracts explicit in `ideamContracts.ts` when shared with frontend.
- Avoid duplicating normalization logic in frontend and backend.
- Do not add new dependencies unless they solve a real problem and work in Cloudflare Workers.
- Be careful with Node-only libraries; the Worker runtime is not a full Node.js server.
- Avoid memory-heavy operations in Workers.
- Keep user-visible Spanish copy clear and professional.

When done:

- Run the smallest useful test set first.
- Run broader checks for Worker/export/frontend changes.
- Summarize what changed, what was tested, and any remaining risk.
- Do not claim production works unless deployed and smoke-tested.

## Recommended Future Improvements

- Add `/api/catalog-status` to inspect cache readiness by dataset and department.
- Add a dashboard widget for catalog freshness and last warm time.
- Add precomputed lightweight count indexes by dataset/department/month.
- Improve progress reporting with rows processed, page count, bytes generated, and ETA.
- Add clearer no-data diagnostics that show which filters produced zero rows.
- Add tests for ZIP internal path structure and filename sanitization.
- Add tests for CSV, JSON, and Parquet generation using realistic IDEAM rows.
- Split large frontend bundles if Vite reports chunk warnings.
- Add docs under `docs/architecture.md`, `docs/api.md`, `docs/catalog-cache.md`, and `docs/export-jobs.md`.

## Non-Goals Unless Explicitly Approved

- Do not build a full raw data warehouse of all IDEAM observations by default.
- Do not move the whole system away from Cloudflare without an architecture decision.
- Do not remove the async job model to return massive files directly from one request.
- Do not remove R2 temporary ZIP storage unless replacing it with an equivalent download mechanism.
- Do not remove advanced personalization filters.
- Do not hide errors silently; errors should be clear, bounded, and actionable.

## Quick Mental Model

This is a low-cost, serverless, Socrata-backed export automation system. The frontend should feel instant for configuration because catalogs are cached. The backend should only spend real time on the actual requested export. Large exports must be processed in bounded async jobs, not as one blocking request. The final user value is a clean, organized ZIP that saves time and avoids manual data preparation.
