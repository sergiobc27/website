# sergiobc.com

Repositorio del sitio web de Sergio BC y de la app operativa en `ideam.sergiobc.com`.

## Superficies

- `sergiobc.com` y `www.sergiobc.com`: sitio personal base.
- `ideam.sergiobc.com`: frontend React/Vite del proyecto IDEAM servido por Cloudflare Workers Assets, con API `/api/*` ejecutada en el mismo Worker.

## Estructura relevante

- `src/app/*`: frontend React basado en el dise?o de `Ideamwebsite`.
- `src/worker/index.js`: API Worker para metadata, cobertura, preview y exportaciones asincronas por ZIP.
- `src/imports/*`: assets del dise?o original.
- `src/styles/*`: tema y estilos globales.
- `tests/worker.test.mjs`: pruebas base de helpers y configuraci?n del Worker.
- `wrangler.jsonc`: configuraci?n productiva del Worker.
- `cloudflare/r2-lifecycle.json`: regla de lifecycle para eliminar exportaciones temporales despues de 1 hora.
- `package.json`: scripts de build, test y deploy.

## Comandos

```bash
npm install
npm run check
npm test
npm run build
npm run dev:web
npm run dev:worker
npm run deploy
```

## Arquitectura

1. El usuario entra a `ideam.sergiobc.com`.
2. Cloudflare sirve el build est?tico del frontend desde `dist`.
3. Las rutas `/api/*` se ejecutan en `src/worker/index.js`.
4. El Worker consulta los datasets p?blicos de IDEAM en Socrata.
5. La descarga se resuelve completamente online, sin scripts locales del usuario.

## Deploy

El workflow `.github/workflows/deploy-ideam.yml`:

1. instala dependencias,
2. valida sintaxis del Worker,
3. ejecuta pruebas base,
4. construye el frontend,
5. crea/verifica el bucket R2,
6. aplica lifecycle de 1 hora para `exports/`,
7. despliega a Cloudflare con Wrangler.

Secrets requeridos en GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

El token debe incluir permisos de Workers y `Workers R2 Storage Write` para poder aplicar lifecycle.

Secret opcional recomendado en Cloudflare Worker:

- `SOCRATA_APP_TOKEN`: token SODA/Socrata para enviar como `X-App-Token` en las consultas a `datos.gov.co`.

Configuralo sin subirlo al repositorio:

```bash
npx wrangler secret put SOCRATA_APP_TOKEN
```

## Controles de costo $0.00

- No se permiten descargas globales: cada preview/exportacion debe incluir al menos un departamento valido.
- `/api/jobs` aplica rate limiting estricto: 30 exportaciones por hora por IP, con respuesta `429` y `Retry-After`.
- Los ZIP se comprimen antes de subirse a R2 y se guardan bajo `exports/<jobId>/`.
- Cada ZIP queda disponible para descargas repetidas durante la ventana temporal de 1 hora.
- El bucket tiene lifecycle de respaldo para borrar cualquier objeto `exports/` con mas de 1 hora.
- La ruta sincronica `/api/export` queda deshabilitada; el flujo soportado es asincrono por `/api/jobs`.

## Estado actual

- El extractor React ya qued? conectado a:
  - `/api/meta`
  - `/api/date-range`
  - `/api/municipalities`
  - `/api/catalog-options`
  - `/api/stations-helper`
  - `/api/coverage`
  - `/api/preview`
  - `/api/export-plan`
  - `/api/export-page`
  - `/api/jobs`
  - `/api/jobs/:id`
  - `/api/jobs/:id/parts/:partIndex`
- El historial usa `localStorage` real.
- La cobertura territorial previa al ZIP vuelve a consultar resultados reales del dataset dentro del contexto de filtros activos.
- La exportacion asincrona respeta filtros territoriales, divide por partes ZIP y limpia R2 al finalizar la descarga.

`src/worker/index.js` es la ?nica fuente activa para producci?n. El Worker inline anterior qued? archivado solo como referencia hist?rica.

