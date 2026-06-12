# Spec: Dashboard bento

**Fecha:** 2026-06-11 · **Estado:** aprobada por Sergio (celdas, drill-down por navegación, reemplazo total, + heatmap climático añadido por él)

## Objetivo

Reemplazar por completo la vista Dashboard por un **bento grid** que sea el centro de mando
del espejo: KPIs en vivo, mini-visualizaciones y accesos con drill-down por navegación.
Calidad de interacción guiada por las skills de diseño instaladas (emil-design-eng,
impeccable, design-system — se leen como referencia al implementar). Costo cero: solo
endpoints existentes.

## Las celdas (9, en grid de 12 columnas responsivo)

| Celda | Tamaño | Contenido | Datos | Click → |
|---|---|---|---|---|
| 💧 Pulso del espejo | hero 2x2 | Total de observaciones (contador animado 0→764M), frescura del último dato (absoluta + relativa), última sincronización | `/api/meta` + `/api/analytics/datasets-overview` (suma de filas) | Estado del Espejo |
| 🌧️ Lluvia nacional | alta 1x2 | Sparkline/área de los últimos 12 meses (promedio nacional mensual) + comparación "este mes vs su promedio histórico" (↑/↓ %) | `/api/analytics/timeseries` (month, nacional) + `/api/analytics/monthly-climatology` (nacional) | Analítica |
| 🔥 Calendario climático | ancha 2x1+ | **Heatmap años × meses** (filas = años desde 2001, columnas = ene–dic, color = precipitación promedio del mes a escala nacional). La bimodalidad y los fenómenos (Niña 2010-11, Niño 2015-16) se ven como patrones de color. Tooltip por celda con valor exacto | `/api/analytics/timeseries` (month, nacional, serie completa — obs_mensual, <1s) | Analítica |
| 🏆 Top departamentos | 1x1 | Mini-ranking horizontal top 5 por precipitación media | `/api/analytics/by-region` | Analítica |
| 📥 Mis descargas | 1x1 | Últimas 3 descargas + filas totales acumuladas (compacto) | localStorage `ideam-history` | Historial |
| 📖 La historia del dato | 1x1 acceso | Invitación al scrollytelling | — | /historia |
| 💬 Asistente | 1x1 acceso | "Pregúntale a tus datos" | — | abre widget (evento `ideam:open-asistente`) |
| 🗺️ Mapa | banda inferior | "Explora las 17.976 estaciones" + conteo de estaciones del dataset activo si está disponible en overview | `/api/analytics/datasets-overview` (si trae stationCount; si no, copy estático) | Mapa de Estaciones |

Nota heatmap: la serie DIARIA nacional está bloqueada por la API (anti-DoS) — por eso la
resolución es mensual, que además es la correcta para fenómenos interanuales. Un heatmap
diario por departamento queda como mejora futura de Analítica (fuera de alcance).

## Interacción y calidad (criterio emil/impeccable)

- Toda celda es un `<button>` (o `<a>`-like) con: hover lift sutil (translate-y + sombra),
  **feedback de presión** `active:scale-[0.98]`, `focus-visible` con anillo accesible,
  `aria-label` descriptivo ("Ver estado del espejo: 764 millones de observaciones…").
- Entrada del grid con **stagger** (~40 ms entre celdas, 550 ms, convención del repo),
  contador animado del hero — TODO anulado por `prefers-reduced-motion` (el neutralizador
  global de theme.css cubre CSS; el contador JS chequea `matchMedia` y va directo al valor).
- Números SIEMPRE con `fmt()` es-CO. Tokens existentes (oro accesible, `shadow-glow`).
- **Cada celda carga lo suyo**: skeleton propio mientras carga, y si su fetch falla muestra
  "—" con un sutil "sin conexión al espejo" SIN tumbar el resto del grid.
- Heatmap: escala de color de azul (seco) a oro/rojo de marca (lluvioso) con leyenda mínima;
  accesible: la celda del heatmap lleva `aria-label` resumen ("calendario climático
  2001-2026; los meses más lluviosos históricamente son abril, mayo, octubre y noviembre").

## Arquitectura

| Pieza | Responsabilidad |
|---|---|
| `src/app/lib/dashboard.ts` (+ test) | Lógica pura: suma de observaciones del overview, serie 12 meses, "mes vs histórico" (%), matriz años×meses para el heatmap, escala de color, formato de frescura (se mueve desde Dashboard.tsx) |
| `src/app/components/dashboard/Celda.tsx` | Contenedor base de celda: button + hover/press + skeleton + estado error + aria |
| `src/app/components/dashboard/CeldaPulso.tsx`, `CeldaLluvia.tsx`, `CeldaCalendario.tsx`, `CeldaTop.tsx`, `CeldaDescargas.tsx`, `CeldaAcceso.tsx` | Una celda = un componente pequeño |
| `src/app/components/Dashboard.tsx` | Se REESCRIBE: solo el grid + composición de celdas (recibe `onNavigate`) |
| `src/app/App.tsx` | `<Dashboard onNavigate={navigate} />` (hoy no recibe props) |

El heatmap se construye con divs CSS grid (312 celdas máx), NO Recharts — más liviano y
controlable que un chart library para esta forma.

## Datos y derivaciones clave

- Serie mensual nacional completa: `POST /api/analytics/timeseries`
  `{datasetId:'s54a-sgyg', departments:[], interval:'month', metric:'avg'}` (sin fechas =
  toda la serie). De ahí salen: el heatmap (todos los meses), el sparkline (últimos 12) y
  el valor del mes en curso — **UN solo fetch alimenta 2 celdas** (se comparte por contexto
  o prop desde Dashboard).
- "Este mes vs histórico": valor del mes actual vs `monthly-climatology.months[m].mean`
  nacional; mostrar `±X %` con flecha y color (verde/rojo semánticos existentes).
- Total observaciones: `datasets-overview` — sumar el conteo de filas por dataset (verificar
  el nombre exacto del campo en `ideamContracts.ts` al implementar; si no existe conteo,
  fallback al copy "más de 760 millones" estático).

## Testing

- Vitest `src/app/lib/dashboard.test.ts`: matriz del heatmap (años ordenados, meses 1-12,
  huecos como null), escala de color (extremos y null), "mes vs histórico" (+%, -%, sin
  datos), suma del overview, últimos-12-meses con serie corta.
- Typecheck + build + suites completas; smoke en producción (vista carga, celdas responden).
- SIN screenshots (preferencia de Sergio — él revisa en vivo).

## Fuera de alcance (YAGNI)

Heatmap diario por departamento, personalización/reordenamiento de celdas, expansión
in-place, métricas de otras variables en el bento (solo precipitación como variable viva).
