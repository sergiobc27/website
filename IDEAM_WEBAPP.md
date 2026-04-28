# IDEAM Web App

Este repositorio ahora conserva dos superficies:

- `index.html` y `styles.css`: sitio personal base.
- `workers/ideam.js`: Worker que sirve la app de `ideam.sergiobc.com`.

## Flujo

1. El navegador abre `ideam.sergiobc.com`.
2. Cloudflare enruta la solicitud al Worker `ideam`.
3. El Worker sirve la interfaz y expone endpoints `/api/*`.
4. El Worker consulta Socrata en `www.datos.gov.co`.
5. El usuario obtiene vista previa y descarga sin ejecutar scripts locales.

## Endpoints

- `GET /api/meta`
- `GET /api/municipalities?department=ATLANTICO`
- `GET /api/coverage?datasetId=s54a-sgyg&department=ATLANTICO`
- `POST /api/preview`
- `POST /api/export`

## Limites actuales

- Vista previa: 200 filas.
- Descarga por solicitud: 100000 filas.
- Formatos: `csv` y `json`.

## Siguiente evolucion recomendada

- Jobs asincronicos para descargas masivas.
- Persistencia en R2 para historiales descargables.
- Autenticacion de usuarios.
- Cola de trabajos para consultas de larga duracion.
