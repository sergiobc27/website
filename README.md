# IDEAM Hydrology Data Web Automator

Repositorio privado del sitio `website`, incluyendo la aplicacion operativa de `ideam.sergiobc.com`.

## Superficies

- `sergiobc.com` y `www.sergiobc.com`: sitio personal base.
- `ideam.sergiobc.com`: frontend React/Vite + Cloudflare Worker API para automatizar descargas IDEAM desde Socrata.

## Arquitectura

- Frontend: React, Vite, TypeScript progresivo.
- API: Cloudflare Workers.
- Jobs asincronos: Durable Objects.
- Almacenamiento temporal: R2.
- Fuente de datos: Socrata SODA API en `www.datos.gov.co`.

Flujo principal:

1. El usuario configura variable, departamento, filtros, fechas y formatos.
2. La web consulta catalogos avanzados desde cache R2.
3. El Worker valida que haya departamento obligatorio.
4. El Worker crea un job asincrono.
5. El job consulta Socrata por paginas, genera un ZIP y lo guarda en R2.
6. El usuario descarga un ZIP organizado por `variable/departamento/municipio`.

## Estructura

- `src/app/*`: interfaz React.
- `src/app/lib/ideamApi.ts`: cliente API del frontend.
- `src/shared/ideamContracts.ts`: contratos TypeScript compartidos para respuestas API.
- `src/worker/index.js`: Worker, rutas API, Socrata, exportaciones y Durable Objects.
- `src/worker/catalogConfig.js`: definiciones de datasets, departamentos y filtros.
- `tests/worker.test.mjs`: pruebas del Worker.
- `tests/e2e/ideam-production.spec.ts`: smoke test productivo.
- `cloudflare/r2-lifecycle.json`: lifecycle R2 para borrar exportaciones despues de 1 hora.
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
- CI ejecuta typecheck, tests, audit, build, deploy, warmup y smoke test productivo.
