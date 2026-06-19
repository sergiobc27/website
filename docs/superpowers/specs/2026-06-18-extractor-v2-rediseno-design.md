# 2º Rediseño UX del Extractor de Datos — Spec de diseño

**Fecha:** 2026-06-18 · **Componente:** `src/app/components/DataExtractor.tsx` (~2669 líneas) + nuevos componentes/util · **Repo:** `sergiobc27/website` (main exige PR + auto-deploy) · **Tipo:** frontend puro.

## Objetivo
Hacer el Extractor más intuitivo y ameno separando la configuración de la ejecución, eliminando jerga de backend, y puliendo progreso/preview/filtros/consentimiento. Fundamentado en investigación multiagente (NN/g, Smashing, Refactoring UI, React docs, WAI-ARIA APG, MDN).

## Decisiones aprobadas por el usuario (2026-06-18)
1. **Alcance:** TODO de una (un solo rediseño/PR con las 6 fases).
2. **Consentimiento:** slide-to-accept inline (no modal de entrada bloqueante).
3. **Modo enfoque:** auto al lanzar el job + botón manual; SIN `requestFullscreen` del navegador.
4. **Contador "X/X listas":** quitarlo del todo.

## Entorno (verificado)
- **React 18.3.1** → preservar estado con `display:none`/`hidden` (NO la API `<Activity>` de 19.2).
- **Radix instalado** (`@radix-ui/react-*`) → usar **Radix Popover** para el FacetCombobox (accesibilidad APG gratis).
- Backend del preview ya corta a **200 filas** (`api/.../settings.py preview_limit=200`) → **NO virtualizar**; `meta.previewLimit` está en `ideamContracts.ts`.
- El job ya emite: `progressPercent`, `processedRows`, `rowsPerSecond`, `estimatedRemainingSeconds`, `currentPage/totalPages`, `status`. `currentJobId` persiste en `ACTIVE_JOB_KEY` y re-engancha polling al montar.

## Restricciones (NO romper)
`executionPayload`, `ACTIVE_JOB_KEY`, `CONFIG_KEY`, `parseSearch`/`buildSearch` (deep-links), los setters de estado, el efecto de polling/backoff/reconexión, la validación inline, "Compartir configuración". El polling y `currentJobId` viven en el padre `DataExtractor` y deben quedar FUERA de cualquier subárbol que se oculte. Sin firmas de Claude.

## Diseño por área

### 1. Flujo en dos fases — máquina de modos
`mode: 'config' | 'running' | 'results'`, estado en `DataExtractor`.
- **config** (inicial salvo job activo): acordeón + consentimiento + estimación + CTA. Oculta progreso/resultados.
- **running**: al disparar `runDownload`/`runPreview`. Vista enfocada: ProgressHero ancho completo + `CuriosidadEspera` + Cancelar.
- **results**: cuando `readyDownloadJob` existe o termina la preview. ReadyDownloadPanel + preview + métricas + centro de descargas.

**Preservación de estado (CRÍTICO):** renderizar AMBOS subárboles (config y ejecución) SIEMPRE en la misma posición y alternar con `hidden`/`display:none` según `mode`. NO usar ternario `mode==='config' ? <Config/> : <Results/>` (React destruiría las ~25 piezas de config al volver).

**Derivación:** `useEffect` que setea modo desde estado existente — `running ≈ isBusy && !readyDownloadJob`; `results ≈ readyDownloadJob || preview || downloadMetrics`. `setMode` explícito SOLO para intención del usuario ("Editar configuración", "Nueva descarga"). Al montar: si hay `ACTIVE_JOB_KEY` → `running` (tras el restore).

**Transición:** `document.startViewTransition(() => setMode(m))` con fallback `else { setMode(m) }`; respeta `prefers-reduced-motion` (degrada a salto seco).

**Retorno:** breadcrumb `<nav aria-label> + <ol>` "Configuración › Ejecución" + botón "← Editar configuración"; al volver mover foco al primer control de config (`ref` + `tabIndex=-1` + `.focus()`). "Cancelar" añade `setMode('config')` (no mata el job).

### 2. Quitar "X/X listas"
Eliminar el badge (líneas ~1357-1359) por completo. El acordeón ya marca cada sección con check verde / icono + `requirement` en `warning`. No reemplazar por número.

### 3. Quitar jerga de "páginas"
Quitar de la UI `runtimeCurrentPage`/`runtimePages` (1169-1181) y la columna "página(s)" de la estimación (1437-1442). Mostrar **fase nombrada** (Planeando/Descargando/Empacando/Listo, de `phaseIndex`/`statusKind`) + % + filas. `currentPage/totalPages` solo uso interno para el %.

### 4. Quitar auto-scroll
Eliminar el bloque `scrollIntoView` del ReadyDownloadPanel (~2605-2611). La señal in-place (anillo verde, botón de descarga, toast) y el cambio a `mode='results'` ya orientan.

### 5. Vista previa altura fija (CSS, sin dependencia)
Wrapper scrollable: `max-h-[28rem]` + `overflow-y:auto` + `role="region"` + `aria-label` + `tabindex={0}` (scroll por teclado, WCAG 2.1.1). `<thead>` `position:sticky; top:0` con **fondo opaco** (`bg-card`); reemplazar `border-b` del header por `box-shadow` inset. Altura reservada en estado vacío (`min-h`) para evitar layout shift. Mostrar las **13 columnas** (quitar `slice(0,8)` línea 352) — el scroll horizontal interno ya existe. Etiqueta honesta: "muestra de {rows.length} de {rowCount} filas" usando `meta.previewLimit`.

### 6. Filtros — `FacetCombobox` unificado (Radix Popover)
Nuevo componente reutilizable: disparador (botón "Departamento · N ▾") → Radix Popover **portalizado** (el acordeón usa `overflow-hidden`) con input de búsqueda (`normalizeText`) + listbox de checkboxes con `(total)` por opción + "Todos/Ninguno". Una **barra única de chips aplicados** (removibles, × cada uno) + "Limpiar todo", encima del CTA.
- **Territorio:** `[Departamento ▾] [Mapa]` + chips. Quitar la nube de 32 chips. `MapaSelectorDepartamentos` lazy intacto.
- **Avanzados:** una fila de disparadores `[Municipio ▾] [Categoría ▾]…`, uno por `catalogFilter`. Quitar `slice(0,80)`. Disparador deshabilitado con su estado (`warming`/`loading`).
- **Estaciones:** textarea de códigos + tabla de apoyo dentro del popover "Estación".
- **NO cambiar la forma del estado:** misma firma de setters (`toggleDepartment`, `toggleCatalogValue`, `parseStationCodes`, `stationCodesText`).

### 7. Modo enfoque (auto + manual)
Estado de UI puro (no Fullscreen API). Al pasar a `running`, colapsar el sidebar (reusar `COLLAPSE_KEY='ideam-sidebar-collapsed'` de `Sidebar.tsx`) y usar ancho completo; salir solo al `done`/`error`/cancelar. Botón manual "Modo enfoque" (Maximize/Minimize de lucide) opcional con salida garantizada (`Esc`). Es presentación pura: no toca job/URL/localStorage. Zonificar texto a `max-width ~66ch` aunque la sección use todo el ancho.

### 8. Precisión del progreso (3 cifras + suavizado)
Mostrar: **% determinado** (monótono, `Math.max(prev,raw)`), **filas procesadas** (contador animado, "X de ~Y" con `~` si total estimado), **ETA en rango amable** (`etaAmable`, ya existe) **alimentado por throughput suavizado en cliente**.
- **EMA + histéresis** en `lib/progresoDescarga.ts`: `EMA = α·actual + (1-α)·EMA_prev` (α≈0.25); `eta = filasRestantes / rpsSuavizado`; si el nuevo ETA cambia <10% del mostrado, conservar (anti-parpadeo); `Math.ceil` (sobreestimar). Persistir EMA entre `retrying` (no reiniciar a 0).
- Indeterminado en `queued`/`planning` (sin datos) y en empaquetado (`pack/zip`): barra indeterminada, ETA="Calculando", sin `aria-valuenow`.
- `prefers-reduced-motion` en el contador de filas (el lerp `animatedRows` 855-861 debe setear valor final directo).
- ARIA: `role="progressbar"` con `aria-valuenow` solo cuando determinado; mantener `aria-live="polite"` de la región de estado.

### 9. Slide-to-accept (consentimiento)
Nuevo `SlideToAccept.tsx`, misma firma `{accepted, onChange}` que la ConsentBar actual. Implementación accesible: `<input type="range" min=0 max=100>` nativo oculto pero operable (hereda foco/teclado/flechas/Home-End); thumb (`ShieldCheck`) con `transform: translateX`. value ≥95 → `onChange(true)` + snap 100; <95 → vuelve a 0.
- **Alternativa de teclado obligatoria** (WCAG 2.5.7): →/Enter aceptan, ←/Home revierten.
- **`prefers-reduced-motion`:** degradar a toggle/checkbox seco (sin desplazamiento).
- ARIA: `aria-label`, `aria-valuetext`, `<p role="status" aria-live="polite" class="sr-only">` al aceptar.
- Estética: riel `warning` pendiente / `success` aceptado; animar con `transform`/`opacity`.
- **Consolidar:** eliminar el `step==='consent'` duplicado del stepper (1718-1734), sacar `'consent'` de `STEP_IDS` (63) y del default de paso (253). La ConsentBar (con SlideToAccept) queda como único punto. Misma `acceptedTerms` + persistencia (no re-aceptar cada visita).

### 10. Toques generales
Lenguaje sin jerga; una sola barra de selección; entrada escalonada en `results` (una transición de contenedor, no varios `animate-fade-in-up` a la vez); cierre claro (anillo verde + "ZIP listo" + countdown 1h + acción primaria); `reduced-motion` consistente.

## Archivos
- **Modificar:** `src/app/components/DataExtractor.tsx` (modos, quitar 4/4, páginas, auto-scroll, preview fija, integrar FacetCombobox + SlideToAccept, modo enfoque), `src/app/lib/progresoDescarga.ts` (EMA + histéresis).
- **Crear:** `src/app/components/SlideToAccept.tsx`, `src/app/components/FacetCombobox.tsx`.
- **Reusar:** `Sidebar.tsx` (COLLAPSE_KEY), tokens de `theme.css`, `MapaSelectorDepartamentos.tsx`.

## Verificación
typecheck + build + suite existente (89+50) + nuevos tests de lógica pura (EMA/histéresis en progresoDescarga). Pruebas manuales en Chrome (claro/oscuro + teclado): iniciar descarga cambia a vista de ejecución; "Editar configuración" conserva depto/fechas/formatos; recarga con job activo arranca en `running` y re-engancha; job completado → `results` con ZIP; deep-link precarga en `config`; gate bloquea sin aceptar; aceptar por teclado marca `acceptedTerms`; reduced-motion → fallbacks secos; preview con scroll interno y 13 columnas. PR a `sergiobc27/website` → merge → auto-deploy → verificación en vivo.

## Riesgos
- El cambio de modos toca mucho JSX del `return` (1349-1615) — hacerlo con ambos subárboles montados para no perder estado.
- El FacetCombobox no debe alterar la forma del estado (rompería Compartir/deep-links).
- Vigilar que ocultar la config no desmonte el polling (mantenerlo en el padre).
