# IDEAM Hydrology Data Web Automator

Repositorio publico del sitio `website`, incluyendo la aplicacion operativa de `ideam.sergiobc.com`.

## Superficies

- `sergiobc.com` y `www.sergiobc.com`: sitio personal base.
- `ideam.sergiobc.com`: frontend React/Vite + Cloudflare Worker API para automatizar descargas IDEAM desde Socrata.

## Arquitectura del proyecto (dos repositorios)

El proyecto completo vive repartido en dos repositorios que se comunican por HTTPS:

- **Este repo (`sergiobc27/website`)**: frontend React/Vite/TypeScript y el Cloudflare Worker (`src/worker/`) que sirve los assets, actua como proxy autenticado de `/api/*` hacia la API propia, y maneja en el edge el asistente IA (Workers AI), el envio del PDF de curvas IDF por correo (Resend + Turnstile) y los PDFs de fuentes (R2). Un push a `main` despliega el Worker `ideam` en `ideam.sergiobc.com`.
- **[`sergiobc27/ideam-data-automator`](https://github.com/sergiobc27/ideam-data-automator)**: paquete Python instalable (CLI y TUI para descargar datos del IDEAM), el ingestor del espejo de datos y la API FastAPI sobre PostgreSQL/TimescaleDB, corriendo en un servidor Oracle y expuesta unicamente via Cloudflare Tunnel como `ideam-api.sergiobc.com`.

Flujo de una consulta de la web:

1. Navegador -> Worker (edge): valida rutas publicas, inyecta el secreto del proxy y cachea catalogos.
2. Worker -> API FastAPI (box Oracle, via Cloudflare Tunnel).
3. API -> TimescaleDB: espejo local de las observaciones del IDEAM (fuente original: Socrata, `www.datos.gov.co`).

El documento extendido de arquitectura (tres capas, diagramas Mermaid) es `ARQUITECTURA-DEL-PROYECTO.md`, en la carpeta de trabajo `Github/` que contiene ambos repos.

Componentes de este repo:

- Frontend: React, Vite, TypeScript progresivo.
- Worker: proxy `/api/*`, asistente IA en el edge, correo IDF y fuentes en R2.
- Almacenamiento: R2 (PDFs de referencias), KV (rate limiting).

## Estructura

- `src/app/*`: interfaz React.
- `src/app/lib/ideamApi.ts`: cliente API del frontend.
- `src/shared/ideamContracts.ts`: contratos TypeScript compartidos para respuestas API.
- `src/worker/index.js`: Worker, proxy `/api/*` a la API propia, asistente IA, correo IDF y fuentes R2.
- `tests/worker.test.mjs`: pruebas del Worker.
- `tests/e2e/ideam-production.spec.ts`: smoke test productivo.
- `.github/workflows/deploy-ideam.yml`: CI/CD.
- `docs/ARCHITECTURE.md`: arquitectura tecnica.
- `docs/OPERATIONS.md`: operacion, despliegue y troubleshooting.

## Comandos

```bash
npm install
npm run check
npm run typecheck
npm test
npm run build
npm run e2e:prod
```

Validacion Cloudflare sin desplegar:

```bash
npx wrangler deploy --dry-run
```

## Variables Y Secrets

GitHub Actions requiere:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Worker secret recomendado:

- `SOCRATA_APP_TOKEN`

Ejemplo local:

```bash
cp .env.example .env
npx wrangler secret put SOCRATA_APP_TOKEN
```

## Controles De Costo

- No se permiten exportaciones globales sin departamento.
- `/api/jobs` limita a 30 exportaciones por hora por IP.
- Los ZIP quedan bajo `exports/<jobId>/` en R2.
- R2 elimina objetos `exports/` de mas de 1 hora.
- Los catalogos persistentes usan `catalog-cache/` y no se eliminan por la regla horaria.

## Estado Actual

Verificado:

- metadata y catalogos responden JSON,
- filtros avanzados cargan desde R2,
- Socrata responde para los 13 datasets soportados,
- exportaciones reales generan ZIP,
- ZIP incluye CSV, JSON y Parquet,
- descargas repetidas funcionan durante la ventana de 1 hora,
- CI ejecuta syntax check, typecheck, tests (Worker + unit), audit de dependencias de produccion, build, validacion dry-run del Worker, deploy y smoke test productivo (no bloqueante).
