# Trazabilidad visible en la calculadora (Plan 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hacer visible y verificable en la página de la calculadora de dónde sale cada número: mostrar las tablas de la norma (coeficiente C, períodos de retorno, factor de frecuencia) con su cita exacta, y un bloque de "cálculo paso a paso" que sustituye los valores reales del usuario en cada fórmula con su referencia.

**Architecture:** Componentes nuevos pequeños (`CitaFuente`, `TablaNormaView`, `CalculoPasoAPaso`) que leen de un módulo de datos (`tablasNorma.ts`) y de la bibliografía existente (`referencias.ts`). Se insertan en `SeccionCoefC.tsx`, `CalculadoraCaudal.tsx` y la sección de parámetros. No cambia ninguna lógica de cálculo (eso fue el Plan 1, ya en `main`); esto es presentación + trazabilidad.

**Tech Stack:** React + TypeScript, vitest. Sin dependencias nuevas. Usa el componente existente `Tooltip` (`src/app/components/Tooltip.tsx`) y los helpers `Formula/Frac/Sub/Sup/V` (`src/app/components/Formula.tsx`).

**Datos VERIFICADOS contra las fuentes** (leídos del texto/imagen oficial; usar EXACTAMENTE estos valores):
- C urbano = INVÍAS (2009) Tabla 2.9 (Ref. 2.9). C rural = INVÍAS (2009) Tabla 2.10 (Ref. 2.4).
- Tr vial = INVÍAS Tabla 2.8; Tr urbano = RAS 0330 Art. 135 Tabla 16 (ya en `OBRAS_TR`).
- Cf (factor de frecuencia del método racional) = Chow, Maidment & Mays (1988) — NO está en INVÍAS; se cita a Chow y se marca el localizador como por confirmar (regla de honestidad).

---

### Task 1: Tipo `Fuente`, entrada Chow 1988 y componente `CitaFuente`

**Files:**
- Create: `src/app/lib/hydro/fuentes.ts`
- Modify: `src/app/lib/referencias.ts` (añadir entrada `chow-applied-1988`)
- Create: `src/app/components/calculadora/CitaFuente.tsx`
- Test: `src/app/lib/hydro/fuentes.test.ts`

- [ ] **Step 1: Crear el tipo `Fuente` y un helper de búsqueda en bibliografía**

`src/app/lib/hydro/fuentes.ts`:

```ts
import { REFERENCIAS, type Referencia } from '../referencias';

/** Cita a una fuente del proyecto con el localizador EXACTO dentro de ella. */
export interface Fuente {
  /** id en REFERENCIAS (p. ej. 'invias-drenaje-2009', 'ras-0330', 'chow-applied-1988'). */
  ref: string;
  /** Localizador exacto: "Tabla 2.9 (pág. 2-39)", "Art. 135, Tabla 16", etc. */
  localizador: string;
  /** true solo si el localizador se confirmó contra la fuente primaria. */
  verificado: boolean;
  /** Nota honesta cuando verificado=false (qué falta por confirmar). */
  nota?: string;
}

export function referenciaDe(ref: string): Referencia | undefined {
  return REFERENCIAS.find((r) => r.id === ref);
}
```

- [ ] **Step 2: Escribir la prueba (la referencia debe existir; etiqueta legible)**

`src/app/lib/hydro/fuentes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { referenciaDe } from './fuentes';

describe('fuentes — referenciaDe', () => {
  it('resuelve una referencia existente', () => {
    expect(referenciaDe('invias-drenaje-2009')?.anio).toBe(2009);
    expect(referenciaDe('ras-0330')?.anio).toBe(2017);
  });
  it('Chow Applied Hydrology (1988) está en la bibliografía', () => {
    const c = referenciaDe('chow-applied-1988');
    expect(c).toBeTruthy();
    expect(c?.apa).toMatch(/Applied Hydrology/);
  });
  it('devuelve undefined si no existe', () => {
    expect(referenciaDe('no-existe')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `npx vitest run src/app/lib/hydro/fuentes.test.ts`
Expected: FALLA (`chow-applied-1988` no existe aún en REFERENCIAS).

- [ ] **Step 4: Añadir la entrada Chow 1988 a `referencias.ts`**

En `src/app/lib/referencias.ts`, dentro del arreglo `REFERENCIAS`, en la sección "Métodos hidrológicos e hidráulica" (tras la entrada `chow-1959`), añadir:

```ts
  {
    id: 'chow-applied-1988',
    apa: 'Chow, V. T., Maidment, D. R., & Mays, L. W. (1988). Applied Hydrology. McGraw-Hill.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1988,
    usadoEn: ['Calculadora', 'Período de retorno'],
  },
```

- [ ] **Step 5: Correr y ver pasar**

Run: `npx vitest run src/app/lib/hydro/fuentes.test.ts`
Expected: PASA.

- [ ] **Step 6: Crear el componente `CitaFuente`**

`src/app/components/calculadora/CitaFuente.tsx`:

```tsx
import { Tooltip } from '../Tooltip';
import { referenciaDe, type Fuente } from '../../lib/hydro/fuentes';

/** Muestra "INVÍAS (2009), Tabla 2.9" con tooltip de la cita APA completa.
 * Si la fuente no está verificada, lo dice de forma honesta (no inventa). */
export function CitaFuente({ fuente }: { fuente: Fuente }) {
  const ref = referenciaDe(fuente.ref);
  const autorAnio = ref ? `${ref.apa.split('(')[0].trim()} (${ref.anio})` : fuente.ref;
  const etiqueta = `${autorAnio}, ${fuente.localizador}`;
  return (
    <Tooltip content={ref?.apa ?? 'Referencia no encontrada'}>
      <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2">
        Fuente: {etiqueta}
        {!fuente.verificado && (
          <span className="text-amber-400" title={fuente.nota ?? 'Localizador por confirmar'}>
            (localizador por confirmar)
          </span>
        )}
      </span>
    </Tooltip>
  );
}
```

- [ ] **Step 7: Verificar tipos y commit**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add src/app/lib/hydro/fuentes.ts src/app/lib/hydro/fuentes.test.ts src/app/lib/referencias.ts src/app/components/calculadora/CitaFuente.tsx
git commit -m "feat(calc): tipo Fuente con localizador + componente CitaFuente + Chow (1988) en bibliografía"
```

---

### Task 2: Datos de las tablas de norma (`tablasNorma.ts`)

**Files:**
- Create: `src/app/lib/hydro/tablasNorma.ts`
- Test: `src/app/lib/hydro/tablasNorma.test.ts`

- [ ] **Step 1: Escribir la prueba con valores literales de la norma**

`src/app/lib/hydro/tablasNorma.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF, TABLA_TR_VIAL, TABLA_TR_URBANO } from './tablasNorma';
import { referenciaDe } from './fuentes';

describe('tablasNorma — citas válidas', () => {
  it('cada tabla cita una referencia que existe en la bibliografía', () => {
    for (const t of [TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF, TABLA_TR_VIAL, TABLA_TR_URBANO]) {
      expect(referenciaDe(t.fuente.ref)).toBeTruthy();
      expect(t.filas.length).toBeGreaterThan(0);
      expect(t.columnas.length).toBeGreaterThan(0);
    }
  });
});

describe('tablasNorma — valores literales verificados', () => {
  it('C urbano (INVÍAS Tabla 2.9): distritos comerciales centro de ciudad 0,70–0,95', () => {
    const fila = TABLA_C_URBANA.filas.find((f) => String(f[0]).includes('centro de ciudad'));
    expect(fila?.[1]).toBe('0,70 – 0,95');
  });
  it('C rural (INVÍAS Tabla 2.10): tierras cultivadas montañoso arcilloso 0,82', () => {
    const fila = TABLA_C_RURAL.filas.find((f) => String(f[0]).toLowerCase().includes('cultivadas') && String(f[0]).toLowerCase().includes('montañoso'));
    expect(fila?.[3]).toBe('0,82');
  });
  it('Cf (Chow 1988): Tr ≥ 100 → 1,25 y está marcado por confirmar', () => {
    const fila = TABLA_CF.filas.find((f) => String(f[0]).includes('100'));
    expect(fila?.[1]).toBe('1,25');
    expect(TABLA_CF.fuente.verificado).toBe(false);
  });
  it('Tr vial (INVÍAS Tabla 2.8) y urbano (RAS Tabla 16) se derivan de OBRAS_TR', () => {
    expect(TABLA_TR_VIAL.filas.some((f) => String(f[0]) === 'Cuneta' && f[1] === 5)).toBe(true);
    expect(TABLA_TR_URBANO.filas.some((f) => String(f[0]).includes('> 10 ha') && f[1] === 10)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/app/lib/hydro/tablasNorma.test.ts`
Expected: FALLA (módulo no existe).

- [ ] **Step 3: Crear `tablasNorma.ts` con los datos EXACTOS**

`src/app/lib/hydro/tablasNorma.ts`:

```ts
import type { Fuente } from './fuentes';
import { OBRAS_TR } from './runoff';

export interface TablaNorma {
  titulo: string;
  fuente: Fuente;
  columnas: string[];
  filas: Array<Array<string | number>>;
  nota?: string;
}

// ── Coeficiente de escorrentía C — áreas urbanas (INVÍAS 2009, Tabla 2.9) ──
export const TABLA_C_URBANA: TablaNorma = {
  titulo: 'Coeficiente de escorrentía C — áreas urbanas',
  fuente: { ref: 'invias-drenaje-2009', localizador: 'Tabla 2.9 (pág. 2-39)', verificado: true },
  columnas: ['Tipo de área de drenaje', 'C'],
  filas: [
    ['Prados — suelos arenosos, planos (2%)', '0,05 – 0,10'],
    ['Prados — suelos arenosos, promedio (2–7%)', '0,15 – 0,20'],
    ['Prados — suelos pesados (arcillosos), planos (2%)', '0,13 – 0,17'],
    ['Prados — suelos pesados (arcillosos), promedio (2–7%)', '0,18 – 0,22'],
    ['Prados — suelos pesados (arcillosos), pendientes (7%)', '0,25 – 0,35'],
    ['Distritos comerciales — áreas de centro de ciudad', '0,70 – 0,95'],
    ['Distritos comerciales — áreas vecinas', '0,50 – 0,70'],
    ['Residencial — casas individuales separadas', '0,30 – 0,50'],
    ['Residencial — casas multifamiliares separadas', '0,40 – 0,60'],
    ['Residencial — casas multifamiliares unidas', '0,60 – 0,75'],
    ['Residencial — suburbana', '0,25 – 0,40'],
    ['Residencial — áreas de apartamentos de vivienda', '0,50 – 0,70'],
    ['Industrial — áreas livianas', '0,50 – 0,80'],
    ['Industrial — áreas pesadas', '0,60 – 0,90'],
    ['Parques, cementerios', '0,10 – 0,25'],
    ['Campos de juego', '0,20 – 0,35'],
    ['Áreas de patios de ferrocarriles', '0,20 – 0,40'],
    ['Áreas no desarrolladas', '0,10 – 0,30'],
    ['Calles — asfaltadas', '0,70 – 0,95'],
    ['Calles — concreto', '0,80 – 0,95'],
    ['Calles — ladrillo', '0,70 – 0,85'],
    ['Calzadas y alamedas', '0,75 – 0,85'],
    ['Techos', '0,75 – 0,95'],
  ],
};

// ── Coeficiente de escorrentía C — áreas rurales (INVÍAS 2009, Tabla 2.10) ──
export const TABLA_C_RURAL: TablaNorma = {
  titulo: 'Coeficiente de escorrentía C — áreas rurales',
  fuente: { ref: 'invias-drenaje-2009', localizador: 'Tabla 2.10 (pág. 2-40)', verificado: true },
  columnas: ['Vegetación y topografía', 'Franco arenoso', 'Franco limo arcilloso', 'Arcilloso'],
  filas: [
    ['Bosques — plano', '0,10', '0,30', '0,40'],
    ['Bosques — ondulado', '0,25', '0,35', '0,50'],
    ['Bosques — montañoso', '0,30', '0,50', '0,60'],
    ['Pastos — plano', '0,10', '0,30', '0,40'],
    ['Pastos — ondulado', '0,16', '0,36', '0,55'],
    ['Pastos — montañoso', '0,22', '0,42', '0,60'],
    ['Tierras cultivadas — plano', '0,30', '0,50', '0,60'],
    ['Tierras cultivadas — ondulado', '0,40', '0,60', '0,70'],
    ['Tierras cultivadas — montañoso', '0,52', '0,72', '0,82'],
  ],
  nota: 'Plano: pendiente 0–5%. Ondulado: 5–10%. Montañoso: 10–30%. Para pendientes > 30%, a falta de datos, usar los valores de 10–30%.',
};

// ── Factor de frecuencia Cf del método racional (Chow, Maidment & Mays, 1988) ──
// NO aparece en el Manual INVÍAS; se cita a Chow y el localizador de tabla queda
// por confirmar contra la edición impresa (libro con derechos de autor).
export const TABLA_CF: TablaNorma = {
  titulo: 'Factor de frecuencia Cf (ajuste de C por período de retorno)',
  fuente: {
    ref: 'chow-applied-1988',
    localizador: 'factor de frecuencia del método racional',
    verificado: false,
    nota: 'Valores de Chow, Maidment & Mays (1988); el número exacto de tabla queda por confirmar en la edición impresa.',
  },
  columnas: ['Período de retorno Tr (años)', 'Cf'],
  filas: [
    ['≤ 10', '1,00'],
    ['25', '1,10'],
    ['50', '1,20'],
    ['≥ 100', '1,25'],
  ],
  nota: 'C de diseño = mín(1; C · Cf).',
};

// ── Períodos de retorno: se derivan de OBRAS_TR (única fuente de verdad) ──
export const TABLA_TR_VIAL: TablaNorma = {
  titulo: 'Períodos de retorno de diseño — obras de drenaje vial',
  fuente: { ref: 'invias-drenaje-2009', localizador: 'Tabla 2.8 (pág. 2-31)', verificado: true },
  columnas: ['Tipo de obra', 'Tr (años)'],
  filas: OBRAS_TR.filter((o) => o.fuente.startsWith('INVÍAS')).map((o) => [o.label, o.tr]),
};

export const TABLA_TR_URBANO: TablaNorma = {
  titulo: 'Períodos de retorno de diseño — drenaje urbano (por área tributaria)',
  fuente: { ref: 'ras-0330', localizador: 'Art. 135, Tabla 16', verificado: true },
  columnas: ['Característica del área de drenaje', 'Tr (años)'],
  filas: OBRAS_TR.filter((o) => o.fuente.startsWith('RAS')).map((o) => [o.label, o.tr]),
};
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/app/lib/hydro/tablasNorma.test.ts`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/hydro/tablasNorma.ts src/app/lib/hydro/tablasNorma.test.ts
git commit -m "feat(calc): datos de tablas de norma (C 2.9/2.10, Cf, Tr 2.8/16) con cita exacta"
```

---

### Task 3: Componente `TablaNormaView`

**Files:**
- Create: `src/app/components/calculadora/TablaNormaView.tsx`

- [ ] **Step 1: Crear el componente**

`src/app/components/calculadora/TablaNormaView.tsx`:

```tsx
import type { TablaNorma } from '../../lib/hydro/tablasNorma';
import { CitaFuente } from './CitaFuente';

/** Renderiza una tabla de norma con su cita exacta al pie. Scroll horizontal
 * propio para no romper el layout en móvil. */
export function TablaNormaView({ tabla }: { tabla: TablaNorma }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-semibold text-card-foreground">{tabla.titulo}</figcaption>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {tabla.columnas.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, i) => (
              <tr key={i} className="border-t border-border/60">
                {fila.map((celda, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-card-foreground' : 'text-right font-mono text-muted-foreground'}`}>
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tabla.nota && <p className="text-[11px] leading-snug text-muted-foreground">{tabla.nota}</p>}
      <CitaFuente fuente={tabla.fuente} />
    </figure>
  );
}
```

- [ ] **Step 2: Verificar tipos y commit**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add src/app/components/calculadora/TablaNormaView.tsx
git commit -m "feat(calc): componente TablaNormaView (tabla de norma + cita al pie)"
```

---

### Task 4: Mostrar las tablas de C, Cf y Tr en la calculadora

**Files:**
- Modify: `src/app/components/calculadora/SeccionCoefC.tsx`
- Modify: `src/app/components/CalculadoraCaudal.tsx` (sección 1, tablas de Tr)

- [ ] **Step 1: En `SeccionCoefC.tsx`, añadir las tablas de C y de Cf**

Añadir imports al inicio:

```tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TablaNormaView } from './TablaNormaView';
import { TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF } from '../../lib/hydro/tablasNorma';
```

Y antes del `<p>` final (el de "C de diseño = mín(1; C base · Cf)…"), insertar un desplegable con las tablas:

```tsx
      <DetalleTablas />
```

Y al final del archivo (fuera de `SeccionCoefC`, junto a `Celda`), añadir:

```tsx
function DetalleTablas() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-card-foreground"
        aria-expanded={abierto}
      >
        Ver las tablas de la norma (coeficiente C y factor Cf)
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="space-y-4 border-t border-border px-3 py-3">
          <TablaNormaView tabla={TABLA_C_URBANA} />
          <TablaNormaView tabla={TABLA_C_RURAL} />
          <TablaNormaView tabla={TABLA_CF} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: En `SeccionCoefC.tsx`, citar la fuente de C en el texto al pie**

Reemplazar el `<p>` final por (añade la cita a INVÍAS para el valor de C base y a Chow para Cf):

```tsx
      <p className="text-xs text-muted-foreground">
        C de diseño = mín(1; C base · Cf). El C base sale de la tabla de coeficiente de escorrentía del Manual de
        Drenaje INVÍAS (2009), Tablas 2.9 (urbano) y 2.10 (rural). El factor de frecuencia Cf eleva C para Tr altos
        (Chow, Maidment &amp; Mays, 1988). Ajusta C base dentro de su rango según la pendiente (a mayor pendiente, más alto).
      </p>
```

- [ ] **Step 3: En `CalculadoraCaudal.tsx`, mostrar las tablas de Tr en la sección 1**

Añadir import:

```tsx
import { TablaNormaView } from './calculadora/TablaNormaView';
import { TABLA_TR_VIAL, TABLA_TR_URBANO } from '../lib/hydro/tablasNorma';
```

Dentro de la `SeccionColapsable` titulo="1 · Parámetros de cuenca", después del bloque `{obraIdx >= 0 && (…)}`, añadir un desplegable con las dos tablas de Tr. Usa un `<details>` nativo para no añadir estado:

```tsx
          <details className="mt-3 rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-card-foreground">
              Ver las tablas de período de retorno de la norma
            </summary>
            <div className="space-y-4 border-t border-border px-3 py-3">
              <TablaNormaView tabla={TABLA_TR_VIAL} />
              <TablaNormaView tabla={TABLA_TR_URBANO} />
            </div>
          </details>
```

- [ ] **Step 4: Verificar tipos y commit**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add src/app/components/calculadora/SeccionCoefC.tsx src/app/components/CalculadoraCaudal.tsx
git commit -m "feat(calc): mostrar tablas de norma (C 2.9/2.10, Cf, Tr 2.8/16) en la calculadora"
```

---

### Task 5: Bloque "Cálculo paso a paso" (sustitución con valores reales)

**Files:**
- Create: `src/app/components/calculadora/CalculoPasoAPaso.tsx`
- Modify: `src/app/components/CalculadoraCaudal.tsx` (nueva sección + pasar props)

- [ ] **Step 1: Crear el componente que sustituye los números reales**

`src/app/components/calculadora/CalculoPasoAPaso.tsx`:

```tsx
import { Formula, Frac, Sub, Sup, V } from '../Formula';
import { fmt } from '../../lib/format';
import type { TiemposTc, MetodoTc } from '../../lib/hydro/tc';

/** Muestra la aritmética sustituida paso a paso con los valores actuales del
 * usuario, cada paso con su referencia. No recalcula nada: recibe lo ya
 * computado por la calculadora. */
export function CalculoPasoAPaso({
  L, S, A, tcs, tcUsado, tcMetodo, cBase, cf, cAjust, tr, equation, intensidad, q,
}: {
  L: number; S: number; A: number;
  tcs: TiemposTc; tcUsado: number; tcMetodo: MetodoTc | 'recomendado';
  cBase: number; cf: number; cAjust: number; tr: number;
  equation: { K: number; m: number; n: number }; intensidad: number; q: number;
}) {
  const Skm = S / 100; // pendiente en m/m (la UI la captura en %)
  return (
    <ol className="space-y-3 text-xs text-muted-foreground">
      <Paso n={1} titulo="Tiempo de concentración (Tc)" fuente="Kirpich (1940); Témez (1978); Giandotti (1934). El Manual INVÍAS (2009, pág. 2-8) recomienda Kirpich y un mínimo de 15 min; el RAS 0330 (Art. 135, num. 4) admite mínimos de 3 a 10 min.">
        <Linea>
          <Formula className="text-card-foreground">
            <V>T</V><Sub>c</Sub> (Kirpich) = 0,0195 · {fmt(L, 0)}<Sup>0,77</Sup> · {fmt(Skm, 4)}<Sup>−0,385</Sup> = {fmt(tcs.kirpich, 1)} min
          </Formula>
        </Linea>
        <Linea>Témez = {fmt(tcs.temez, 1)} min · Giandotti = {fmt(tcs.giandotti, 1)} min · <strong className="text-card-foreground">Tc usado = {fmt(tcUsado, 1)} min</strong> ({tcMetodo === 'recomendado' ? 'mediana' : tcMetodo}{tcs.pisoAplicado ? ', piso de 10 min' : ''})</Linea>
      </Paso>

      <Paso n={2} titulo="Coeficiente de escorrentía C ajustado" fuente="C base: INVÍAS (2009), Tablas 2.9/2.10. Factor Cf: Chow, Maidment & Mays (1988).">
        <Linea>
          <Formula className="text-card-foreground">
            <V>C</V> = mín(1; {fmt(cBase, 2)} · {fmt(cf, 2)}) = {fmt(cAjust, 2)}
          </Formula>
          <span className="ml-1">(Cf para Tr {tr} años)</span>
        </Linea>
      </Paso>

      <Paso n={3} titulo="Intensidad de la IDF en D = Tc" fuente="Curva IDF ajustada de la estación (RAS 0330, Art. 135, num. 2).">
        <Linea>
          <Formula className="text-card-foreground">
            <V>I</V> = <Frac num={<>{fmt(equation.K, 2)} · {fmt(tr, 0)}<Sup>{fmt(equation.m, 3)}</Sup></>} den={<>{fmt(tcUsado, 1)}<Sup>{fmt(equation.n, 3)}</Sup></>} /> = {fmt(intensidad, 1)} mm/h
          </Formula>
        </Linea>
      </Paso>

      <Paso n={4} titulo="Caudal de diseño (método racional)" fuente="Método racional: RAS 0330 (Art. 135) e INVÍAS (2009), §2.5.5.2. Q en m³/s, C adimensional, I en mm/h, A en hectáreas.">
        <Linea>
          <Formula className="text-base text-accent">
            <V>Q</V> = <Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} /> = <Frac num={<>{fmt(cAjust, 2)} · {fmt(intensidad, 1)} · {fmt(A, 1)}</>} den={<>360</>} /> = {fmt(q, 3)} m³/s
          </Formula>
        </Linea>
      </Paso>
    </ol>
  );
}

function Paso({ n, titulo, fuente, children }: { n: number; titulo: string; fuente: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <p className="mb-1 text-xs font-semibold text-card-foreground">{n}. {titulo}</p>
      <div className="space-y-1">{children}</div>
      <p className="mt-2 border-t border-border/60 pt-1.5 text-[11px] leading-snug text-muted-foreground">Fuente: {fuente}</p>
    </li>
  );
}

function Linea({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-1">{children}</div>;
}
```

- [ ] **Step 2: Insertar la sección en `CalculadoraCaudal.tsx`**

Añadir import:

```tsx
import { CalculoPasoAPaso } from './calculadora/CalculoPasoAPaso';
```

Inmediatamente DESPUÉS de la `SeccionColapsable` titulo="4 · Caudal de diseño Q" (y antes de la 5 · Verificación hidráulica), añadir:

```tsx
        {/* 4b · Cálculo paso a paso */}
        <SeccionColapsable titulo="Cálculo paso a paso" descripcion="La aritmética con tus valores, con su referencia" inicialAbierta={false}>
          {result && tcUsado != null ? (
            <CalculoPasoAPaso
              L={L}
              S={S}
              A={A}
              tcs={tcs}
              tcUsado={tcUsado}
              tcMetodo={tcMetodo}
              cBase={parseFloat(cBase)}
              cf={factorFrecuencia(tr)}
              cAjust={cAjust}
              tr={tr}
              equation={equation}
              intensidad={result.intensidad}
              q={result.q}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Completa los parámetros para ver el desarrollo.</p>
          )}
        </SeccionColapsable>
```

Asegurarse de que `factorFrecuencia` esté importado de `../lib/hydro/runoff` (hoy `CalculadoraCaudal.tsx` importa `cAjustado, qRacional, OBRAS_TR, ...` de ahí; añadir `factorFrecuencia` a ese import).

- [ ] **Step 3: Verificar tipos y commit**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add src/app/components/calculadora/CalculoPasoAPaso.tsx src/app/components/CalculadoraCaudal.tsx
git commit -m "feat(calc): bloque 'cálculo paso a paso' con sustitución de valores reales y su referencia"
```

---

### Task 6: Verificación final

- [ ] **Step 1: Suite + tipos + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: todo verde, build OK.

- [ ] **Step 2: Revisión a ojo (descripción de lo esperado)**

Con una estación seleccionada en Hidrología, en la calculadora:
- Sección 1: aparece "Ver las tablas de período de retorno de la norma" → muestra Tabla 2.8 y Tabla 16 con su cita.
- Sección 3 (Coef. C): "Ver las tablas de la norma (coeficiente C y factor Cf)" → Tablas 2.9, 2.10 y Cf, esta última con "(localizador por confirmar)".
- Nueva sección "Cálculo paso a paso": muestra Tc/Cf/I/Q con los números sustituidos y la fuente de cada paso.

- [ ] **Step 3: Commit final si quedó algo suelto (si no, omitir)**

---

## Notas de alcance
- No se transcribe la Tabla 4.7 de n de Manning del INVÍAS; los valores de `MATERIALES` siguen como referencia editable. (Se puede añadir en un plan posterior si se desea.)
- La página `/metodologia` y el botón (i) por gráfica son el Plan 3.
