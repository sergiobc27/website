# IDEAM Web App

Este repositorio ahora conserva dos superficies:

- `index.html` y `styles.css`: sitio personal base.
- `src/app/*`: frontend React/Vite basado en el diseño de `Ideamwebsite`.
- `src/worker/index.js`: Worker modular que expone `/api/*`.
- `wrangler.jsonc`: configuración productiva del Worker `ideam`.

## Flujo

1. El navegador abre `ideam.sergiobc.com`.
2. Cloudflare enruta la solicitud al Worker `ideam`.
3. Los assets del frontend se sirven desde `dist`.
4. Las rutas `/api/*` se resuelven en `src/worker/index.js`.
5. El Worker consulta Socrata en `www.datos.gov.co`.
6. El usuario obtiene vista previa y descarga sin ejecutar scripts locales.

## Endpoints

- `GET /api/meta`
- `GET /api/health`
- `GET /api/municipalities?department=ATLANTICO`
- `GET /api/coverage?datasetId=s54a-sgyg&department=ATLANTICO`
- `POST /api/preview`
- `POST /api/export`

## Limites actuales

- Vista previa: 200 filas.
- Descarga por solicitud: 100000 filas.
- Formatos: `csv` y `json`.

## Configuracion operativa

Las variables se pueden ajustar desde `wrangler.jsonc` o desde el entorno del Worker:

- `SOCRATA_DOMAIN`
- `CATALOG_DATASET_ID`
- `PAGE_LIMIT`
- `PREVIEW_LIMIT`
- `MAX_EXPORT_ROWS`

## Siguiente evolucion recomendada

- Jobs asincronicos para descargas masivas.
- Persistencia en R2 para historiales descargables.
- Autenticacion de usuarios.
- Cola de trabajos para consultas de larga duracion.
