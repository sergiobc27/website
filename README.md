# sergiobc.com

Repositorio del sitio web de Sergio BC y de la app operativa en `ideam.sergiobc.com`.

## Superficies

- `sergiobc.com` y `www.sergiobc.com`: sitio personal base.
- `ideam.sergiobc.com`: frontend React/Vite del proyecto IDEAM servido por Cloudflare Workers Assets, con API `/api/*` ejecutada en el mismo Worker.

## Estructura relevante

- `src/app/*`: frontend React basado en el diseño de `Ideamwebsite`.
- `src/worker/index.js`: API Worker para metadata, cobertura, preview y export.
- `src/imports/*`: assets del diseño original.
- `src/styles/*`: tema y estilos globales.
- `wrangler.jsonc`: configuración productiva del Worker.
- `package.json`: scripts de build y deploy.

## Comandos

```bash
npm install
npm run check
npm run build
npm run dev:web
npm run dev:worker
npm run deploy
```

## Arquitectura

1. El usuario entra a `ideam.sergiobc.com`.
2. Cloudflare sirve el build estático del frontend desde `dist`.
3. Las rutas `/api/*` se ejecutan en `src/worker/index.js`.
4. El Worker consulta los datasets públicos de IDEAM en Socrata.
5. La descarga se resuelve completamente online, sin scripts locales del usuario.

## Deploy

El workflow `.github/workflows/deploy-ideam.yml`:

1. instala dependencias,
2. valida sintaxis del Worker,
3. ejecuta el build frontend,
4. despliega a Cloudflare con Wrangler.

Secrets requeridos en GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Estado actual

- El extractor React ya quedó conectado a:
  - `/api/meta`
  - `/api/municipalities`
  - `/api/coverage`
  - `/api/preview`
  - `/api/export`
- El historial ya usa `localStorage` real.
- El dashboard ya consume metadata e historial local en lugar de depender solo de datos de demo.

El siguiente paso operativo es correr `npm install` + `npm run build` en un entorno con acceso al registry y desplegar el Worker actualizado.
