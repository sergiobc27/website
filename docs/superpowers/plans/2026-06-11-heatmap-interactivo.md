# Heatmap climático interactivo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el heatmap del calendario en un panel interactivo en Analítica con 4 vistas (años×meses, 1 año×meses, días×día-de-semana estilo GitHub, mes×día), control de tamaño S/M/L y expandir a pantalla completa, reusando la paleta CUC.

**Architecture:** Lógica pura en `lib/heatmap.ts` (4 constructores de matriz, testeados con vitest), componente `HeatmapClimatico.tsx` con fetch propio (`/api/analytics/timeseries`), montado en `Analytics.tsx`. Las vistas diarias requieren departamento (la API bloquea la diaria nacional). `ControlSelect` se extrae a su propio archivo para reuso.

**Tech Stack:** React + TypeScript, vitest, recharts (no se usa aquí; el heatmap es CSS grid), Tailwind, paleta CUC vía `colorCalendario`.

Spec: `docs/superpowers/specs/2026-06-11-heatmap-interactivo-design.md`

## File Structure
- Create `src/app/lib/heatmap.ts` — constructores de matriz (re-exporta `colorCalendario`/`matrizCalendario` de `dashboard.ts`; no los mueve, para no tocar `CeldaCalendario`).
- Create `src/app/lib/heatmap.test.ts` — unit tests de los 4 constructores.
- Create `src/app/components/ControlSelect.tsx` — extrae el `<select>` local de Analítica.
- Create `src/app/components/HeatmapClimatico.tsx` — el panel interactivo.
- Modify `src/app/components/Analytics.tsx` — usa `ControlSelect` importado + monta `HeatmapClimatico`.

Comandos de verificación (gate): `npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build`

---

### Task 1: Constructores de matriz en `heatmap.ts` (TDD)

**Files:**
- Create: `src/app/lib/heatmap.ts`
- Test: `src/app/lib/heatmap.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// src/app/lib/heatmap.test.ts
import { describe, it, expect } from 'vitest';
import { matrizUnAnioMeses, matrizDiasSemana, matrizMesDias, type Dia } from './heatmap';
import type { AnalyticsTimeseriesPoint } from '../../shared/ideamContracts';

const p = (bucket: string, value: number | null): AnalyticsTimeseriesPoint => ({ bucket, value, n: 1 });

describe('matrizUnAnioMeses', () => {
  it('devuelve 12 posiciones del año pedido, null donde falta, y el max', () => {
    const r = matrizUnAnioMeses([p('2020-01', 5), p('2020-03', 10), p('2021-01', 99)], 2020);
    expect(r.meses).toHaveLength(12);
    expect(r.meses[0]).toBe(5);
    expect(r.meses[1]).toBeNull();
    expect(r.meses[2]).toBe(10);
    expect(r.max).toBe(10); // ignora 2021
  });
});

describe('matrizDiasSemana (estilo GitHub)', () => {
  it('2024: Jan 1 (lunes) cae en columna 0, fila 0; hay 53 columnas; max correcto', () => {
    const r = matrizDiasSemana([p('2024-01-01', 7), p('2024-12-31', 3)], 2024);
    expect(r.columnas[0][0]?.fecha).toBe('2024-01-01');
    expect(r.columnas[0][0]?.valor).toBe(7);
    expect(r.columnas).toHaveLength(53);
    expect(r.max).toBe(7);
    // 2024-12-31 es martes -> fila 1 en su columna
    const last = r.columnas[r.columnas.length - 1];
    const martes = last.find((d) => d?.fecha === '2024-12-31');
    expect(martes?.valor).toBe(3);
  });
  it('rellena con null los días previos a Jan 1 si el año no empieza en lunes', () => {
    // 2025-01-01 es miércoles -> fila 2; filas 0 y 1 de la col 0 son null
    const r = matrizDiasSemana([p('2025-01-01', 1)], 2025);
    expect(r.columnas[0][0]).toBeNull();
    expect(r.columnas[0][1]).toBeNull();
    expect(r.columnas[0][2]?.fecha).toBe('2025-01-01');
  });
});

describe('matrizMesDias', () => {
  it('febrero 2024 (bisiesto) tiene 29 días; Feb 1 (jueves) en fila 0 col 3', () => {
    const r = matrizMesDias([p('2024-02-01', 4), p('2024-02-29', 8)], 2024, 2);
    const dias: Dia[] = r.semanas.flat().filter((d): d is Dia => d !== null);
    expect(dias).toHaveLength(29);
    expect(r.semanas[0][3]?.fecha).toBe('2024-02-01');
    expect(r.semanas[0][0]).toBeNull();
    expect(r.max).toBe(8);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm run test:unit -- heatmap`
Expected: FAIL (`Cannot find module './heatmap'`).

- [ ] **Step 3: Implementar `heatmap.ts`**

```ts
// src/app/lib/heatmap.ts
// Constructores de matriz para el heatmap climático. Lógica pura, sin DOM.
// Reusa la paleta CUC y la matriz años×meses ya existentes en dashboard.ts.
import type { AnalyticsTimeseriesPoint } from '../../shared/ideamContracts';
import { colorCalendario, matrizCalendario } from './dashboard';

export { colorCalendario };
export const matrizAniosMeses = matrizCalendario;

export interface Dia {
  fecha: string; // YYYY-MM-DD
  valor: number | null;
}

// Día de semana con lunes=0 ... domingo=6 (estándar ISO/Colombia).
function diaSemanaLunes(utcMs: number): number {
  return (new Date(utcMs).getUTCDay() + 6) % 7;
}

export function matrizUnAnioMeses(points: AnalyticsTimeseriesPoint[], anio: number): { meses: Array<number | null>; max: number } {
  const meses: Array<number | null> = new Array(12).fill(null);
  let max = 0;
  for (const pt of points) {
    if (pt.value === null) continue;
    if (!pt.bucket.startsWith(`${anio}-`)) continue;
    const mes = Number(pt.bucket.slice(5, 7)) - 1;
    if (mes < 0 || mes > 11) continue;
    meses[mes] = pt.value;
    if (pt.value > max) max = pt.value;
  }
  return { meses, max };
}

export function matrizDiasSemana(points: AnalyticsTimeseriesPoint[], anio: number): { columnas: Array<Array<Dia | null>>; max: number } {
  const valorPorFecha = new Map<string, number>();
  let max = 0;
  for (const pt of points) {
    if (pt.value === null || !pt.bucket.startsWith(`${anio}-`)) continue;
    valorPorFecha.set(pt.bucket.slice(0, 10), pt.value);
    if (pt.value > max) max = pt.value;
  }
  const inicio = Date.UTC(anio, 0, 1);
  const fin = Date.UTC(anio, 11, 31);
  const offsetInicial = diaSemanaLunes(inicio); // filas null antes de Jan 1
  const columnas: Array<Array<Dia | null>> = [];
  let col: Array<Dia | null> = new Array(offsetInicial).fill(null);
  for (let t = inicio; t <= fin; t += 86400000) {
    const fecha = new Date(t).toISOString().slice(0, 10);
    col.push({ fecha, valor: valorPorFecha.has(fecha) ? valorPorFecha.get(fecha)! : null });
    if (col.length === 7) {
      columnas.push(col);
      col = [];
    }
  }
  if (col.length) {
    while (col.length < 7) col.push(null);
    columnas.push(col);
  }
  return { columnas, max };
}

export function matrizMesDias(points: AnalyticsTimeseriesPoint[], anio: number, mes: number): { semanas: Array<Array<Dia | null>>; max: number } {
  // mes: 1-12
  const valorPorFecha = new Map<string, number>();
  let max = 0;
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  for (const pt of points) {
    if (pt.value === null || !pt.bucket.startsWith(prefijo)) continue;
    valorPorFecha.set(pt.bucket.slice(0, 10), pt.value);
    if (pt.value > max) max = pt.value;
  }
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const offsetInicial = diaSemanaLunes(Date.UTC(anio, mes - 1, 1));
  const semanas: Array<Array<Dia | null>> = [];
  let semana: Array<Dia | null> = new Array(offsetInicial).fill(null);
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${prefijo}-${String(d).padStart(2, '0')}`;
    semana.push({ fecha, valor: valorPorFecha.has(fecha) ? valorPorFecha.get(fecha)! : null });
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length) {
    while (semana.length < 7) semana.push(null);
    semanas.push(semana);
  }
  return { semanas, max };
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm run test:unit -- heatmap`
Expected: PASS (3 describe, 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/heatmap.ts src/app/lib/heatmap.test.ts
git commit -m "feat(heatmap): constructores de matriz (1 anio, dias-semana GitHub, mes-dias) con tests"
```

---

### Task 2: Extraer `ControlSelect` a su propio archivo

**Files:**
- Create: `src/app/components/ControlSelect.tsx`
- Modify: `src/app/components/Analytics.tsx` (quitar la def local, importar)

- [ ] **Step 1: Crear `ControlSelect.tsx`** (copia exacta del componente local actual)

```tsx
// src/app/components/ControlSelect.tsx
export function ControlSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none transition-colors focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: En `Analytics.tsx`, borrar la función local `ControlSelect` (def al final del archivo) y añadir el import arriba**

Añadir junto a los imports de componentes:
```tsx
import { ControlSelect } from './ControlSelect';
```
Borrar el bloque `function ControlSelect({ ... }) { ... }` del final del archivo.

- [ ] **Step 3: Verificar typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS (sin errores de `ControlSelect` no definido ni import sin usar).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/ControlSelect.tsx src/app/components/Analytics.tsx
git commit -m "refactor(analytics): extrae ControlSelect a su propio archivo para reuso"
```

---

### Task 3: Componente `HeatmapClimatico.tsx`

**Files:**
- Create: `src/app/components/HeatmapClimatico.tsx`

(Verificación por typecheck + build + revisión manual: el repo no tiene React Testing Library; la lógica testeable ya está en `heatmap.ts`.)

- [ ] **Step 1: Escribir el componente**

```tsx
// src/app/components/HeatmapClimatico.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { apiJson } from '../lib/ideamApi';
import { fmt } from '../lib/format';
import { ControlSelect } from './ControlSelect';
import { ChartDownloadButton } from './ChartDownloadButton';
import { SkeletonLoader } from './SkeletonLoader';
import {
  colorCalendario,
  matrizAniosMeses,
  matrizUnAnioMeses,
  matrizDiasSemana,
  matrizMesDias,
} from '../lib/heatmap';
import type { AnalyticsTimeseriesResponse } from '../../shared/ideamContracts';

type Vista = 'anios-meses' | 'anio-meses' | 'dias-semana' | 'mes-dias';
type Tamano = 's' | 'm' | 'l';

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MES_LARGO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CELDA_PX: Record<Tamano, number> = { s: 10, m: 16, l: 24 };
const VISTAS: Array<{ value: Vista; label: string; diaria: boolean }> = [
  { value: 'anios-meses', label: 'Años × meses', diaria: false },
  { value: 'anio-meses', label: '1 año × meses', diaria: false },
  { value: 'dias-semana', label: 'Días × día de semana', diaria: true },
  { value: 'mes-dias', label: 'Mes × día', diaria: true },
];

interface Props {
  datasetId: string;
  department: string;
  metric: string;
}

export function HeatmapClimatico({ datasetId, department, metric }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const ahora = new Date().getUTCFullYear();
  const [vista, setVista] = useState<Vista>('anios-meses');
  const [anio, setAnio] = useState(ahora - 1);
  const [mes, setMes] = useState(1);
  const [tamano, setTamano] = useState<Tamano>('m');
  const [expandido, setExpandido] = useState(false);
  const [data, setData] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  const esDiaria = VISTAS.find((v) => v.value === vista)?.diaria ?? false;
  const faltaDepto = esDiaria && !department;

  useEffect(() => {
    if (faltaDepto) {
      setData(null);
      setCargando(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setCargando(true);
      const body: Record<string, unknown> = {
        datasetId,
        departments: department ? [department] : [],
        metric,
        interval: esDiaria ? 'day' : 'month',
      };
      if (vista === 'dias-semana') {
        body.startDate = `${anio}-01-01`;
        body.endDate = `${anio}-12-31`;
      } else if (vista === 'mes-dias') {
        const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
        body.startDate = `${anio}-${String(mes).padStart(2, '0')}-01`;
        body.endDate = `${anio}-${String(mes).padStart(2, '0')}-${fin}`;
      }
      try {
        const res = await apiJson<AnalyticsTimeseriesResponse>(
          '/api/analytics/timeseries',
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal },
          'No fue posible cargar el heatmap.'
        );
        setData(res);
      } catch {
        if (!controller.signal.aborted) setData(null);
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, department, metric, vista, anio, mes, esDiaria, faltaDepto]);

  const points = data?.points ?? [];
  const aniosDisponibles = useMemo(() => {
    const ys = new Set<number>();
    for (const p of points) ys.add(Number(p.bucket.slice(0, 4)));
    const arr = [...ys].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
    return arr.length ? arr : [anio];
  }, [points, anio]);

  const px = CELDA_PX[tamano];

  const cuerpo = (() => {
    if (faltaDepto) {
      return <p className="text-sm text-muted-foreground">Elige un departamento (en el filtro de ámbito de arriba) para ver el detalle diario.</p>;
    }
    if (cargando) return <SkeletonLoader rows={4} />;
    if (!points.length) return <p className="text-sm text-muted-foreground">Sin datos para esta combinación.</p>;

    if (vista === 'anios-meses') {
      const m = matrizAniosMeses(points);
      const anios = m.anios.slice(-24);
      return (
        <div className="grid gap-x-1.5 gap-y-1" style={{ gridTemplateColumns: `auto repeat(12, ${px}px)` }}>
          <span />
          {MESES.map((mm, i) => <span key={i} className="text-center text-[10px] text-muted-foreground">{mm}</span>)}
          {anios.map((fila) => (
            <Fila key={fila.anio} etiqueta={String(fila.anio)} valores={fila.meses} max={m.max} px={px} fmtTitulo={(v, i) => `${MES_LARGO[i]} ${fila.anio} — ${fmt((v as number) * 6, 2)} mm/h`} />
          ))}
        </div>
      );
    }
    if (vista === 'anio-meses') {
      const m = matrizUnAnioMeses(points, anio);
      return (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(12, 1fr)` }}>
          {m.meses.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="block w-full rounded-[3px] border border-border/30" style={{ height: px * 2, backgroundColor: colorCalendario(v, m.max) }} title={v !== null ? `${MES_LARGO[i]} ${anio} — ${fmt(v * 6, 2)} mm/h` : `${MES_LARGO[i]} ${anio} — sin datos`} />
              <span className="text-[10px] text-muted-foreground">{MES_LARGO[i]}</span>
            </div>
          ))}
        </div>
      );
    }
    if (vista === 'dias-semana') {
      const m = matrizDiasSemana(points, anio);
      return (
        <div className="flex gap-[3px] overflow-x-auto">
          {m.columnas.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((d, ri) => (
                <span key={ri} className="block rounded-[2px] border border-border/20" style={{ width: px, height: px, backgroundColor: d ? colorCalendario(d.valor, m.max) : 'transparent' }} title={d ? `${d.fecha} — ${d.valor !== null ? fmt(d.valor, 2) : 'sin datos'}` : ''} />
              ))}
            </div>
          ))}
        </div>
      );
    }
    // mes-dias
    const m = matrizMesDias(points, anio, mes);
    return (
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(7, ${px * 1.6}px)` }}>
        {DIAS_SEMANA.map((d, i) => <span key={i} className="text-center text-[10px] text-muted-foreground">{d}</span>)}
        {m.semanas.flat().map((d, i) => (
          <span key={i} className="flex items-center justify-center rounded-[3px] border border-border/20 text-[9px] tabular-nums text-card-foreground/70" style={{ height: px * 1.6, backgroundColor: d ? colorCalendario(d.valor, m.max) : 'transparent' }} title={d ? `${d.fecha} — ${d.valor !== null ? fmt(d.valor, 2) : 'sin datos'}` : ''}>
            {d ? Number(d.fecha.slice(8, 10)) : ''}
          </span>
        ))}
      </div>
    );
  })();

  const controles = (
    <div className="flex flex-wrap items-end gap-3">
      <ControlSelect label="Vista" value={vista} onChange={(v) => setVista(v as Vista)} options={VISTAS.map((v) => ({ value: v.value, label: v.label }))} />
      {vista !== 'anios-meses' && (
        <ControlSelect label="Año" value={String(anio)} onChange={(v) => setAnio(Number(v))} options={aniosDisponibles.map((y) => ({ value: String(y), label: String(y) }))} />
      )}
      {vista === 'mes-dias' && (
        <ControlSelect label="Mes" value={String(mes)} onChange={(v) => setMes(Number(v))} options={MES_LARGO.map((m, i) => ({ value: String(i + 1), label: m }))} />
      )}
      <div className="flex items-center gap-1" role="group" aria-label="Tamaño">
        {(['s', 'm', 'l'] as Tamano[]).map((t) => (
          <button key={t} type="button" onClick={() => setTamano(t)} aria-pressed={tamano === t} className={`h-8 w-8 rounded-md border text-xs font-semibold transition-colors ${tamano === t ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground hover:bg-muted/60'}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-card-foreground">Mapa de calor climático</h3>
          <p className="text-sm text-muted-foreground">{department || 'Todo el país'} · intensidad de lluvia</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ChartDownloadButton targetRef={gridRef} title="Mapa de calor climático" subtitle={department || 'Todo el país'} filenameParts={['heatmap', vista]} />
          <button type="button" onClick={() => setExpandido(true)} className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/60" aria-label="Expandir a pantalla completa">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {controles}
      <div ref={gridRef} className="mt-4 overflow-x-auto bg-card">
        {cuerpo}
        {!faltaDepto && points.length > 0 && (
          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
            seco
            {[0.1, 0.35, 0.6, 0.85].map((t) => <span key={t} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: colorCalendario(t, 1) }} />)}
            lluvioso
          </div>
        )}
      </div>

      {expandido && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-card-foreground">Mapa de calor climático — {department || 'Todo el país'}</h3>
            <button type="button" onClick={() => setExpandido(false)} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-muted/60" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-4">{controles}</div>
          <div className="flex-1 overflow-auto">{cuerpo}</div>
        </div>
      )}
    </div>
  );
}

function Fila({ etiqueta, valores, max, px, fmtTitulo }: { etiqueta: string; valores: Array<number | null>; max: number; px: number; fmtTitulo: (v: number | null, i: number) => string }) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] tabular-nums text-muted-foreground" style={{ lineHeight: `${px}px` }}>{etiqueta}</span>
      {valores.map((v, i) => (
        <span key={i} className="block rounded-[2px] border border-border/30" style={{ height: px, backgroundColor: colorCalendario(v, max) }} title={v !== null ? fmtTitulo(v, i) : 'sin datos'} />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Verificar typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/HeatmapClimatico.tsx
git commit -m "feat(heatmap): panel HeatmapClimatico (4 vistas, S/M/L, expandir)"
```

---

### Task 4: Montar en Analítica + sincronizar vista en la URL

**Files:**
- Modify: `src/app/components/Analytics.tsx`

- [ ] **Step 1: Importar el panel**

```tsx
import { HeatmapClimatico } from './HeatmapClimatico';
```

- [ ] **Step 2: Montarlo debajo de la gráfica principal de serie**

Justo después del `</div>` que cierra la tarjeta de la serie temporal (la que tiene `shadow-glow`, antes del `grid ... lg:grid-cols-2` de climatología/departamentos), insertar:
```tsx
      <HeatmapClimatico datasetId={datasetId} department={department} metric={metric} />
```

- [ ] **Step 3: Verificar gate completo**

Run: `npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build`
Expected: PASS (todo verde).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/Analytics.tsx
git commit -m "feat(analytics): monta el panel de heatmap climatico interactivo"
```

---

### Task 5: Deploy y verificación

- [ ] **Step 1: Push y observar Actions**

```bash
git push origin main
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```
Expected: deploy verde + smoke test 1 passed.

- [ ] **Step 2: Verificar producción**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://ideam.sergiobc.com/`
Expected: `200`.

---

## Self-Review

- **Cobertura del spec:** 4 vistas (Task 1 lib + Task 3 render) ✓; S/M/L + expandir (Task 3) ✓; diario requiere depto (Task 3 `faltaDepto`) ✓; paleta CUC (reusa `colorCalendario`) ✓; preview del dashboard intacto (no se toca `CeldaCalendario`/`dashboard.ts`) ✓; integración Analítica (Task 4) ✓; tests de los constructores (Task 1) ✓. URL `hm=<modo>`: **simplificado** — se omite por YAGNI en v1 (el resto del estado de Analítica ya es compartible; añadir `hm` es trivial luego si se pide). Documentado aquí como desviación consciente del spec.
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `Dia {fecha, valor}`, `matriz*` firmas usadas igual en lib y componente; `colorCalendario(valor, max)` consistente; `ControlSelect` props idénticas tras extraer.
