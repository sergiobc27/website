# Asistente Hídrico — Botones de acción (deep-links a las pestañas)

**Fecha:** 2026-06-12
**Ámbito:** `src/worker/chatData.js` + `index.js`, `src/app/components/Asistente.tsx`,
`src/app/App.tsx`, `src/app/components/DataExtractor.tsx`, `src/app/lib/navigation.ts`,
tests.
**Origen:** el usuario quiere que, al pedir un dato, el bot ofrezca un botón que
lo lleve exactamente a la pestaña correcta con los filtros YA puestos (p. ej.
"descargar en el Extractor", "ver la curva IDF", "ver la serie en Analítica").

## Decisión

Los botones los arma el **Worker de forma determinista** a partir del `intent`
ya resuelto y de `resultadoDatos` (NO el modelo: evita enlaces/params
alucinados, igual que la línea de fuente y las referencias). Se envían en la
respuesta de `/api/chat` como `acciones: [{ label, view, params }]`. El frontend
los pinta como botones; al click, navega a la vista y aplica los `params` vía el
URL-state que ya leen las vistas.

## Esquemas de URL por vista (confirmados)
- **Hidrología** (`view:"hydro"`): `est=<códigoEstación>` → selecciona estación y muestra su IDF.
- **Analítica** (`view:"analytics"`): `dep=<departamento>`, `var=<datasetId>` (omitido si precip `s54a-sgyg`), `years=<desde-aaaa>-<hasta-aaaa>`. (Escala departamento.)
- **Extractor** (`view:"extractor"`, `DataExtractor`): HOY no tiene url-state. Hay que **añadirle `useUrlSync`** (params: `var`=datasetId, `dep`=departamento, `est`=estación opcional, `years`) + `onRestore` que pre-cargue esos filtros. Es el trabajo extra de esta feature.

## Acciones a generar (Worker, `construirAcciones(intent, resultadoDatos)`)
- `idf_tr` con estación resuelta → **"Ver la curva IDF de {estación} →"** `{view:"hydro", params:{est}}`.
- `dato_puntual` con departamento resuelto → **"Ver la serie en Analítica →"** `{view:"analytics", params:{dep, var?, years?}}`.
- Cualquier intent de datos con lugar/departamento → **"Descargar en el Extractor →"** `{view:"extractor", params:{var?, dep?, est?, years?}}`.
- Sin datos válidos o rechazo → sin acciones.
- Máx. 3 acciones; labels ≤ 60 chars; `view` contra whitelist; params solo strings saneados.

## Flujo de navegación (frontend)
1. `Asistente` recibe `data.acciones` (de la respuesta, no del texto del modelo) y renderiza botones (estilo chips, distintos de las sugerencias).
2. Al click: `dispatchEvent(new CustomEvent('ideam:navigate', { detail: { view, params } }))`.
3. `App` escucha `ideam:navigate`: arma la URL con `viewToPath(view)` + `buildSearch(params)`, hace `history.pushState`, y `navigate(view)`. La vista destino monta y su `useUrlSync.onRestore` lee los params → filtros pre-puestos. (Si el panel flotante está abierto, se mantiene; el usuario ve la pestaña detrás o se cierra el panel — decidir: cerrar el panel al navegar para que vea el resultado.)

## Componentes
- **`chatData.js`**: `construirAcciones(intent, resultadoDatos, VARIABLES)` puro → array de acciones. Whitelist de `view` (`hydro|analytics|extractor`). (Testeable con node.)
- **`index.js handleChat`**: tras armar `reply`/`dataUsed`, `const acciones = dataUsed ? construirAcciones(intent, resultadoDatos) : []`; incluir `acciones` en `chatJson`.
- **`Asistente.tsx`**: render de `acciones` como botones con icono; click → evento `ideam:navigate`; cierra el panel flotante al navegar.
- **`App.tsx`**: listener de `ideam:navigate` → set URL + navigate. (Y un `ACCION_VIEWS` whitelist de seguridad en el cliente.)
- **`DataExtractor.tsx`**: añadir `useUrlSync` (params var/dep/est/years) + `onRestore` que pre-cargue los filtros existentes del extractor.
- **`navigation.ts`**: `viewToPath` ya existe; reutilizar.

## Etapas (TDD, varios deploys)
1. **Worker** `construirAcciones` + lo emite en `/api/chat` (tests node). Sin efecto visible aún.
2. **Frontend** render de botones + evento `ideam:navigate` + listener en App → deep-link a **Hidrología** y **Analítica** (ya tienen url-state). Verificable en vivo.
3. **Extractor**: `useUrlSync` + pre-carga de filtros → botón "Descargar" funcional.

## Tests
- node (`chat-data`/`worker`): `construirAcciones` genera las 3 acciones según intent; sin datos → []; labels/whitelist/saneo; integración: `/api/chat` con datos incluye `acciones`.
- vitest: `viewToPath`/`buildSearch` ya cubiertos; (Extractor url-state: helpers puros si los hay).
- Frontend de navegación: verificación por typecheck/build + en vivo.

## Gate / deploy
Gate completo siempre; deploy por push a `main`. Sin firmas.

## Fuera de alcance
Analítica a escala municipio (su URL es por departamento); recordar la última navegación; animaciones de transición entre pestañas.
