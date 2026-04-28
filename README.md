# sergiobc.com

Repositorio del sitio web de Sergio BC y de la app operativa en `ideam.sergiobc.com`.

## Superficies

- `sergiobc.com` y `www.sergiobc.com`: sitio personal base.
- `ideam.sergiobc.com`: app web para consultar y descargar datos hidrológicos del IDEAM desde Socrata, ejecutada en Cloudflare Workers.

## Estructura relevante

- `index.html`
- `styles.css`
- `workers/ideam.js`
- `wrangler.jsonc`
- `package.json`
- `IDEAM_WEBAPP.md`

## IDEAM Web App

La aplicación de `ideam.sergiobc.com`:

- consulta datasets IDEAM publicados en Socrata,
- aplica filtros por variable, departamento, municipio, estación y rango temporal,
- valida variantes territoriales como `ATLANTICO` / `ATLÁNTICO`,
- ofrece vista previa y descarga directa desde navegador,
- corre completamente online sobre Cloudflare Workers.

## Desarrollo y despliegue

```bash
npm install
npm run check
npm run dev
npm run deploy
```

La configuración del Worker está en `wrangler.jsonc`. El despliegue productivo usa:

- Worker name: `ideam`
- Route: `ideam.sergiobc.com/*`
- Zone: `sergiobc.com`

## CI/CD

El workflow `.github/workflows/deploy-ideam.yml` despliega automáticamente cuando cambian:

- `workers/ideam.js`
- `wrangler.jsonc`
- `package.json`

Secrets requeridos en GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Figma

El diseño fuente está en Figma Make bajo `AUTOMATIZACIÓN DE DATOS HÍDRICOS DEL IDEAM`.

El conector actual sí expone la estructura del proyecto Make, pero no nos entregó todavía el contenido textual de archivos como:

- `src/app/App.tsx`
- `src/app/components/Dashboard.tsx`
- `src/app/components/DataExtractor.tsx`
- `src/styles/*.css`

Para una implementación visual 1:1 contra Figma, conviene aportar uno de estos dos insumos:

1. Un link Figma de la pantalla específica con `node-id`.
2. El código exportado del Make file para `App.tsx`, `Dashboard.tsx`, `DataExtractor.tsx`, `Sidebar.tsx`, `Navbar.tsx` y los CSS del proyecto.

Más detalle técnico en `IDEAM_WEBAPP.md`.
