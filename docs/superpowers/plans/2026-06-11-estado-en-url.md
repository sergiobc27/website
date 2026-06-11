# Estado en la URL + Copiar enlace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que las 5 vistas de datos (Comparador, Hidrología, Analítica, Mapa, Ficha) reflejen su selección en la URL y sean restaurables al recargar/compartir, con un botón "Copiar enlace" en el Navbar.

**Architecture:** Helpers puros (`urlState.ts`) que convierten entre query string y objeto, más un hook `useUrlSync` que ESCRIBE la URL cuando cambia el estado (`replaceState`, sin ensuciar el historial) y RESTAURA el estado en montaje y en `popstate`. Cada vista declara qué parámetros expone, omitiendo valores por defecto para mantener la URL limpia. Sin librerías nuevas; encaja con la navegación por History API existente.

**Tech Stack:** React 18, TypeScript, Vite, vitest, sonner (toasts ya presente).

**Nota sobre commits:** los pasos incluyen `git commit`, pero **ejecútalos solo con el visto bueno de Sergio** (regla del proyecto: no commitear sin pedirlo). Mensajes de commit sin firmas de Claude.

---

## File Structure

- **Create** `src/app/lib/urlState.ts` — helpers puros `parseSearch`/`buildSearch` + hook `useUrlSync`.
- **Create** `src/app/lib/urlState.test.ts` — tests de los helpers puros.
- **Create** `src/app/components/CopyLinkButton.tsx` — botón 🔗 del Navbar.
- **Modify** `src/app/components/Navbar.tsx` — montar `CopyLinkButton`.
- **Modify** `src/app/components/ComparadorEstaciones.tsx` — sincronizar `var`/`est`/`tr`.
- **Modify** `src/app/components/Hidrologia.tsx` — sincronizar `est`/`spi`/`anio` (restauración asíncrona de estación por código).
- **Modify** `src/app/components/Analytics.tsx` — sincronizar `var`/`dep`/`int`/`metric`/`years`.
- **Modify** `src/app/components/MapaEstaciones.tsx` — sincronizar filtros + `choro`.
- **Modify** `src/app/components/FichaClimatica.tsx` — sincronizar `dep`/`mun` (sustituye el hash).
- **Modify** `src/app/App.tsx` — shim de compatibilidad para hashes viejos `#/ficha/DEP/MUN`; simplificar el manejo de la ficha.

---

## Task 1: Helpers puros de URL (`urlState.ts`)

**Files:**
- Create: `src/app/lib/urlState.ts`
- Test: `src/app/lib/urlState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/lib/urlState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSearch, buildSearch } from './urlState';

describe('lib/urlState', () => {
  it('parseSearch lee pares clave-valor (con o sin ?)', () => {
    expect(parseSearch('?var=precip&tr=10')).toEqual({ var: 'precip', tr: '10' });
    expect(parseSearch('est=A,B')).toEqual({ est: 'A,B' });
    expect(parseSearch('')).toEqual({});
  });

  it('buildSearch omite vacíos y undefined, con orden estable', () => {
    expect(buildSearch({ var: 'precip', est: '', tr: undefined })).toBe('var=precip');
    expect(buildSearch({ b: '2', a: '1' })).toBe('a=1&b=2');
    expect(buildSearch({})).toBe('');
  });

  it('round-trip parse(build(x)) preserva los valores no vacíos', () => {
    const x = { var: 'precip', est: 'APULO,SOCHA', tr: '100' };
    expect(parseSearch('?' + buildSearch(x))).toEqual(x);
  });

  it('codifica/decodifica valores con caracteres especiales', () => {
    const s = buildSearch({ mun: 'BOGOTÁ, D.C.' });
    expect(parseSearch('?' + s)).toEqual({ mun: 'BOGOTÁ, D.C.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/lib/urlState.test.ts`
Expected: FAIL con "Failed to resolve import './urlState'".

- [ ] **Step 3: Write minimal implementation**

Create `src/app/lib/urlState.ts`:

```ts
// Helpers puros para sincronizar estado de vista <-> query string de la URL.
// Sin React: testeables de forma aislada.

export function parseSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

// Arma la query omitiendo vacíos/undefined; orden alfabético estable para no
// generar replaceStates redundantes cuando el contenido lógico no cambió.
export function buildSearch(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value !== undefined && value !== '') sp.set(key, value);
  }
  return sp.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/lib/urlState.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/urlState.ts src/app/lib/urlState.test.ts
git commit -m "feat(urlState): helpers puros parseSearch/buildSearch"
```

---

## Task 2: Hook `useUrlSync`

**Files:**
- Modify: `src/app/lib/urlState.ts`

- [ ] **Step 1: Add the hook to `urlState.ts`**

Append to `src/app/lib/urlState.ts`:

```ts
import { useEffect, useRef } from 'react';

interface UseUrlSyncOptions {
  // Estado actual de la vista, ya serializado a strings. Los valores en su
  // default deben pasarse como `undefined` para mantener la URL limpia.
  params: Record<string, string | undefined>;
  // Restaura el estado desde la URL. Se llama UNA vez en montaje y en cada
  // popstate (atrás/adelante / enlace restaurado). Debe usar solo setters.
  onRestore?: (params: Record<string, string>) => void;
}

// Sincroniza estado de vista con la query string. Escribe con replaceState
// (no crea entradas de historial por cada cambio) y restaura en montaje/popstate.
export function useUrlSync({ params, onRestore }: UseUrlSyncOptions): void {
  const search = buildSearch(params);
  const mounted = useRef(false);

  // WRITE: refleja el estado en la URL cuando cambia. IMPORTANTE: se SALTA la
  // primera pasada para no pisar los params de un enlace pegado antes de que
  // onRestore (efecto de abajo) los lea de la URL original.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const current = window.location.search.replace(/^\?/, '');
    if (current === search) return;
    const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', url);
  }, [search]);

  // READ: restaura al montar (la URL aún está intacta porque WRITE se saltó la
  // primera pasada) y ante atrás/adelante.
  useEffect(() => {
    if (!onRestore) return;
    onRestore(parseSearch(window.location.search));
    const handler = () => onRestore(parseSearch(window.location.search));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
    // onRestore debe ser estable (solo setters); deps vacías a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 2: Verify typecheck and existing tests still pass**

Run: `npx tsc --noEmit && npx vitest run src/app/lib/urlState.test.ts`
Expected: TS exit 0; 4 tests PASS (los helpers no cambiaron).

- [ ] **Step 3: Commit**

```bash
git add src/app/lib/urlState.ts
git commit -m "feat(urlState): hook useUrlSync (write replaceState + restore en montaje/popstate)"
```

---

## Task 3: Botón "Copiar enlace" en el Navbar

**Files:**
- Create: `src/app/components/CopyLinkButton.tsx`
- Modify: `src/app/components/Navbar.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/components/CopyLinkButton.tsx`:

```tsx
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';

// Copia la URL actual (que ya incluye el estado de la vista en la query).
export function CopyLinkButton() {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar; copia la dirección manualmente desde la barra del navegador');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      title="Copiar enlace de esta vista"
      aria-label="Copiar enlace de esta vista"
    >
      <Link2 className="h-5 w-5" />
    </button>
  );
}
```

- [ ] **Step 2: Mount it in the Navbar**

In `src/app/components/Navbar.tsx`, add the import near the other component imports:

```tsx
import { CopyLinkButton } from './CopyLinkButton';
```

Then, in the right-hand controls cluster (the `<div className="flex shrink-0 items-center gap-2 md:gap-3">`), add `<CopyLinkButton />` immediately BEFORE the Help button (the one that calls `onNavigate('docs')` with the `HelpCircle` icon):

```tsx
        <CopyLinkButton />
        {/* botón de ayuda (HelpCircle) existente queda aquí */}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: TS exit 0; build OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/CopyLinkButton.tsx src/app/components/Navbar.tsx
git commit -m "feat(navbar): botón Copiar enlace"
```

---

## Task 4: Comparador — sincronizar `var` / `est` / `tr`

**Files:**
- Modify: `src/app/components/ComparadorEstaciones.tsx`

Contexto: `datasetId` (default `'s54a-sgyg'`, setter `setDatasetId`), `selectedCodes` (string[], setter `setSelectedCodes`, default desde `readStoredCodes()`), `idfTr` (number, default `10`, setter `setIdfTr`).

- [ ] **Step 1: Import the hook**

Add to the React import line / imports of `ComparadorEstaciones.tsx`:

```tsx
import { useUrlSync } from '../lib/urlState';
```

- [ ] **Step 2: Call useUrlSync inside the component**

Add this right after the state declarations (after `const [error, setError] = useState('')`), so it can read/write the state:

```tsx
  // Estado en la URL: ?var=<dataset>&est=COD1,COD2&tr=10 (defaults omitidos).
  useUrlSync({
    params: {
      var: datasetId === 's54a-sgyg' ? undefined : datasetId,
      est: selectedCodes.length ? selectedCodes.join(',') : undefined,
      tr: idfTr === 10 ? undefined : String(idfTr),
    },
    onRestore: (p) => {
      if (p.var) setDatasetId(p.var);
      // La URL tiene prioridad sobre los códigos guardados en localStorage.
      if (p.est) setSelectedCodes(p.est.split(',').filter(Boolean));
      if (p.tr && Number.isFinite(Number(p.tr))) setIdfTr(Number(p.tr));
    },
  });
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: TS exit 0; build OK.

- [ ] **Step 4: Manual verification**

Run `npm run dev:web`, abre `/compare`, selecciona 2 estaciones y cambia Tr. Verifica que la URL muestra `?est=...&tr=...`. Recarga: la selección se mantiene. Copia el enlace, ábrelo en pestaña nueva: misma selección.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ComparadorEstaciones.tsx
git commit -m "feat(compare): estado de selección en la URL"
```

---

## Task 5: Hidrología — sincronizar `est` / `spi` / `anio` (restauración asíncrona)

**Files:**
- Modify: `src/app/components/Hidrologia.tsx`

Contexto: `catalog` (StationLite[], carga asíncrona), `station` (StationLite|null, setter `setStation`), `spiScale` (3|6|12, default 12, setter `setSpiScale`), `hyetographYear` (string, default '', setter `setHyetographYear`). El código de estación es `station.codigo`; en el catálogo cada item tiene `.codigo`.

- [ ] **Step 1: Import the hook and useRef (useRef ya está importado)**

Add to imports of `Hidrologia.tsx`:

```tsx
import { useUrlSync } from '../lib/urlState';
```

(`useRef` ya se importa desde 'react' en la línea 1.)

- [ ] **Step 2: Add a ref to stash the pending station code**

After the state declarations, add:

```tsx
  // Código de estación pendiente de restaurar desde la URL (la estación solo
  // puede seleccionarse una vez cargado el catálogo).
  const pendingStationCode = useRef<string | null>(null);
```

- [ ] **Step 3: Call useUrlSync**

Add after the ref:

```tsx
  // Estado en la URL: ?est=<codigo>&spi=12&anio=2020 (defaults omitidos).
  useUrlSync({
    params: {
      est: station?.codigo || undefined,
      spi: spiScale === 12 ? undefined : String(spiScale),
      anio: hyetographYear || undefined,
    },
    onRestore: (p) => {
      pendingStationCode.current = p.est || null;
      if (p.spi === '3' || p.spi === '6' || p.spi === '12') setSpiScale(Number(p.spi) as 3 | 6 | 12);
      if (p.anio) setHyetographYear(p.anio);
    },
  });
```

- [ ] **Step 4: Apply the pending station code once the catalog is loaded**

Add this effect after `useUrlSync`:

```tsx
  // Cuando el catálogo está disponible, selecciona la estación pendiente por
  // código. Si no existe, avisa suave y deja el selector.
  useEffect(() => {
    const code = pendingStationCode.current;
    if (!code || !catalog.length) return;
    pendingStationCode.current = null;
    const found = catalog.find((s) => s.codigo === code);
    if (found) setStation(found);
    else toast.error(`No se encontró la estación ${code}; elige otra del listado.`);
  }, [catalog]);
```

- [ ] **Step 5: Ensure `toast` is imported**

Confirma que `import { toast } from 'sonner';` está presente en `Hidrologia.tsx`. Si no, agrégalo junto a los imports.

Run: `npx grep -n "from 'sonner'" src/app/components/Hidrologia.tsx` (o revisa los imports). Si falta, añade la línea.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: TS exit 0; build OK.

- [ ] **Step 7: Manual verification**

`/hydro`: elige una estación y cambia la escala SPI. La URL muestra `?est=...&spi=...`. Recarga: se restaura la estación (espera a que cargue el catálogo). Pega el enlace en otra pestaña: misma estación.

- [ ] **Step 8: Commit**

```bash
git add src/app/components/Hidrologia.tsx
git commit -m "feat(hydro): estación y controles en la URL (restauración por código)"
```

---

## Task 6: Analítica — sincronizar `var` / `dep` / `int` / `metric` / `years`

**Files:**
- Modify: `src/app/components/Analytics.tsx`

Contexto: `datasetId` (default `'s54a-sgyg'`), `department` (default `''`), `interval` (AnalyticsInterval, default `'year'`), `metric` (AnalyticsMetric, default `'avg'`), `yearRange` ([number,number]|null), `yearTouched` (bool — si se restaura un rango hay que marcarlo `true` para que el efecto de auto-inicialización no lo pise). Setters: `setDatasetId`, `setDepartment`, `setInterval`, `setMetric`, `setYearRange`, `setYearTouched`.

- [ ] **Step 1: Import the hook**

```tsx
import { useUrlSync } from '../lib/urlState';
```

- [ ] **Step 2: Call useUrlSync after the state declarations**

```tsx
  // Estado en la URL: ?var=<dataset>&dep=<depto>&int=year&metric=avg&years=2000-2020.
  useUrlSync({
    params: {
      var: datasetId === 's54a-sgyg' ? undefined : datasetId,
      dep: department || undefined,
      int: interval === 'year' ? undefined : interval,
      metric: metric === 'avg' ? undefined : metric,
      years: yearRange ? `${yearRange[0]}-${yearRange[1]}` : undefined,
    },
    onRestore: (p) => {
      if (p.var) setDatasetId(p.var);
      if (p.dep) setDepartment(p.dep);
      if (p.int === 'year' || p.int === 'month') setInterval(p.int as AnalyticsInterval);
      if (p.metric) setMetric(p.metric as AnalyticsMetric);
      const m = p.years?.match(/^(\d{4})-(\d{4})$/);
      if (m) {
        setYearRange([Number(m[1]), Number(m[2])]);
        setYearTouched(true);
      }
    },
  });
```

Nota: si los valores válidos de `AnalyticsInterval`/`AnalyticsMetric` difieren de `year|month` / `avg`, ajusta los `if` a las uniones reales (revisa el tipo en `../../shared/ideamContracts` o donde esté definido) antes de implementar.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: TS exit 0; build OK.

- [ ] **Step 4: Manual verification**

`/analytics`: cambia variable, departamento y rango de años. La URL refleja `?var=...&dep=...&years=...`. Recarga y pega el enlace: se restaura.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/Analytics.tsx
git commit -m "feat(analytics): filtros y rango en la URL"
```

---

## Task 7: Mapa — sincronizar filtros + `choro`

**Files:**
- Modify: `src/app/components/MapaEstaciones.tsx`

Contexto (defaults entre paréntesis): `estadoFilter` (`'todas'`), `categoriaFilter` (`''`), `departamentoFilter` (`''`), `zonaFilter` (`''`), `corrienteFilter` (`''`), `altitudMax` (number|null, default `null`), `sparkDataset` (`'s54a-sgyg'`), `choroplethOn` (bool, default `false`). Setters homónimos con prefijo `set`.

- [ ] **Step 1: Import the hook**

```tsx
import { useUrlSync } from '../lib/urlState';
```

- [ ] **Step 2: Call useUrlSync after the state declarations**

```tsx
  // Estado en la URL: filtros del mapa + dataset del sparkline + choropleth.
  useUrlSync({
    params: {
      var: sparkDataset === 's54a-sgyg' ? undefined : sparkDataset,
      estado: estadoFilter === 'todas' ? undefined : estadoFilter,
      cat: categoriaFilter || undefined,
      dep: departamentoFilter || undefined,
      zona: zonaFilter || undefined,
      corriente: corrienteFilter || undefined,
      altmax: altitudMax === null ? undefined : String(altitudMax),
      choro: choroplethOn ? '1' : undefined,
    },
    onRestore: (p) => {
      if (p.var) setSparkDataset(p.var);
      if (p.estado === 'todas' || p.estado === 'activa' || p.estado === 'otra') setEstadoFilter(p.estado);
      if (p.cat) setCategoriaFilter(p.cat);
      if (p.dep) setDepartamentoFilter(p.dep);
      if (p.zona) setZonaFilter(p.zona);
      if (p.corriente) setCorrienteFilter(p.corriente);
      if (p.altmax && Number.isFinite(Number(p.altmax))) setAltitudMax(Number(p.altmax));
      if (p.choro === '1') setChoroplethOn(true);
    },
  });
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: TS exit 0; build OK.

- [ ] **Step 4: Manual verification**

`/map`: aplica un par de filtros (departamento, estado) y activa choropleth. La URL refleja `?dep=...&estado=...&choro=1`. Recarga y pega el enlace: filtros restaurados.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/MapaEstaciones.tsx
git commit -m "feat(map): filtros y choropleth en la URL"
```

---

## Task 8: Ficha — migrar de hash a query (`?dep`/`?mun`) con compatibilidad

**Files:**
- Modify: `src/app/components/FichaClimatica.tsx`
- Modify: `src/app/App.tsx`

Contexto FichaClimatica: estado `department`/`setDepartment` y `municipality`/`setMunicipality`. Hoy un efecto (≈ líneas 85-89) hace `replaceState` al hash `fichaHash(department, municipality)`. App parsea `#/ficha/DEP/MUN` con `parseFichaHash`, mantiene `fichaParams`, y pasa `initialDepartment`/`initialMunicipality` a FichaClimatica.

- [ ] **Step 1: FichaClimatica — quitar el efecto de hash y usar useUrlSync**

En `FichaClimatica.tsx`, importa el hook:

```tsx
import { useUrlSync } from '../lib/urlState';
```

ELIMINA el efecto que sincroniza al hash (el bloque que hace `window.history.replaceState(null, '', fichaHash(department, municipality))`).

En su lugar, agrega tras las declaraciones de estado:

```tsx
  // Estado en la URL: /ficha?dep=<depto>&mun=<municipio>.
  useUrlSync({
    params: {
      dep: department || undefined,
      mun: municipality || undefined,
    },
    onRestore: (p) => {
      if (p.dep) setDepartment(p.dep);
      if (p.mun) setMunicipality(p.mun);
    },
  });
```

Mantén la función `fichaHash`/parseo viejo SOLO si App la usa para el shim (ver Step 3); si queda sin usar, elimínala.

- [ ] **Step 2: App.tsx — simplificar el render de la ficha**

En `App.tsx`, en `renderContent()` caso `'ficha'`, renderiza `<FichaClimatica />` sin props (la ficha ahora lee su estado de la query). Mantén el `key` estable o elimínalo:

```tsx
      case 'ficha':
        return <FichaClimatica />;
```

Elimina el estado `fichaParams` y su uso si ya no es necesario (la ficha se autogestiona). Conserva la sincronización de `currentView` con la ruta.

- [ ] **Step 3: App.tsx — shim de compatibilidad para hashes viejos**

Reemplaza `parseFichaHash` por una conversión: si la URL trae `#/ficha/DEP/MUN`, conviértela a `/ficha?dep=DEP&mun=MUN` con `replaceState` y fija la vista en `'ficha'`. Aplica esto en el arranque y en el listener de `hashchange`.

```tsx
// Convierte un hash viejo #/ficha/DEP/MUN a la ruta nueva /ficha?dep=&mun=.
// Devuelve true si hizo la conversión.
function migrateLegacyFichaHash(): boolean {
  const match = window.location.hash.match(/^#\/ficha\/([^/]+)\/([^/]+)/);
  if (!match) return false;
  try {
    const dep = decodeURIComponent(match[1]);
    const mun = decodeURIComponent(match[2]);
    const search = new URLSearchParams({ dep, mun }).toString();
    window.history.replaceState(null, '', `/ficha?${search}`);
    return true;
  } catch {
    return false;
  }
}
```

En el `useState` inicial de `currentView` y en el efecto `sync` (popstate/hashchange), llama primero a `migrateLegacyFichaHash()`; si devuelve true, fija `setCurrentView('ficha')`; si no, usa `pathToView(window.location.pathname)` como ya hace.

- [ ] **Step 4: Verify build and existing tests**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: TS exit 0; tests PASS; build OK.

- [ ] **Step 5: Manual verification**

`/ficha`: elige departamento + municipio. La URL muestra `/ficha?dep=...&mun=...`. Recarga: restaurado. Pega un enlace VIEJO de la forma `#/ficha/CUNDINAMARCA/APULO`: debe convertirse a `/ficha?dep=CUNDINAMARCA&mun=APULO` y mostrar la ficha correcta.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/FichaClimatica.tsx src/app/App.tsx
git commit -m "feat(ficha): estado en query (?dep&mun) con compatibilidad de hash viejo"
```

---

## Task 9: Verificación final integral

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Typecheck, tests y build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: TS exit 0; todos los tests PASS; build OK.

- [ ] **Step 2: Checklist manual de extremo a extremo**

Con `npm run dev:web`, por cada vista (compare, hydro, analytics, map, ficha):
1. Hacer una selección → la URL cambia sola (sin defaults).
2. Recargar → la vista se restaura.
3. Click en 🔗 "Copiar enlace" → toast "Enlace copiado" → abrir en pestaña nueva → misma vista.
4. Botón atrás/adelante del navegador → la vista refleja el cambio.
5. Navegar a otra pestaña y volver → no quedan params colgados de la vista anterior.
6. Ficha: probar un hash viejo `#/ficha/DEP/MUN` → se convierte y funciona.

- [ ] **Step 3: Commit final (si quedaron ajustes)**

```bash
git add -A
git commit -m "test(urlState): verificación integral de estado en la URL"
```
