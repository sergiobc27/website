# "La historia del dato" (Scrollytelling IDF) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vista narrativa `/historia` con gráfica sticky que se transforma en 8 escenas contando cómo la lluvia de 10 min se vuelve curvas IDF, con datos reales embebidos de una estación 🟢.

**Architecture:** Script generador (una corrida, con red) produce `src/app/data/historiaIdf.ts` commiteado; la vista lazy `HistoriaIdf.tsx` usa IntersectionObserver para activar escenas y `GraficaViva.tsx` (un Recharts que muta por escena). Cero llamadas a la API en runtime.

**Tech Stack:** React 18, Recharts (ya instalado), IntersectionObserver nativo, vitest, Formula.tsx, fmt() es-CO.

**Spec:** `docs/superpowers/specs/2026-06-11-scrollytelling-idf-design.md`

**Convenciones:** colores de gráfica `#C9A227` (ajuste/oro), `#A3161A` (observado/rojo), `#2563eb` (azul lluvia), `var(--accent)`, ejes `stroke="currentColor"` + `className="text-muted-foreground"`, `animationDuration={550}`, tooltips con `backgroundColor: 'var(--background)'`. Números SIEMPRE con `fmt()` de `lib/format`. Commits sin firmas. Deploy por push a main.

---

### Task 1: Script generador + dataset embebido

**Files:**
- Create: `scripts/generar-historia-idf.mjs`
- Create (generado): `src/app/data/historiaIdf.ts`

- [ ] **Step 1: Script** (Node 18+, fetch nativo; corre contra producción — rutas públicas del proxy):

```js
// scripts/generar-historia-idf.mjs
// Genera src/app/data/historiaIdf.ts con los datos REALES de la estación demo
// del scrollytelling. Correr manualmente (necesita red): node scripts/generar-historia-idf.mjs
const BASE = process.env.IDEAM_BASE_URL || "https://ideam.sergiobc.com";
const PRECIP = "s54a-sgyg";

async function getJson(path, body) {
  const r = await fetch(`${BASE}${path}`, body ? {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}
const porEstacion = (codigo) => ({ datasetId: PRECIP, departments: [], catalogFilters: { stations: [codigo] } });

// 1) Estación demo: fiabilidad verde con más años válidos (desempate estable por código).
const cat = await getJson("/api/analytics/idf-stations");
const verdes = (cat.stations || []).filter((s) => s.fiabilidad === "verde");
if (!verdes.length) throw new Error("No hay estaciones 🟢 en el catálogo IDF.");
const est = verdes.sort((a, b) => (b.aniosValidos - a.aniosValidos) || a.codigo.localeCompare(b.codigo))[0];
console.log("Estación demo:", est.codigo, est.nombre, `(${est.municipio}, ${est.departamento})`, est.aniosValidos, "años");

// 2) Análisis de frecuencia + curvas.
const rp = await getJson("/api/analytics/return-periods", porEstacion(est.codigo));
const idf = await getJson("/api/analytics/idf", porEstacion(est.codigo));
if (!idf.available || !idf.curves?.length) throw new Error("La estación no tiene curvas IDF disponibles.");
if (!rp.stationYears?.length) throw new Error("return-periods sin stationYears.");

// 3) Día de la tormenta: el día de mayor lámina del año con el máximo más alto.
const peorAnio = [...rp.stationYears].sort((a, b) => b.maximum - a.maximum)[0];
const serieDiaria = await getJson("/api/analytics/timeseries", {
  ...porEstacion(est.codigo), interval: "day", metric: "sum",
  startDate: `${peorAnio.year}-01-01`, endDate: `${peorAnio.year}-12-31`,
});
const dias = (serieDiaria.points || []).filter((p) => p.value !== null);
if (!dias.length) throw new Error(`Sin serie diaria para ${peorAnio.year}.`);
const diaTormenta = [...dias].sort((a, b) => b.value - a.value)[0];
const fecha = String(diaTormenta.bucket).slice(0, 10);
console.log("Tormenta:", fecha, `${diaTormenta.value} mm en el día`);

// 4) Pulsos de 10 minutos de ese día (preview devuelve filas crudas, ≤200).
const prev = await getJson("/api/preview", { ...porEstacion(est.codigo), startDate: fecha, endDate: fecha });
const filas = (prev.rows || [])
  .map((r) => ({ t: String(r.fechaobservacion ?? r.fechaObservacion ?? ""), mm: Number(r.valorobservado ?? r.valorObservado) }))
  .filter((r) => r.t && Number.isFinite(r.mm))
  .sort((a, b) => a.t.localeCompare(b.t));
if (filas.length < 6) throw new Error(`Preview devolvió ${filas.length} filas para ${fecha}: no alcanza para un hietograma. NO degradar: revisar.`);
const puntos = filas.map((r) => ({ hora: r.t.slice(11, 16), mm: Math.round(r.mm * 100) / 100 }));
const totalMm = Math.round(puntos.reduce((s, p) => s + p.mm, 0) * 10) / 10;
const maxPulso = Math.max(...puntos.map((p) => p.mm));

// 5) Armar y validar el dataset.
const r1 = (x) => Math.round(x * 10) / 10;
const data = {
  generadoEl: new Date().toISOString().slice(0, 10),
  fuente: "IDEAM via espejo de datos ideam.sergiobc.com (precipitación 10 min, dataset s54a-sgyg)",
  estacion: { codigo: est.codigo, nombre: est.nombre, municipio: est.municipio, departamento: est.departamento, aniosValidos: est.aniosValidos, fiabilidad: est.fiabilidad },
  tormenta: { fecha, puntos, totalMm, maxIntensidadMmH: r1(maxPulso * 6) },
  maximosAnuales: rp.stationYears.map((y) => ({ anio: y.year, mm: r1(y.maximum) })),
  gumbel: rp.gumbel || null,
  empiricos: (rp.empirical || []).map((q) => ({ tr: q.returnPeriod, mm: r1(q.value) })),
  cuantiles: (rp.quantiles || []).map((q) => ({ tr: q.returnPeriod, mm: r1(q.value), lower: q.lower !== undefined ? r1(q.lower) : undefined, upper: q.upper !== undefined ? r1(q.upper) : undefined })),
  curvas: idf.curves.map((c) => ({ tr: c.returnPeriod, puntos: c.points.map((p) => ({ durMin: p.durMin, mmH: r1(p.intensityMmH), lowerMmH: p.lowerMmH !== undefined ? r1(p.lowerMmH) : undefined, upperMmH: p.upperMmH !== undefined ? r1(p.upperMmH) : undefined })) })),
  ecuacion: idf.equation || null,
  nAnios: idf.nYears || rp.n,
};
for (const k of ["estacion", "tormenta", "maximosAnuales", "cuantiles", "curvas"]) {
  if (!data[k] || (Array.isArray(data[k]) && !data[k].length)) throw new Error(`Dataset inválido: falta ${k}`);
}

// 6) Escribir el módulo TS.
import { writeFileSync } from "node:fs";
const ts = `// GENERADO por scripts/generar-historia-idf.mjs el ${data.generadoEl} — NO editar a mano.
// Datos reales de la estación ${data.estacion.codigo} (${data.estacion.nombre}). Regenerar con: node scripts/generar-historia-idf.mjs
import type { HistoriaIdfData } from '../lib/historia';

export const HISTORIA_IDF: HistoriaIdfData = ${JSON.stringify(data, null, 2)};
`;
writeFileSync(new URL("../src/app/data/historiaIdf.ts", import.meta.url), ts);
console.log("OK -> src/app/data/historiaIdf.ts");
```

- [ ] **Step 2:** `node scripts/generar-historia-idf.mjs` → imprime estación elegida, tormenta y `OK`. Inspeccionar el archivo (tamaño razonable <100 KB, puntos de tormenta plausibles).
- [ ] **Step 3:** Commit: `git add scripts/generar-historia-idf.mjs src/app/data/historiaIdf.ts && git commit -m "feat(historia): dataset embebido real de la estacion demo + script generador"`

(Nota: el import de `HistoriaIdfData` desde `../lib/historia` exige que Task 2 se haga ANTES de typecheckear; en ejecución inline se hacen seguidas.)

### Task 2: `lib/historia.ts` — tipos, validación y lógica pura (TDD)

**Files:**
- Create: `src/app/lib/historia.ts`
- Test: `src/app/lib/historia.test.ts`

- [ ] **Step 1: Tests que fallan**

```ts
import { describe, expect, it } from 'vitest';
import { escenaMasVisible, validarHistoria, intensidadDeCurva, TOTAL_ESCENAS } from './historia';
import { HISTORIA_IDF } from '../data/historiaIdf';

describe('escenaMasVisible', () => {
  it('elige la sección con mayor ratio de intersección', () => {
    expect(escenaMasVisible([0, 0.2, 0.8, 0.1, 0, 0, 0, 0])).toBe(3); // 1-indexada
  });
  it('con todo en cero conserva la escena actual', () => {
    expect(escenaMasVisible([0, 0, 0, 0, 0, 0, 0, 0], 5)).toBe(5);
  });
});

describe('validarHistoria', () => {
  it('acepta el dataset embebido real', () => {
    expect(validarHistoria(HISTORIA_IDF)).toEqual([]);
  });
  it('reporta lo que falte', () => {
    const errores = validarHistoria({ ...HISTORIA_IDF, curvas: [] } as never);
    expect(errores.some((e) => e.includes('curvas'))).toBe(true);
  });
});

describe('intensidadDeCurva', () => {
  it('devuelve la intensidad de la duración pedida en la curva del Tr más cercano', () => {
    const r = intensidadDeCurva(HISTORIA_IDF.curvas, 25, 15);
    expect(r).not.toBeNull();
    expect(r!.mmH).toBeGreaterThan(0);
    expect(r!.durMin).toBe(15);
  });
});

it('TOTAL_ESCENAS es 8', () => expect(TOTAL_ESCENAS).toBe(8));
```

- [ ] **Step 2:** `npm run test:unit` → FAIL (módulo no existe).
- [ ] **Step 3: Implementación**

```ts
// src/app/lib/historia.ts — lógica pura del scrollytelling (testeable sin DOM).

export interface HistoriaIdfData {
  generadoEl: string;
  fuente: string;
  estacion: { codigo: string; nombre: string; municipio: string; departamento: string; aniosValidos: number; fiabilidad: string };
  tormenta: { fecha: string; puntos: Array<{ hora: string; mm: number }>; totalMm: number; maxIntensidadMmH: number };
  maximosAnuales: Array<{ anio: number; mm: number }>;
  gumbel: { mu: number; beta: number } | null;
  empiricos: Array<{ tr: number; mm: number }>;
  cuantiles: Array<{ tr: number; mm: number; lower?: number; upper?: number }>;
  curvas: Array<{ tr: number; puntos: Array<{ durMin: number; mmH: number; lowerMmH?: number; upperMmH?: number }> }>;
  ecuacion: { K: number; m: number; n: number; r2: number; r2Space?: string } | null;
  nAnios: number;
}

export const TOTAL_ESCENAS = 8;

/** Escena activa (1-indexada) = sección con mayor ratio visible; sin señal, conserva la actual. */
export function escenaMasVisible(ratios: number[], actual = 1): number {
  let mejor = -1;
  let idx = -1;
  ratios.forEach((r, i) => {
    if (r > mejor) { mejor = r; idx = i; }
  });
  return mejor > 0 ? idx + 1 : actual;
}

/** Chequeo de shape del dataset embebido (lo usan el test y quien regenere). */
export function validarHistoria(d: HistoriaIdfData): string[] {
  const errores: string[] = [];
  if (!d.estacion?.codigo) errores.push('estacion.codigo vacío');
  if (!d.tormenta?.puntos?.length) errores.push('tormenta.puntos vacío');
  if (!d.maximosAnuales?.length) errores.push('maximosAnuales vacío');
  if (!d.cuantiles?.length) errores.push('cuantiles vacío');
  if (!d.curvas?.length || d.curvas.some((c) => !c.puntos.length)) errores.push('curvas vacías');
  if (!d.nAnios || d.nAnios < 5) errores.push('nAnios < 5');
  return errores;
}

/** Intensidad (mm/h) para un Tr y duración: curva del Tr más cercano, punto exacto de la duración. */
export function intensidadDeCurva(
  curvas: HistoriaIdfData['curvas'], tr: number, durMin: number,
): { tr: number; durMin: number; mmH: number } | null {
  if (!curvas.length) return null;
  const curva = curvas.reduce((m, c) => (Math.abs(c.tr - tr) < Math.abs(m.tr - tr) ? c : m));
  const punto = curva.puntos.find((p) => p.durMin === durMin) || curva.puntos[0];
  return punto ? { tr: curva.tr, durMin: punto.durMin, mmH: punto.mmH } : null;
}
```

- [ ] **Step 4:** `npm run test:unit` → PASS. **Step 5:** Commit `feat(historia): logica pura del scrollytelling (escena activa, validacion, intensidad)`

### Task 3: `GraficaViva.tsx` — la visualización que muta (8 variantes)

**Files:**
- Create: `src/app/components/historia/GraficaViva.tsx`

Sin test unitario de UI (convención del repo para charts); la verificación es typecheck + build + screenshots. Estructura (completa en ejecución; aquí el contrato y las variantes):

```tsx
// Props: { escena: number; data: HistoriaIdfData }
// Un solo <div> contenedor h-full con un switch por escena. Cada variante usa
// ResponsiveContainer y las convenciones de color/animación del repo.
// 1: tarjeta portada — nombre/municipio/🟢/años (sin chart; tipografía grande).
// 2: <BarChart> tormenta.puntos (XAxis hora, YAxis mm, Bar fill #2563eb).
// 3: dos paneles apilados: arriba la misma BarChart en miniatura; abajo UNA
//    barra ancha con tormenta.totalMm (fill var(--accent)) etiquetada "1 dato diario".
// 4: <ScatterChart> maximosAnuales (XAxis anio, YAxis mm, Scatter fill #A3161A);
//    ReferenceDot en el año de la tormenta (stroke #C9A227).
// 5: <ComposedChart> con XAxis tr (scale log, domain [1.01, 'auto'], ticks [2,5,10,25,50,100]):
//    Scatter empiricos (#A3161A) + Line cuantiles.mm (#C9A227, strokeWidth 2) +
//    Area banda lower/upper (fill #C9A227 fillOpacity 0.15) si existen.
// 6: <ComposedChart> XAxis durMin (scale log, ticks de idf) YAxis mm/h:
//    una <Line> por curva (colores IDF del repo: ['#C9A227','#A3161A','#2563eb','#0f766e','#7c3aed','#b45309']),
//    banda IC de la curva Tr=25 si hay lowerMmH/upperMmH.
// 7: sin chart — <Formula> grande: I = K·T^m / D^n con los valores de data.ecuacion
//    (fmt con 2-3 decimales) y R² destacado.
// 8: tarjeta "del dato al diseño": Q = C·I·A con I = intensidadDeCurva(curvas, 25, 15),
//    C=0,80 (zona urbana densa), A=1 ha → Q en L/s (Q = C·I·A/360 m³/s ×1000);
//    nota normativa (RAS 0330 orientativo) + los 2 CTA (los botones viven en la vista, no aquí).
// Transición: key={escena} en el contenedor interno + clase de fade (animationDuration 550
// de Recharts hace el resto). aria-hidden="true" en todo el bloque gráfico.
```

- [ ] Implementar + `npm run typecheck` → 0 errores. Commit `feat(historia): GraficaViva con las 8 variantes de escena`.

### Task 4: `HistoriaIdf.tsx` — vista, observer, progreso y CTA

**Files:**
- Create: `src/app/components/HistoriaIdf.tsx`

```tsx
// Estructura:
// - const [escena, setEscena] = useState(1); refs a las 8 <section>.
// - useEffect: IntersectionObserver (threshold [0, .25, .5, .75, 1]) sobre las
//   secciones; en cada callback arma ratios[8] y setEscena(escenaMasVisible(ratios, escena)).
// - Layout desktop: grid md:grid-cols-[1fr,1.1fr]; columna izquierda = secciones de
//   texto (cada una min-h-[80vh] flex items-center); derecha = <div className="sticky
//   top-20 h-[70vh]"> con <GraficaViva escena={escena} data={HISTORIA_IDF} />.
//   Móvil: la gráfica va sticky arriba (top-16, h-[38vh]) y el texto debajo.
// - Barra de progreso: fixed top bajo la navbar, width = (escena/8)*100% con transición.
// - Los textos de las 8 escenas: constantes en el mismo archivo (ESCENAS: Array<{titulo, parrafos[]}>)
//   con el copy de la spec (tabla de escenas), en español es-CO, números con fmt().
// - Escena 8: dos botones CTA — "Explora tu propia estación" → navegación a hydro
//   (prop onNavigate inyectada desde App, igual que DocumentationView usa onOpenExtractor)
//   y "Pregúntale al asistente" → window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT)).
// - Pie: "Datos reales de la estación {nombre} ({codigo}), {municipio} — generados el
//   {generadoEl}. {fuente}. Plataforma orientativa: no sustituye el diseño normado."
```

- [ ] Implementar + typecheck. Commit `feat(historia): vista La historia del dato (scrollytelling sticky de 8 escenas)`.

### Task 5: Wiring — navegación, sidebar, asistente

**Files:**
- Modify: `src/app/lib/navigation.ts` — añadir `'historia'` a VIEWS (tras `'hydro'`).
- Modify: `src/app/App.tsx` — lazy `HistoriaIdf`, `case 'historia': return <HistoriaIdf onNavigate={navigate} />;`, breadcrumb `historia: ['Inicio', 'La historia del dato']`.
- Modify: `src/app/components/Sidebar.tsx` — en grupo Explorar tras Hidrología: `{ id: 'historia', icon: BookOpenText, label: 'La historia del dato' }` (import `BookOpenText` de lucide).
- Modify: `src/worker/chatData.js` — `VISTA_LABELS.historia = "La historia del dato"` (el asistente sabe qué mira el usuario).
- Test: `tests/chat-data.test.mjs` — un assert: `VISTA_LABELS.historia` definido.

- [ ] Implementar, correr `npm test` + `node --test tests/chat-data.test.mjs` + `npm run test:unit` + typecheck. Commit `feat(historia): ruta /historia, sidebar y contexto del asistente`.

### Task 6: Verificación, deploy y evidencia

- [ ] Suite completa: `npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build` → todo verde.
- [ ] `git push origin main` → CI despliega; `gh run watch` → success.
- [ ] Smoke: `https://ideam.sergiobc.com/historia` → 200 y contenido.
- [ ] Playwright (script temporal no commiteado): screenshots de escenas 1, 2-3 (scroll), 6 y 8, desktop 1440×900 y móvil 390×844 → enviar a Sergio.
- [ ] Actualizar memoria del proyecto.

## Riesgos

- **Preview sin filas de 10 min para el día elegido** → el script FALLA con mensaje (decisión de spec); probar otro año del top de máximos manualmente si pasa.
- **Curvas con muchos puntos** → ya vienen acotadas por la API (~7 duraciones × ~6 Tr).
- **El asistente flotante tapa el CTA** en móvil → padding-bottom extra en la escena 8.
