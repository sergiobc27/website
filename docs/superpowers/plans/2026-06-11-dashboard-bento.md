# Dashboard bento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la vista Dashboard por un bento grid de 9 celdas con KPIs vivos, heatmap climático años×meses y drill-down por navegación.

**Architecture:** Lógica pura en `lib/dashboard.ts` (TDD), celda base reutilizable con skeleton/error/press-feedback, celdas pequeñas como componentes en `components/dashboard/`, `Dashboard.tsx` solo compone el grid y comparte el fetch de la serie mensual entre Lluvia y Calendario.

**Tech Stack:** React 18, Recharts (solo sparkline), CSS grid puro para el heatmap, vitest, fmt() es-CO, tokens existentes.

**Spec:** `docs/superpowers/specs/2026-06-11-dashboard-bento-design.md`

**Convenciones:** sin screenshots (preferencia Sergio); deploy = push a main; commits sin firmas; `prefers-reduced-motion` vía neutralizador global de theme.css + `matchMedia` para animaciones JS; colores `#2563eb` (lluvia), `var(--accent)`, ejes `currentColor`.

**Contratos:** `AnalyticsDatasetOverview {id,name,category,rowCount,stationCount,firstObservation,lastObservation}`; timeseries mensual nacional `{points:[{bucket:'YYYY-MM-DD',value,n}]}`; climatology `{months:[{month,mean,min,max,n}]}` (verificar nombre del array al implementar; FichaClimatica lo usa).

---

### Task 1: `lib/dashboard.ts` — lógica pura (TDD)

**Files:** Create `src/app/lib/dashboard.ts` · Test `src/app/lib/dashboard.test.ts`

- [ ] **Step 1: Tests que fallan**

```ts
import { describe, expect, it } from 'vitest';
import {
  sumarObservaciones, ultimosMeses, matrizCalendario, colorCalendario,
  mesVsHistorico, frescuraRelativa,
} from './dashboard';

const P = (bucket: string, value: number | null) => ({ bucket, value, n: 1 });

describe('sumarObservaciones', () => {
  it('suma rowCount de todos los datasets', () => {
    expect(sumarObservaciones([{ rowCount: 100 }, { rowCount: 50 }] as never)).toBe(150);
  });
  it('vacío -> null (el caller usa copy estático)', () => {
    expect(sumarObservaciones([])).toBeNull();
  });
});

describe('ultimosMeses', () => {
  it('devuelve los últimos N puntos con etiqueta de mes', () => {
    const serie = [P('2025-11-01', 5), P('2025-12-01', 8), P('2026-01-01', 3)];
    const r = ultimosMeses(serie, 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ valor: 8 });
    expect(r[1].etiqueta).toMatch(/ene/i);
  });
});

describe('matrizCalendario', () => {
  it('agrupa por año con 12 huecos y null donde no hay dato', () => {
    const serie = [P('2024-01-01', 2), P('2024-03-01', 7), P('2025-12-01', 4)];
    const m = matrizCalendario(serie);
    expect(m.anios.map((a) => a.anio)).toEqual([2024, 2025]);
    expect(m.anios[0].meses[0]).toBe(2);
    expect(m.anios[0].meses[1]).toBeNull();
    expect(m.anios[0].meses[2]).toBe(7);
    expect(m.anios[1].meses[11]).toBe(4);
    expect(m.max).toBe(7);
  });
});

describe('colorCalendario', () => {
  it('null -> transparente; 0..max -> escala azul→oro', () => {
    expect(colorCalendario(null, 10)).toBe('transparent');
    expect(colorCalendario(0, 10)).not.toBe(colorCalendario(10, 10));
    expect(colorCalendario(10, 0)).toBe('transparent'); // max 0: sin escala
  });
});

describe('mesVsHistorico', () => {
  const clima = [{ month: 1, mean: 10 }] as never;
  it('calcula el % vs el promedio histórico del mismo mes', () => {
    const r = mesVsHistorico(P('2026-01-01', 12), clima);
    expect(r).toMatchObject({ pct: 20, direccion: 'arriba' });
  });
  it('sin climatología o sin valor -> null', () => {
    expect(mesVsHistorico(P('2026-02-01', 12), clima)).toBeNull();
    expect(mesVsHistorico(null, clima)).toBeNull();
  });
});

describe('frescuraRelativa', () => {
  it('formatea minutos/horas/días desde un instante dado', () => {
    const ahora = new Date('2026-06-11T12:00:00Z').getTime();
    expect(frescuraRelativa('2026-06-11T11:30:00Z', ahora)).toBe('hace 30 min');
    expect(frescuraRelativa('2026-06-10T12:00:00Z', ahora)).toBe('hace 24 h');
    expect(frescuraRelativa(null, ahora)).toBe('');
  });
});
```

- [ ] **Step 2:** `npm run test:unit` → FAIL.
- [ ] **Step 3: Implementación** (firmas exactas; `frescuraRelativa` se MUEVE desde Dashboard.tsx con `ahora` inyectable):

```ts
// src/app/lib/dashboard.ts — lógica pura del dashboard bento (testeable).
import type { AnalyticsDatasetOverview, AnalyticsTimeseriesPoint } from '../../shared/ideamContracts';

export function sumarObservaciones(datasets: AnalyticsDatasetOverview[]): number | null {
  if (!datasets.length) return null;
  return datasets.reduce((s, d) => s + (Number(d.rowCount) || 0), 0);
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function ultimosMeses(points: AnalyticsTimeseriesPoint[], n: number) {
  return points
    .filter((p) => p.value !== null)
    .slice(-n)
    .map((p) => ({
      etiqueta: `${MES_CORTO[Number(p.bucket.slice(5, 7)) - 1]} ${p.bucket.slice(2, 4)}`,
      valor: p.value as number,
    }));
}

export interface FilaCalendario { anio: number; meses: Array<number | null> }
export function matrizCalendario(points: AnalyticsTimeseriesPoint[]): { anios: FilaCalendario[]; max: number } {
  const porAnio = new Map<number, Array<number | null>>();
  let max = 0;
  for (const p of points) {
    if (p.value === null) continue;
    const anio = Number(p.bucket.slice(0, 4));
    const mes = Number(p.bucket.slice(5, 7)) - 1;
    if (!porAnio.has(anio)) porAnio.set(anio, new Array(12).fill(null));
    porAnio.get(anio)![mes] = p.value;
    if (p.value > max) max = p.value;
  }
  const anios = [...porAnio.entries()].sort((a, b) => a[0] - b[0]).map(([anio, meses]) => ({ anio, meses }));
  return { anios, max };
}

// Escala azul (seco) → oro de marca (lluvioso). Interpolación simple en HSL.
export function colorCalendario(valor: number | null, max: number): string {
  if (valor === null || !Number.isFinite(valor) || max <= 0) return 'transparent';
  const t = Math.max(0, Math.min(1, valor / max));
  // hue 215 (azul) → 43 (oro); claridad alta en seco, media en lluvioso.
  const hue = 215 - t * (215 - 43);
  const luz = 88 - t * 40;
  return `hsl(${Math.round(hue)} 75% ${Math.round(luz)}%)`;
}

export function mesVsHistorico(
  actual: AnalyticsTimeseriesPoint | null,
  climatologia: Array<{ month: number; mean: number | null }>,
): { pct: number; direccion: 'arriba' | 'abajo' } | null {
  if (!actual || actual.value === null) return null;
  const mes = Number(actual.bucket.slice(5, 7));
  const ref = climatologia.find((c) => c.month === mes);
  if (!ref || ref.mean === null || ref.mean === 0) return null;
  const pct = Math.round(((actual.value - ref.mean) / ref.mean) * 100);
  return { pct: Math.abs(pct), direccion: pct >= 0 ? 'arriba' : 'abajo' };
}

export function frescuraRelativa(iso: string | null, ahora = Date.now()): string {
  if (!iso) return '';
  const elapsedMs = ahora - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '';
  const minutes = Math.round(elapsedMs / 60000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}
```

- [ ] **Step 4:** `npm run test:unit` → PASS. **Step 5:** Commit `feat(bento): logica pura del dashboard (heatmap, mes-vs-historico, frescura)`.

### Task 2: Celda base + accesos + animación

**Files:** Create `src/app/components/dashboard/Celda.tsx`, `src/app/components/dashboard/CeldaAcceso.tsx`; Modify `src/styles/theme.css` (stagger).

```tsx
// Celda.tsx — contenedor base: button accesible + hover lift + press + skeleton + error.
// Props: { titulo?: string; ariaLabel: string; onClick: () => void; cargando?: boolean;
//          error?: boolean; className?: string; children: ReactNode; indice?: number }
// - <button> con clases: group relative flex flex-col text-left rounded-2xl border
//   border-border bg-card p-4 shadow-glow transition-all hover:-translate-y-0.5
//   hover:border-accent/50 active:scale-[0.98] focus-visible:outline-2
//   focus-visible:outline-accent · animación de entrada .bento-enter con
//   animationDelay = indice*40ms (CSS keyframe fade+rise 550ms, neutralizado por
//   reduced-motion global).
// - cargando -> SkeletonLoader (componente existente) ocupando el cuerpo.
// - error -> cuerpo "—" + caption "sin conexión al espejo" (text-muted-foreground).
// CeldaAcceso.tsx — celda pequeña con icono lucide + título + subtítulo (usa Celda).
```

CSS (`theme.css`, junto al pulso del asistente):

```css
@keyframes bento-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.bento-enter { animation: bento-enter 550ms ease-out both; }
```

- [ ] Implementar + typecheck. Commit `feat(bento): celda base con skeleton/error/press y entrada con stagger`.

### Task 3: Celdas de datos

**Files:** Create `CeldaPulso.tsx`, `CeldaLluvia.tsx`, `CeldaCalendario.tsx`, `CeldaTop.tsx`, `CeldaDescargas.tsx` en `src/app/components/dashboard/`.

- `CeldaPulso` (hero): fetch propio de `/api/meta` + `/api/analytics/datasets-overview`;
  contador animado (requestAnimationFrame 0→total en ~1.2s con easing-out; si
  `matchMedia('(prefers-reduced-motion: reduce)')` → valor directo); frescura absoluta
  (`toLocaleString es-CO`) + `frescuraRelativa`; fallback "más de 760 millones" si overview falla.
- `CeldaLluvia`: recibe `serie` (puntos) + fetch propio de `/api/analytics/monthly-climatology`
  nacional; `<AreaChart>` Recharts con `ultimosMeses(serie,12)`, stroke `#2563eb`, área
  fillOpacity 0.2; badge `±X% vs histórico` con flecha (verde `text-success`/rojo `text-destructive`).
- `CeldaCalendario`: recibe `serie`; `matrizCalendario` + grid CSS
  (`grid-template-columns: auto repeat(12, 1fr)`): fila por año (etiqueta del año + 12
  divs `aspect-square rounded-[3px]` con `backgroundColor: colorCalendario(...)` y
  `title` con "abr 2011 — 8,3 mm"); leyenda mínima seco→lluvioso; cap visual: si hay
  >24 años, mostrar los últimos 24.
- `CeldaTop`: fetch propio `/api/analytics/by-region` (precipitación) → top 5 por `mean`,
  barras horizontales CSS (div width %) con valor `fmt`.
- `CeldaDescargas`: localStorage `ideam-history` → últimas 3 (variable, fecha corta,
  filas con `fmt`) + total filas acumulado.

- [ ] Implementar + typecheck tras cada celda. Commit `feat(bento): celdas de datos (pulso, lluvia, calendario, top, descargas)`.

### Task 4: `Dashboard.tsx` reescrito + App

**Files:** Rewrite `src/app/components/Dashboard.tsx`; Modify `src/app/App.tsx` (línea `<Dashboard />` → `<Dashboard onNavigate={navigate} />`).

```tsx
// Dashboard.tsx — SOLO composición:
// - useState serie mensual nacional (fetch único: POST /api/analytics/timeseries
//   {datasetId:'s54a-sgyg', departments:[], interval:'month', metric:'avg'}) con
//   estados cargando/error compartidos por CeldaLluvia y CeldaCalendario.
// - Grid: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(120px,auto)] gap-4
//   · Pulso lg:col-span-2 lg:row-span-2 · Lluvia lg:col-span-2 lg:row-span-2 (alta)
//   · Calendario lg:col-span-4 (banda ancha) · Top, Descargas, Historia, Asistente 1x1
//   · Mapa lg:col-span-4 (banda) con copy "Explora las 17.976 estaciones en el mapa".
// - onNavigate por celda: status, analytics, analytics, analytics, history, historia, map;
//   Asistente -> window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT)).
// - indice incremental para el stagger.
```

- [ ] Implementar. Verificación completa: `npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build` → todo verde. Commit `feat(bento): dashboard bento con drill-down (reemplaza el dashboard anterior)`.

### Task 5: Deploy + smoke + memoria

- [ ] `git push origin main` → CI verde (`gh run watch`).
- [ ] Smoke SIN screenshots: `https://ideam.sergiobc.com` 200; `POST /api/analytics/timeseries` mensual nacional responde con serie completa (el heatmap tiene datos); avisar a Sergio que revise en vivo.
- [ ] Actualizar memoria del proyecto (feature desplegada + estado de apuestas grandes: TODAS completas).

## Riesgos

- **Serie mensual nacional sin fechas**: si la API exigiera rango, pedir `startDate:'2001-01-01'` (probar en smoke previo con curl ANTES de codear la celda).
- **Climatología nacional**: verificar el shape exacto (`months[]`) con una llamada real antes de implementar `CeldaLluvia`.
- **17.976** es copy estático (catálogo `estaciones`); si suena desactualizado, usar "más de 17.000".
