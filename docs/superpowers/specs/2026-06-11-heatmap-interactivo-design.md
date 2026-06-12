# Heatmap climático interactivo — diseño

**Fecha:** 2026-06-11
**Estado:** aprobado, pendiente de plan

## Objetivo

Convertir el mapa de calor del calendario (hoy una celda estática del dashboard bento, `CeldaCalendario`) en un **panel interactivo** dentro de Analítica, con:

- **4 vistas (granularidades):**
  1. **Años × meses** — años en filas, 12 meses en columnas (la vista actual; muestra Niña/Niño).
  2. **1 año × meses** — un año seleccionable, sus 12 meses en grande.
  3. **Días × día de semana** — estilo GitHub: 7 filas (Lun→Dom) × ~53 semanas, cada celda un día.
  4. **Mes × día del mes** — un mes con sus ~30 días en cuadrícula semanal.
- **Control de tamaño:** toggle **S / M / L** (celdas ~10 / ~16 / ~24 px) + **expandir a pantalla completa** (overlay).
- Reusa la **paleta CUC** ya implementada (`colorCalendario`: oro pálido → rojo CUC).

## Restricción de datos (la que define el diseño)

La API (`/api/analytics/timeseries`, POST) acepta `interval: 'day' | 'month' | 'year'`, pero **la serie diaria exige `departments`** — la diaria nacional es demasiado pesada y la API la rechaza (usa `obs_diario`). Las series mensual/anual sí funcionan a nivel nacional.

Consecuencia: **las vistas diarias (3 y 4) requieren un departamento seleccionado.** Si no hay departamento, el panel muestra un empty-state que invita a elegir uno (no un error). Esto cumple además el backlog previo "heatmap diario por departamento".

## Componentes

### 1. `src/app/lib/heatmap.ts` — lógica pura (testeable, sin DOM ni red)

Reutiliza `colorCalendario(valor, max)` de `lib/dashboard.ts` (ya con paleta CUC). Cuatro constructores de matriz desde `points: AnalyticsTimeseriesPoint[]` (`{ bucket, value }`):

- `matrizAniosMeses(points)` → `{ anios: { anio, meses: (number|null)[12] }[], max }`. Se **mueve aquí** la `matrizCalendario` actual de `dashboard.ts` (re-exportada desde dashboard para no romper `CeldaCalendario`).
- `matrizUnAnioMeses(points, anio)` → los 12 meses de un año + `max`.
- `matrizDiasSemana(points, anio)` → estilo GitHub. Calcula para cada día del año `(diaSemana 0=Lun..6=Dom, semanaIndex)`; devuelve `{ semanas: (Celda|null)[][], max }` con 7 filas. La primera y última semana pueden ser parciales (rellenas con `null`).
- `matrizMesDias(points, anio, mes)` → días del mes alineados por día de semana (cuadrícula de hasta 6×7) + `max`.

`bucket` esperado: `'YYYY'`, `'YYYY-MM'`, `'YYYY-MM-DD'`. El parseo de fecha usa UTC para evitar el off-by-one de zona horaria (lección de `migration-status`: los caggs están en UTC).

### 2. `src/app/components/HeatmapClimatico.tsx` — el panel

**Props (desde Analítica):** `datasetId`, `department`, `metric`.
**Estado interno:** `vista` (`'anios-meses' | 'anio-meses' | 'dias-semana' | 'mes-dias'`), `anio`, `mes`, `tamano` (`'s'|'m'|'l'`), `expandido` (bool).

**Controles (cabecera del panel):** selector de vista · selector de año (vistas 2–4) · selector de mes (vista 4) · toggle S/M/L · botón expandir · `ChartDownloadButton` (PNG).

**Fetch propio** (con `apiJson` + `AbortController`, patrón de Analítica):
- Vistas mensuales (1–2): `interval:'month'`, sin requerir departamento, sobre el rango del dataset.
- Vistas diarias (3–4): `interval:'day'`, `departments:[department]`, `startDate`/`endDate` acotados al año (vista 3) o al mes (vista 4) para no traer años de datos diarios.

**Estados:** `SkeletonLoader` al cargar · "Sin datos para esta combinación" si vacío · empty-state "Elige un departamento…" si vista diaria sin `department` · leyenda seco→lluvioso con la escala CUC.

**Expandir:** overlay `fixed inset-0` (o `Sheet`/dialog existente) con el mismo grid a tamaño grande; cierra con Esc/botón.

### 3. `CeldaCalendario` (dashboard) — sin cambio funcional

Sigue siendo el preview años×meses ya recoloreado; al hacer clic navega a Analítica (comportamiento actual). Solo se ajusta el import de `matrizCalendario` si se mueve a `heatmap.ts` (se re-exporta para no tocar el componente).

### 4. `Analytics.tsx` — integración

El panel `HeatmapClimatico` se monta debajo de la gráfica principal de serie, recibiendo `datasetId`, `department`, `metric` del estado existente. No duplica filtros: reusa el ámbito de Analítica.

## Estado en la URL

Se sincroniza la vista del heatmap como `hm=<modo>` vía el `useUrlSync` ya existente en Analítica (compartible). `anio`/`mes`/`tamaño`/`expandido` son estado efímero (no van a la URL).

## Pruebas (TDD)

Unit tests (vitest) en `src/app/lib/heatmap.test.ts`:
- `matrizAniosMeses`: agrupa por año, 12 huecos, `null` donde falta, `max` correcto.
- `matrizUnAnioMeses`: filtra al año pedido, 12 posiciones.
- `matrizDiasSemana`: 7 filas; alineación día-de-semana correcta (un día conocido cae en su columna/fila esperada); primera/última semana parciales con `null`; `max` correcto.
- `matrizMesDias`: número de días del mes (incl. bisiesto), alineación de la primera fila.
- Los tests de `colorCalendario` se mantienen (escala CUC).

No se tocan endpoints de la API (solo se consume `/api/analytics/timeseries` ya existente, con parámetros que ya soporta).

## Fuera de alcance (YAGNI)

- Sin nuevas vistas más allá de las 4 acordadas.
- Sin cambios en la API ni en el box.
- Sin persistir tamaño/año en la URL.
