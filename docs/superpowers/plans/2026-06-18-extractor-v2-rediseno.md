# 2º Rediseño del Extractor — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarea por tarea. Pasos con checkbox (`- [ ]`).

**Goal:** Separar configuración y ejecución en un flujo de dos fases, quitar jerga de backend, y pulir progreso/preview/filtros/consentimiento del Extractor — frontend puro, en un solo PR.

**Architecture:** Lógica pura testeable (suavizado EMA del ETA) en `lib/progresoDescarga.ts`; dos componentes nuevos aislados (`SlideToAccept`, `FacetCombobox`); el resto son cambios de presentación/estado en `DataExtractor.tsx` (máquina de modos con ambos subárboles montados + visibilidad conmutada para preservar estado en React 18). No se toca ningún contrato de jobs/polling/deep-links/persistencia.

**Tech Stack:** React 18.3.1 + TS + Vite, vitest (`npm run test:unit`), Radix Popover (ya instalado), Tailwind, tokens `theme.css`. Repo `sergiobc27/website` (PR→main→auto-deploy). Sin firmas de Claude. Comandos: `npm run typecheck` · `npm run build` · `npm run test:unit` · `npx vitest run <f>`.

**Restricciones (NO romper):** `executionPayload`, `ACTIVE_JOB_KEY`, `CONFIG_KEY`, `parseSearch/buildSearch`, setters de estado, efecto de polling/backoff (debe quedar en el padre, fuera de subárboles ocultos), validación inline, "Compartir configuración".

---

## Fase A — Lógica pura: suavizado del ETA (TDD)

### Task 1: EMA + histéresis en `progresoDescarga.ts`

**Files:** Modify `src/app/lib/progresoDescarga.ts` · Test `src/app/lib/progresoDescarga.test.ts` (ya existe; añadir casos)

- [ ] **Step 1: Test que falla** — añadir al describe existente:

```ts
import { emaSiguiente, etaEstableSeg } from './progresoDescarga';

describe('suavizado de ETA', () => {
  it('emaSiguiente arranca con el primer valor', () => {
    expect(emaSiguiente(null, 100)).toBe(100);
  });
  it('emaSiguiente promedia exponencialmente (alpha 0.25)', () => {
    expect(emaSiguiente(100, 200, 0.25)).toBe(125);
  });
  it('etaEstableSeg conserva el previo si cambia <10%', () => {
    expect(etaEstableSeg(100, 105)).toBe(100); // 5% < 10% -> conserva
    expect(etaEstableSeg(100, 130)).toBe(130); // 30% -> actualiza
  });
  it('etaEstableSeg toma el nuevo si no hay previo', () => {
    expect(etaEstableSeg(null, 90)).toBe(90);
  });
});
```

- [ ] **Step 2: Correr y ver fallar** — `npx vitest run src/app/lib/progresoDescarga.test.ts` → FAIL (funciones no existen).

- [ ] **Step 3: Implementar** (añadir a `progresoDescarga.ts`):

```ts
/** Media móvil exponencial. `prev=null` => arranca con `actual`. */
export function emaSiguiente(prev: number | null, actual: number, alpha = 0.25): number {
  if (prev == null || !Number.isFinite(prev)) return actual;
  return Math.round(alpha * actual + (1 - alpha) * prev);
}

/** Histéresis: conserva el ETA mostrado si el nuevo cambia menos del umbral (anti-parpadeo). */
export function etaEstableSeg(prevShown: number | null, nuevo: number, umbral = 0.1): number {
  if (prevShown == null || prevShown <= 0) return nuevo;
  return Math.abs(nuevo - prevShown) / prevShown < umbral ? prevShown : nuevo;
}
```

- [ ] **Step 4: Correr y ver pasar** → PASS.
- [ ] **Step 5: Commit** — `git add src/app/lib/progresoDescarga.ts src/app/lib/progresoDescarga.test.ts && git commit -m "feat(extractor): EMA + histeresis para ETA estable"`

---

## Fase B — Quick wins en DataExtractor (presentación)

### Task 2: Quitar "X/X listas", jerga de páginas y auto-scroll

**Files:** Modify `src/app/components/DataExtractor.tsx`

- [ ] **Step 1:** Eliminar el badge "X/X listas" (≈líneas 1357-1359): borrar el `<span>` que renderiza `accordionSections.filter(sectionComplete).length`/`.length` + " listas".
- [ ] **Step 2:** Quitar de la UI la jerga de páginas: en el ProgressHero quitar el chip `PÁGINA {runtimeCurrentPage}` (mantener Velocidad→ver Task 7 y Tiempo), y en la estimación pre-descarga (≈1437-1442) quitar la columna "página(s)", dejando **filas aprox.** + **peso aprox.** (grid de 2, no 3). Conservar `currentPage/totalPages` solo para el cálculo interno del %.
- [ ] **Step 3:** Quitar el auto-scroll: en el efecto del ReadyDownloadPanel (≈2605-2611) eliminar el bloque `el.scrollIntoView({...})` (y el `ref`/`useEffect` que solo servía para eso).
- [ ] **Step 4:** `npm run typecheck` → 0 errores. Verificar en navegador (Task 8 hace la integral).
- [ ] **Step 5: Commit** — `git commit -am "refactor(extractor): quita contador de listas, jerga de paginas y auto-scroll"`

### Task 3: Vista previa con altura fija + 13 columnas + etiqueta honesta

**Files:** Modify `src/app/components/DataExtractor.tsx`

- [ ] **Step 1:** Cambiar `previewColumns` (≈línea 352): quitar `.slice(0, 8)` → usar todas las columnas (`Object.keys(preview.rows[0])`).
- [ ] **Step 2:** Envolver la tabla de preview (≈1527-1548) en un contenedor scrollable accesible: `<div role="region" aria-label="Vista previa de datos" tabIndex={0} className="max-h-[28rem] overflow-auto rounded-lg border border-border">`. Hacer `<thead>` sticky: clases `sticky top-0 bg-card` en el `<thead>`/`<th>`, y sustituir el `border-b` del header por `shadow-[inset_0_-1px_0_var(--border)]`.
- [ ] **Step 3:** Etiqueta honesta: junto a "{rowCount} filas encontradas" mostrar "muestra de {preview.rows.length} de {rowCount}". Reservar altura en el EmptyState (`min-h-[20rem]`).
- [ ] **Step 4:** `npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -am "feat(extractor): preview con altura fija + scroll interno + 13 columnas + etiqueta honesta"`

---

## Fase C — Slide-to-accept (consentimiento)

### Task 4: Componente `SlideToAccept` + integración + consolidar el step duplicado

**Files:** Create `src/app/components/SlideToAccept.tsx` · Modify `src/app/components/DataExtractor.tsx`

- [ ] **Step 1: Crear `SlideToAccept.tsx`** (input range nativo = accesible; degrada con reduced-motion):

```tsx
import { useId, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export function SlideToAccept({ accepted, onChange }: { accepted: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const [val, setVal] = useState(accepted ? 100 : 0);
  const reduce = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // Fallback reduced-motion: checkbox seco.
  if (reduce.current) {
    return (
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${accepted ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'}`}>
        <input type="checkbox" checked={accepted} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
        <Texto />
      </label>
    );
  }

  const commit = (v: number) => { if (v >= 95) { setVal(100); onChange(true); } else { setVal(0); onChange(false); } };

  return (
    <div className={`rounded-xl border p-4 ${accepted ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'}`}>
      <Texto />
      <div className="relative mt-3 h-12 select-none overflow-hidden rounded-full border border-border bg-background">
        <div className="absolute inset-y-0 left-0 rounded-full bg-success/25 transition-[width]" style={{ width: `calc(${val}% )` }} />
        <input
          id={id}
          type="range" min={0} max={100} value={val}
          aria-label={accepted ? 'Aviso legal aceptado' : 'Desliza para aceptar el aviso legal'}
          onChange={(e) => setVal(Number(e.target.value))}
          onMouseUp={() => commit(val)} onTouchEnd={() => commit(val)} onKeyUp={() => commit(val)}
          className="absolute inset-0 z-10 h-full w-full cursor-grab opacity-0"
        />
        <span className="pointer-events-none absolute top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-white shadow transition-[left]"
          style={{ left: `calc(${val}% * 0.78 + 0.375rem)`, background: accepted ? 'var(--success)' : 'var(--primary)' }}>
          <ShieldCheck className="h-5 w-5" />
        </span>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {accepted ? '✓ Aviso legal aceptado' : 'Desliza para aceptar →'}
        </span>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{accepted ? 'Aviso legal aceptado' : ''}</p>
    </div>
  );
}

function Texto() {
  return (
    <span className="min-w-0 text-sm">
      <span className="block font-semibold text-card-foreground">Aviso legal</span>
      <span className="mt-1 block text-muted-foreground">Herramienta para fines académicos e investigativos. Los datos provienen de IDEAM y Datos Abiertos Colombia; el usuario conserva la responsabilidad sobre su uso posterior.</span>
    </span>
  );
}
export default SlideToAccept;
```

- [ ] **Step 2:** En `DataExtractor.tsx`, reemplazar el uso de `<ConsentBar accepted={acceptedTerms} onChange={setAcceptedTerms} />` (≈1424) por `<SlideToAccept accepted={acceptedTerms} onChange={setAcceptedTerms} />` (import arriba). Borrar la función `ConsentBar` (≈2174) si queda sin uso.
- [ ] **Step 3: Consolidar el step duplicado:** sacar `'consent'` de `STEP_IDS` (≈línea 63); en el default de `step` (≈253) usar `'variable'` si era `'consent'`; eliminar el render `step === 'consent'` del stepper (≈1718-1734) si existe. El guard de `STEP_IDS.includes` hace que un deep-link viejo `step=consent` caiga a `variable`.
- [ ] **Step 4:** `npm run typecheck` + `npm run build`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(extractor): slide-to-accept accesible + consolida el aviso legal"`

---

## Fase D — Filtros: FacetCombobox

### Task 5: Componente `FacetCombobox` (Radix Popover) + migrar territorio/avanzados/estaciones

**Files:** Create `src/app/components/FacetCombobox.tsx` · Modify `src/app/components/DataExtractor.tsx`

- [ ] **Step 1: Crear `FacetCombobox.tsx`** — disparador + Radix Popover portalizado con buscador + listbox de checkboxes + Todos/Ninguno. Props: `{ label, options: {value,label,total?}[], selected: string[], onToggle(value), onAll(), onNone(), status?, disabled? }`. Usar `@radix-ui/react-popover` (ya instalado), `normalizeText` para la búsqueda (importar de `../lib/...` donde viva, o duplicar la mini-fn), portal con `<Popover.Portal>`. Trigger: botón "{label} · {selected.length}" o "{label}" si 0.
- [ ] **Step 2: Territorio** (≈1815-1841): reemplazar la nube de 32 chips por `<FacetCombobox label="Departamento" options={departamentos.map(...)} selected={selectedDepartments} onToggle={toggleDepartment} onAll={selectAllDepartments} onNone={clearDepartments} />` + el botón "Mapa" existente. Mantener `MapaSelectorDepartamentos` lazy.
- [ ] **Step 3: Filtros avanzados** (≈1853-1927): por cada `catalogFilter`, un `<FacetCombobox>` con sus `catalogOptions[key]` (incluye `total`), `status={catalogOptionStatus[key]}`, `disabled` si no `ready`/`warming`. Quitar el `slice(0,80)`.
- [ ] **Step 4: Barra de chips única** encima del CTA: una fila con los seleccionados (territorio + filtros) como chips removibles + "Limpiar todo". Reusa los setters; sustituye los resúmenes dispersos.
- [ ] **Step 5:** No cambiar la forma del estado (mismos setters). `npm run typecheck` + `npm run build`. Commit — `git add -A && git commit -m "feat(extractor): FacetCombobox unificado (territorio + avanzados) con popover buscable"`

---

## Fase E — Estructural: flujo en dos fases + modo enfoque

### Task 6: Máquina de modos `config|running|results` + modo enfoque

**Files:** Modify `src/app/components/DataExtractor.tsx`

- [ ] **Step 1: Estado de modo.** Añadir `const [mode, setMode] = useState<'config'|'running'|'results'>('config')` y `const [enfoque, setEnfoque] = useState(false)`. Derivar con efecto:

```tsx
useEffect(() => {
  if (isBusy && !readyDownloadJob) setMode('running');
  else if (readyDownloadJob || preview || downloadMetrics) setMode('results');
  // 'config' solo por acción explícita (no auto) para no sacar al usuario mientras edita.
}, [isBusy, readyDownloadJob, preview, downloadMetrics]);
```
Al montar con `ACTIVE_JOB_KEY` el efecto ya lo lleva a `running` (isBusy se setea en el restore).

- [ ] **Step 2: Reestructurar el `return` (≈1349-1615) en dos subárboles SIEMPRE montados**, alternando visibilidad con `hidden`:
  - `<section className={mode === 'config' ? '' : 'hidden'}>` → acordeón + SlideToAccept + estimación + CTA.
  - `<section className={mode === 'config' ? 'hidden' : ''}>` → ProgressHero + CuriosidadEspera + (results: ReadyDownloadPanel + preview + detalle + centro). NO usar ternario que cambie el tipo en la misma posición.
- [ ] **Step 3: Transición + retorno.** Helper `const irA = (m) => document.startViewTransition ? document.startViewTransition(() => setMode(m)) : setMode(m)`. Botón "← Editar configuración" en running/results que hace `irA('config')` (+ `cancelarEspera()` si running) y mueve foco al primer control de config (`ref` + `tabIndex=-1`). Breadcrumb `<nav aria-label="Progreso"><ol>Configuración › Ejecución</ol></nav>`. "Nueva descarga" en results = limpiar preview/metrics + `irA('config')`.
- [ ] **Step 4: Modo enfoque.** `useEffect` que al entrar en `running` setea `enfoque=true` y al salir (`config`/`results` terminal) lo deja; aplicar `enfoque` colapsando el sidebar vía el COLLAPSE_KEY (`window.localStorage.setItem('ideam-sidebar-collapsed','1')` + disparar el evento que el Sidebar escucha, O elevar un callback/onRuntimeChange). Botón manual "Modo enfoque" (Maximize/Minimize lucide) con salida por `Esc`. Presentación pura: no toca job/URL. (Si el Sidebar no expone API, usar `onRuntimeChange` para que el layout padre colapse.)
- [ ] **Step 5:** `npm run typecheck` + `npm run build`. Commit — `git add -A && git commit -m "feat(extractor): flujo en dos fases (config|running|results) + modo enfoque"`

---

## Fase F — Progreso honesto (wire EMA) + cierre

### Task 7: Conectar EMA al display de progreso

**Files:** Modify `src/app/components/DataExtractor.tsx`

- [ ] **Step 1:** Añadir refs `emaRpsRef = useRef<number|null>(null)` y `etaShownRef = useRef<number|null>(null)`. En el cómputo de runtime (≈1173-1181): `emaRpsRef.current = emaSiguiente(emaRpsRef.current, currentJob?.rowsPerSecond ?? 0)`; `const restantes = Math.max(0, (runtimeTotalRows||0) - runtimeRows)`; `const etaCrudo = emaRpsRef.current > 0 ? restantes / emaRpsRef.current : null`; `etaShownRef.current = etaCrudo!=null ? etaEstableSeg(etaShownRef.current, etaCrudo) : etaShownRef.current`; `runtimeEta = etaAmable(etaShownRef.current) || (planning ? 'Calculando' : '')`. Resetear refs a null al iniciar `runDownload` (no en `retrying`).
- [ ] **Step 2:** Fase nombrada en el hero: usar `phaseIndex`→ etiqueta ("Planeando"/"Descargando"/"Empacando"/"Listo"). Filas: "X de ~Y" (con `~` si total estimado). `aria-valuenow` solo si determinado.
- [ ] **Step 3:** `prefers-reduced-motion` en el contador `animatedRows` (≈855-861): si `matchMedia('(prefers-reduced-motion: reduce)').matches`, setear el valor final directo sin lerp.
- [ ] **Step 4:** `npm run typecheck` + `npm run test:unit`.
- [ ] **Step 5: Commit** — `git commit -am "feat(extractor): progreso con ETA suavizado, fase nombrada y reduced-motion"`

---

## Cierre

### Task 8: Verificación integral + PR

- [ ] **Step 1:** `npm run typecheck` → 0. `npm run test:unit` → todos verdes. `npm run build` → OK.
- [ ] **Step 2:** Verificar en Chrome (claro/oscuro + teclado): iniciar descarga cambia a vista running (config oculta); "Editar configuración" conserva depto/fechas/formatos; recarga con job activo arranca en running; job completado → results con ZIP; deep-link precarga en config; gate bloquea sin aceptar y el slide acepta con teclado; reduced-motion → fallbacks secos; preview con scroll interno (espaciadora) + 13 columnas; sin "X/X listas", sin "páginas", sin auto-scroll. Capturas.
- [ ] **Step 3:** Confirmar deep-links/persistencia intactos (CONFIG_KEY, ACTIVE_JOB_KEY, Compartir).
- [ ] **Step 4:** Push `feat/extractor-v2-rediseno`; PR a `sergiobc27/website` (cuerpo: las 6 fases, frontend puro). Tras merge: vigilar que CI pase (`npm audit` ya OK con dompurify 3.4.11) → auto-deploy → verificación en producción.

## Self-review (cubierto)
- **Cobertura del spec:** 1 dos-fases (Task 6) · 2 quitar 4/4 (Task 2) · 3 páginas (Task 2) · 4 auto-scroll (Task 2) · 5 preview (Task 3) · 6 filtros (Task 5) · 7 modo enfoque (Task 6) · 8 progreso (Tasks 1+7) · 9 slide-to-accept (Task 4) · 10 toques (transversal). ✔
- **Sin placeholders:** módulo puro y SlideToAccept con código completo; resto localizado por ancla + contenido. ✔
- **Consistencia de tipos:** `emaSiguiente`/`etaEstableSeg` (firmas usadas igual en Task 1 y 7); `SlideToAccept({accepted,onChange})` y `FacetCombobox` props consistentes. ✔
