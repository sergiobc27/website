# Rediseño UX del Extractor de Datos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Rediseñar la experiencia del Extractor (`DataExtractor.tsx`) con "menos es más", progreso honesto y datos curiosos durante la espera, sin tocar backend ni romper jobs/polling/deep-links.

**Architecture:** Frontend puro. Se extrae toda la lógica nueva *testeable* a módulos puros (`lib/precipitacion.ts`, `lib/curiosidades.ts`) con TDD (vitest); el componente consume esos módulos y se reorganiza en 3 capas de visibilidad. El progreso se deriva de campos que el backend ya emite.

**Tech Stack:** React + TypeScript + Vite, vitest 3.2.6 (`npm run test:unit`), Tailwind, tokens en `src/styles/theme.css`. Repo `sergiobc27/website` (main exige PR). Sin firmas de Claude.

**Comandos:** typecheck `npm run typecheck` · build `npm run build` · unit `npm run test:unit` · un test puntual `npx vitest run src/app/lib/<f>.test.ts`.

**Restricciones (NO romper):** `ACTIVE_JOB_KEY`/`CONFIG_KEY` (persistencia), polling/backoff/reconexión, parser de deep-links (multi-depto), validación inline. Reusar tokens/keyframes y componentes existentes (`MetricCard`, `ProgressRing`, `PhaseStepper`, `Tooltip`, `SkeletonLoader`, `lib/downloadHistory.ts`). Verificar en Chrome (no Opera).

---

## Fase C-core — Módulos puros (TDD primero, no tocan UI)

### Task 1: Util de equivalencias de precipitación

**Files:**
- Create: `src/app/lib/precipitacion.ts`
- Test: `src/app/lib/precipitacion.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { mmAreaLitros, mmPorM2, clasificarIntensidad } from './precipitacion';

describe('precipitacion', () => {
  it('1 mm sobre 1 m2 = 1 litro', () => {
    expect(mmPorM2(1)).toBe(1);
  });
  it('1 mm sobre una cancha (7140 m2) > 7000 litros', () => {
    expect(mmAreaLitros(1, 7140)).toBe(7140);
  });
  it('redondea y nunca da negativos', () => {
    expect(mmAreaLitros(-5, 100)).toBe(0);
    expect(mmAreaLitros(2.4, 100)).toBe(240);
  });
  it('clasifica intensidad segun umbrales OMM (mm/h)', () => {
    expect(clasificarIntensidad(0)).toBe('sin_lluvia');
    expect(clasificarIntensidad(1)).toBe('debil');
    expect(clasificarIntensidad(5)).toBe('moderada');
    expect(clasificarIntensidad(10)).toBe('fuerte');
    expect(clasificarIntensidad(80)).toBe('muy_fuerte');
  });
});
```

- [ ] **Step 2: Correr y ver que falla** — `npx vitest run src/app/lib/precipitacion.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementación mínima**

```ts
// src/app/lib/precipitacion.ts
// 1 mm de lluvia = 1 litro por metro cuadrado (verificado: NASA S'COOL / FAO).
export type IntensidadLluvia = 'sin_lluvia' | 'debil' | 'moderada' | 'fuerte' | 'muy_fuerte';

const noNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Litros sobre 1 m² para `mm` de lluvia (== mm). */
export function mmPorM2(mm: number): number {
  return Math.round(noNeg(mm));
}

/** Litros totales de `mm` de lluvia sobre `areaM2` metros cuadrados. */
export function mmAreaLitros(mm: number, areaM2: number): number {
  return Math.round(noNeg(mm) * noNeg(areaM2));
}

/** Clasifica intensidad por umbrales OMM/WMO (mm por hora). */
export function clasificarIntensidad(mmPorHora: number): IntensidadLluvia {
  const v = noNeg(mmPorHora);
  if (v === 0) return 'sin_lluvia';
  if (v < 2.5) return 'debil';
  if (v < 7.6) return 'moderada';
  if (v < 50) return 'fuerte';
  return 'muy_fuerte';
}
```

- [ ] **Step 4: Correr y ver que pasa** — `npx vitest run src/app/lib/precipitacion.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/app/lib/precipitacion.ts src/app/lib/precipitacion.test.ts && git commit -m "feat(extractor): util pura de equivalencias de precipitacion (mm->litros, intensidad OMM)"`

---

### Task 2: Datos curiosos + selección contextual

**Files:**
- Create: `src/app/lib/curiosidades.ts`
- Test: `src/app/lib/curiosidades.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { seleccionarCuriosidades, siguienteIndice, ANALOGIAS_PRECIPITACION, CURIOSIDADES_POR_DEPARTAMENTO } from './curiosidades';

describe('curiosidades', () => {
  it('incluye analogias de precipitacion cuando la variable es precip', () => {
    const r = seleccionarCuriosidades({ esPrecipitacion: true, departamentos: [] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.some(c => ANALOGIAS_PRECIPITACION.includes(c))).toBe(true);
  });
  it('prioriza datos del departamento elegido si existen', () => {
    const r = seleccionarCuriosidades({ esPrecipitacion: true, departamentos: ['CHOCO'] });
    expect(r.some(c => CURIOSIDADES_POR_DEPARTAMENTO['CHOCO'].includes(c))).toBe(true);
  });
  it('siempre devuelve algo (fallback generico) aunque no sea precip y sin depto', () => {
    expect(seleccionarCuriosidades({ esPrecipitacion: false, departamentos: [] }).length).toBeGreaterThan(0);
  });
  it('no repite indice consecutivo', () => {
    const rng = () => 0; // forzaria el mismo indice
    expect(siguienteIndice(0, 3, rng)).not.toBe(0);
    expect(siguienteIndice(2, 3, () => 0.99)).not.toBe(2);
  });
  it('con un solo elemento siguienteIndice devuelve 0', () => {
    expect(siguienteIndice(0, 1, () => 0.5)).toBe(0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla** — `npx vitest run src/app/lib/curiosidades.test.ts` → FAIL.

- [ ] **Step 3: Implementación**

```ts
// src/app/lib/curiosidades.ts
export interface Curiosidad { texto: string; fuente?: string }

// Analogías universales de precipitación (verificadas). Tono divulgativo con chispa.
export const ANALOGIAS_PRECIPITACION: Curiosidad[] = [
  { texto: '1 mm de lluvia equivale a 1 litro de agua sobre cada metro cuadrado de suelo.', fuente: 'FAO / NASA' },
  { texto: 'Con 1 mm de lluvia, una cancha de fútbol recoge más de 7.000 litros de agua.' },
  { texto: 'Las estaciones del IDEAM miden la lluvia cada 10 minutos — por eso se pueden construir curvas IDF reales.', fuente: 'IDEAM' },
  { texto: 'Un aguacero fuerte (más de 7,5 mm/h, según la OMM) deja sobre cada m² un vaso de agua cada dos minutos.', fuente: 'OMM' },
];

// Hechos genéricos de plataforma (fallback). Cifras estables/redondeadas.
export const CURIOSIDADES_GENERICAS: Curiosidad[] = [
  { texto: 'El espejo de datos guarda más de 760 millones de observaciones del IDEAM.', fuente: 'IDEAM' },
  { texto: 'Esta herramienta cubre los 32 departamentos de Colombia.', fuente: 'IDEAM' },
  { texto: 'Los registros llegan en intervalos de 10 minutos, no solo a diario.' },
];

// Datos por departamento (clave = nombre en mayúsculas, igual que los chips de Territorio).
export const CURIOSIDADES_POR_DEPARTAMENTO: Record<string, Curiosidad[]> = {
  'CHOCO': [{ texto: 'En Quibdó (Chocó) caen más de 8.000 mm al año, casi 10 veces lo de Bogotá.' }],
  'LA GUAJIRA': [{ texto: 'En Uribia (La Guajira) caen apenas ~250 mm al año: el rincón más seco de Colombia.' }],
  'ATLANTICO': [{ texto: 'En Barranquilla pocos minutos de aguacero bastan para que los arroyos corran por las calles.' }],
  'BOGOTA D.C.': [{ texto: 'Bogotá tiene dos temporadas de lluvia al año (régimen bimodal): abril-mayo y octubre-noviembre.' }],
  'CUNDINAMARCA': [{ texto: 'La sabana de Cundinamarca tiene un régimen bimodal: dos picos de lluvia al año.' }],
  'AMAZONAS': [{ texto: 'El Amazonas colombiano es de los lugares más húmedos y lluviosos del país todo el año.' }],
};

/** Selección contextual: específicas del depto + analogías (si precip) + genéricas, sin duplicar. */
export function seleccionarCuriosidades(opts: { esPrecipitacion: boolean; departamentos: string[] }): Curiosidad[] {
  const out: Curiosidad[] = [];
  for (const d of opts.departamentos) {
    const arr = CURIOSIDADES_POR_DEPARTAMENTO[d?.toUpperCase?.() ?? d];
    if (arr) out.push(...arr);
  }
  if (opts.esPrecipitacion) out.push(...ANALOGIAS_PRECIPITACION);
  out.push(...CURIOSIDADES_GENERICAS);
  return Array.from(new Set(out)); // dedupe por referencia
}

/** Siguiente índice de rotación, evitando repetir el actual. `rng` inyectable para tests. */
export function siguienteIndice(actual: number, total: number, rng: () => number = Math.random): number {
  if (total <= 1) return 0;
  let i = Math.floor(rng() * total);
  if (i === actual) i = (i + 1) % total;
  return i;
}
```

- [ ] **Step 4: Correr y ver que pasa** — `npx vitest run src/app/lib/curiosidades.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/app/lib/curiosidades.ts src/app/lib/curiosidades.test.ts && git commit -m "feat(extractor): pool de datos curiosos + seleccion contextual y rotacion"`

---

### Task 3: Helper puro de progreso

**Files:**
- Create: `src/app/lib/progresoDescarga.ts`
- Test: `src/app/lib/progresoDescarga.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from 'vitest';
import { derivarProgreso, etaAmable } from './progresoDescarga';

describe('progresoDescarga', () => {
  it('fase planear cuando aun no hay total', () => {
    const r = derivarProgreso({ status: 'planning' } as any, 0);
    expect(r.fase).toBe('planear');
    expect(r.indeterminado).toBe(true);
  });
  it('fase descargar con porcentaje determinado', () => {
    const r = derivarProgreso({ status: 'processing', progressPercent: 40, currentPage: 4, totalPages: 12 } as any, 30);
    expect(r.fase).toBe('descargar');
    expect(r.percent).toBe(40);
    expect(r.indeterminado).toBe(false);
  });
  it('clamp monotono: nunca baja respecto al previo', () => {
    const r = derivarProgreso({ status: 'processing', progressPercent: 20 } as any, 55);
    expect(r.percent).toBe(55);
  });
  it('listo = 100', () => {
    expect(derivarProgreso({ status: 'completed' } as any, 90).percent).toBe(100);
  });
  it('eta amable en rango', () => {
    expect(etaAmable(8)).toMatch(/segundos/i);
    expect(etaAmable(75)).toMatch(/min/i);
    expect(etaAmable(null)).toBe('');
  });
});
```

- [ ] **Step 2: Correr y ver que falla.**

- [ ] **Step 3: Implementación**

```ts
// src/app/lib/progresoDescarga.ts
export type FaseDescarga = 'planear' | 'descargar' | 'empacar' | 'listo' | 'error';

export interface ProgresoVista {
  fase: FaseDescarga;
  percent: number;       // 0-100, monótono creciente (clamp con prevPercent)
  indeterminado: boolean; // true => spinner; false => barra determinada
}

interface JobLike {
  status?: string;
  progressPercent?: number;
  currentPage?: number; totalPages?: number;
  currentStage?: string;
}

export function derivarProgreso(job: JobLike | null | undefined, prevPercent = 0): ProgresoVista {
  const s = job?.status ?? 'queued';
  if (s === 'failed') return { fase: 'error', percent: prevPercent, indeterminado: false };
  if (s === 'completed') return { fase: 'listo', percent: 100, indeterminado: false };
  if (s === 'queued' || s === 'planning') return { fase: 'planear', percent: prevPercent, indeterminado: true };
  // processing / retrying / packing
  const pkt = /pack|empac|zip/i.test(job?.currentStage ?? '');
  const raw = typeof job?.progressPercent === 'number'
    ? job.progressPercent
    : (job?.totalPages ? ((job.currentPage ?? 0) / job.totalPages) * 100 : prevPercent);
  const percent = Math.min(100, Math.max(prevPercent, Math.round(raw))); // clamp monótono
  return { fase: pkt ? 'empacar' : 'descargar', percent, indeterminado: false };
}

/** ETA en rango amable (sesgo a sobreestimar levemente). '' si no hay dato. */
export function etaAmable(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos) || segundos <= 0) return '';
  if (segundos < 15) return 'unos segundos';
  if (segundos < 45) return 'menos de 1 minuto';
  const min = Math.ceil(segundos / 60);
  return `~${min} min`;
}
```

- [ ] **Step 4: Correr y ver que pasa.**
- [ ] **Step 5: Commit** — `git commit -am "feat(extractor): helper puro de progreso (4 fases, clamp monotono, ETA amable)"`

---

## Fase A — "Menos es más" (componente)

> Trabajo sobre `src/app/components/DataExtractor.tsx`. Anclas de línea según inventario 2026-06-18 (pueden desplazarse; localizar por contenido). Verificación de esta fase = navegador, no unit test.

### Task 4: Resumen-primero en prosa

**Files:** Create `src/app/lib/resumenDescarga.ts` + `.test.ts`; Modify `DataExtractor.tsx` (cerca de la zona de botones ~1990-2050).

- [ ] **Step 1: Test del builder (puro)**

```ts
import { describe, it, expect } from 'vitest';
import { construirResumenProsa } from './resumenDescarga';

it('arma frase natural con variable, territorio y rango', () => {
  const f = construirResumenProsa({ variable: 'Precipitación', departamentos: ['CÓRDOBA'], anioInicio: 2015, anioFin: 2024, estaciones: 12 });
  expect(f).toContain('Precipitación');
  expect(f).toContain('Córdoba'.toUpperCase());
  expect(f).toContain('2015');
  expect(f).toContain('2024');
});
it('maneja sin departamentos', () => {
  expect(construirResumenProsa({ variable: 'Nivel', departamentos: [], anioInicio: 2003, anioFin: 2026, estaciones: 0 })).toContain('Nivel');
});
```

- [ ] **Step 2/3:** Implementar `construirResumenProsa(opts)` que devuelva p.ej. `"Descargarás precipitación de Córdoba, 2015–2024 · ~12 estaciones."` (manejar 1 vs varios deptos, 0 estaciones). Correr test → PASS.
- [ ] **Step 4:** En `DataExtractor.tsx`, importar y renderizar el resumen como un `<p>` en prosa **justo antes** del bloque de botones Vista previa/Descargar (CORE). Eliminar/colapsar el "Resumen configurado" duplicado (inventario ~1449-1465).
- [ ] **Step 5:** `npm run typecheck` → OK. Commit: `feat(extractor): resumen-primero en prosa antes de descargar`.

### Task 5: Reorganizar en CORE / Opciones avanzadas / Detalle técnico

**Files:** Modify `DataExtractor.tsx`.

- [ ] **Step 1:** Crear (o reusar un acordeón existente) dos contenedores colapsables cerrados por defecto: **"Opciones avanzadas"** y **"Ver detalle técnico"**. Reusar el patrón de `Section`/AccordionItem ya presente.
- [ ] **Step 2:** Mover dentro de **"Opciones avanzadas"**: sección Filtros avanzados (~1851-1920), códigos de estación manuales, selector de formato CSV/JSON/PARQUET.
- [ ] **Step 3:** Mover dentro de **"Ver detalle técnico"**: `OperationTimeline` (~1480), los chips de **velocidad (filas/s)** y **página X/Y** del hero, **"Salida esperada"** (~1467-1477), las **8 MetricCards** de métricas finales (~1534-1560) y las **4 MetricCards** de la vista previa (~1482-1532, dejando la **tabla** en CORE).
- [ ] **Step 4:** Verificar en navegador que CORE quede limpio (variable, territorio, fechas, consentimiento, resumen, botones, anillo+ETA, tabla de vista previa) y que nada se haya roto. `npm run typecheck` + `npm run build`.
- [ ] **Step 5:** Commit: `refactor(extractor): 3 capas CORE/avanzado/detalle tecnico (menos es mas)`.

### Task 6: Smart defaults

- [ ] **Step 1:** Asegurar que el estado inicial use defaults sensatos (variable = Precipitación; temporalidad = histórico; formato = CSV) **solo si no hay deep-link ni config persistida** (`CONFIG_KEY`).
- [ ] **Step 2:** Verificar en navegador: entrar limpio → ya hay variable y temporalidad válidas; entrar por deep-link → respeta los parámetros. `npm run typecheck`.
- [ ] **Step 3:** Commit: `feat(extractor): smart defaults sin romper deep-links/persistencia`.

---

## Fase B — Progreso honesto (componente)

### Task 7: Anillo/barra determinada + 4 fases + ETA amable

**Files:** Modify `DataExtractor.tsx` (ProgressHero ~2400-2481, PhaseStepper ~2358).

- [ ] **Step 1:** Conectar `derivarProgreso(currentJob, prevPercent)` (Task 3) guardando `prevPercent` en un `useRef` para el clamp monótono. Usarlo para el % del anillo/barra y la fase activa del `PhaseStepper`.
- [ ] **Step 2:** Mostrar **spinner/indeterminado solo en fase 'planear'**; barra/anillo **determinado** en 'descargar'/'empacar'. Estado humano: "Reuniendo datos · página N de M" (de `currentPage/totalPages`); si el % se estanca, mantener el texto de página (no congelar).
- [ ] **Step 3:** Sustituir el countdown/ETA exacto por `etaAmable(currentJob.estimatedRemainingSeconds)`. El `elapsed`/tiempo exacto pasa a "detalle técnico".
- [ ] **Step 4:** Easing: la barra/anillo con transición CSS ease-out (reusar variables de `theme.css`); el valor solo sube (clamp ya lo garantiza). Verificar en navegador con una descarga real pequeña (1 estación, 1 mes).
- [ ] **Step 5:** Commit: `feat(extractor): progreso determinado por fases + ETA amable`.

### Task 8: Cierre claro + Cancelar

- [ ] **Step 1:** Estado de éxito inequívoco (reusar `ReadyDownloadPanel` ~2561 + `glow-pulse-success`) con "Listo · disponible 1 hora" y el centro de descargas persistente.
- [ ] **Step 2:** Botón **Cancelar** visible durante la espera: detiene el polling del cliente y resetea la UI a configuración (NO mata el job del servidor — documentarlo con un comentario; si más adelante hay endpoint de cancelación, se conecta). Prevenir doble-descarga con botón disabled mientras corre.
- [ ] **Step 3:** Verificar en navegador (iniciar y cancelar). `npm run typecheck`.
- [ ] **Step 4:** Commit: `feat(extractor): cierre claro + boton Cancelar (detiene espera del cliente)`.

---

## Fase C — Datos curiosos + pulido (componente)

### Task 9: Panel de datos curiosos durante la espera

**Files:** Create `src/app/components/CuriosidadEspera.tsx`; Modify `DataExtractor.tsx`.

- [ ] **Step 1:** Crear `CuriosidadEspera.tsx`: recibe `{ esPrecipitacion: boolean; departamentos: string[]; activo: boolean }`. Internamente: `useMemo(seleccionarCuriosidades, [esPrecipitacion, departamentos])`; rotación con `useEffect`+`setInterval` (6500 ms) usando `siguienteIndice` y un índice en `useState`/`useRef` (cleanup en unmount; NO reiniciar el ciclo en cada render). Estilo: cajita `bg-accent/10 border-accent/30 rounded-lg` con "💡 ¿Sabías que…?" + texto, transición `fade-in-up`/opacity.
- [ ] **Step 2 (accesibilidad):** El estado de progreso real (en ProgressHero) lleva `role="status"` `aria-live="polite"`; la cajita de curiosidades va `aria-hidden="true"` (no spamea al lector). Respetar `prefers-reduced-motion` (sin crossfade → cambio directo). **Anti-flash:** montar el panel solo si `activo` lleva >~800 ms (timeout interno) — si la descarga termina antes, no se muestra.
- [ ] **Step 3:** En `DataExtractor.tsx`, renderizar `<CuriosidadEspera>` debajo del progreso, `activo = job en planning/processing`. Derivar `esPrecipitacion` de la variable elegida y `departamentos` del estado de territorio.
- [ ] **Step 4:** Verificar en navegador (Chrome): iniciar descarga → aparece y rota; con depto Chocó/Atlántico → sale el dato regional; reduced-motion → sin animación. `npm run typecheck` + `npm run build`.
- [ ] **Step 5:** Commit: `feat(extractor): datos curiosos contextuales durante la espera`.

### Task 10: Cierre "semi-en-vivo" con equivalencia real

- [ ] **Step 1:** Si el backend devuelve un total de mm en las métricas finales, en el panel de éxito mostrar una línea: `"Tu descarga: X mm en el periodo ≈ {mmPorM2(X)} litros por m²."` usando `precipitacion.ts`. Solo si la variable es precipitación y el dato existe; si no, omitir.
- [ ] **Step 2:** Verificar en navegador. `npm run typecheck`.
- [ ] **Step 3:** Commit: `feat(extractor): linea de equivalencia real al completar (mm -> litros/m2)`.

---

## Cierre

### Task 11: Verificación integral + PR

- [ ] **Step 1:** `npm run typecheck` → 0 errores.
- [ ] **Step 2:** `npm run test:unit` → todos verdes (incluye los nuevos de precipitacion/curiosidades/progresoDescarga/resumenDescarga; no romper los 89 existentes).
- [ ] **Step 3:** `npm run build` → OK.
- [ ] **Step 4:** Verificar en vivo en Chrome (no Opera): flujo completo claro/oscuro, una descarga real pequeña (1 estación/1 mes) mostrando progreso + datos curiosos + cierre; confirmar que deep-links y persistencia (`CONFIG_KEY`) siguen intactos. Capturas.
- [ ] **Step 5:** `git push -u origin feat/rediseno-extractor-ux`; abrir PR a `sergiobc27/website` (título + cuerpo describiendo A/B/C; frontend puro). Merge → auto-deploy → verificación en producción.

## Self-review (cubierto)
- Cobertura del spec: A (Tasks 4-6), B (Tasks 7-8), C (Tasks 1-3,9,10), rigor de contenido (Task 2 datos verificados, sin piscina/Lloró), accesibilidad (Task 9 step 2), verificación (Task 11). ✔
- Sin placeholders: módulos puros con código completo; pasos de componente localizados por ancla + contenido. ✔
- Consistencia de tipos: `Curiosidad`, `seleccionarCuriosidades`, `siguienteIndice`, `derivarProgreso`, `etaAmable`, `mmPorM2`, `mmAreaLitros`, `clasificarIntensidad`, `construirResumenProsa` usados con las mismas firmas en plan y tests. ✔
