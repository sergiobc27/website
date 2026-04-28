# sergiobc.com

Repositorio de la presencia web de Sergio BC.

## Superficies actuales

- `sergiobc.com` y `www.sergiobc.com`: sitio personal base.
- `ideam.sergiobc.com`: app web del proyecto IDEAM servida desde Cloudflare Worker.

## Archivos principales

- `index.html`
- `styles.css`
- `workers/ideam.js`
- `IDEAM_WEBAPP.md`

## IDEAM Web App

La app de `ideam.sergiobc.com`:

- consulta datasets IDEAM publicados en Socrata,
- aplica filtros por variable, departamento, municipio, estacion y rango temporal,
- valida variantes territoriales como `ATLANTICO` / `ATLÁNTICO`,
- permite vista previa y descarga directa desde navegador,
- ejecuta todo online a traves de Cloudflare Workers.

Mas detalle tecnico en `IDEAM_WEBAPP.md`.
