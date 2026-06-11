# Estado en la URL + Copiar enlace — Diseño

**Fecha:** 2026-06-11
**Autor:** Sergio Beltrán Coley (con asistencia)
**Estado:** Aprobado para implementación

## Objetivo

Hacer que cada vista de datos sea **reproducible y compartible**: la selección del
usuario (estación, variable, rango, período de retorno, filtros) viaja en la URL,
de modo que al recargar o pegar el enlace la vista se restaura idéntica. Más un
botón **"Copiar enlace"** en la barra superior. Es el eje de mayor valor para un
público que cita resultados en una tesis ("vea esta curva IDF en [enlace]").

## Alcance

- 5 vistas con estado sincronizado a la URL: **Comparador, Hidrología, Analítica, Mapa, Ficha**.
- Botón global **"Copiar enlace"** en el Navbar (copia `location.href`).
- Frontend puro, sin dependencias nuevas, sin router. Encaja con la navegación
  manual por History API existente (`lib/navigation.ts`).

## No-objetivos (YAGNI)

- **Vistas guardadas con nombre** — descartado por el usuario (poco uso esperado).
- **Viewport del mapa (centro/zoom) en la URL** — ruidoso (cambiaría en cada
  paneo); no aporta a la reproducibilidad del análisis.
- **Texto del buscador de estaciones** — efímero, no define el resultado.

## Parámetros por vista

Solo se sincroniza el estado que **define el resultado mostrado**, no los filtros
que únicamente acotan el buscador de estaciones. Los valores por defecto se omiten
de la URL (URL limpia).

| Vista | Ruta | Parámetros |
|---|---|---|
| Comparador | `/compare` | `var` (datasetId), `est` (códigos CSV), `tr` (idfTr) |
| Hidrología | `/hydro` | `est` (código de estación), `spi` (spiScale), `anio` (hyetographYear) |
| Analítica | `/analytics` | `var` (datasetId), `dep` (department), `int` (interval), `metric`, `years` (yearRange como `2000-2020`) |
| Mapa | `/map` | `var` (sparkDataset), `estado` (estadoFilter), `cat` (categoriaFilter), `dep` (departamentoFilter), `zona`, `corriente`, `altmax` (altitudMax), `choro` (choroplethOn, `0`/`1`) |
| Ficha | `/ficha` | `dep` (department), `mun` (municipality) |

**Ficha — migración de hash a query:** hoy comparte por hash (`#/ficha/DEP/MUN`).
Se migra a query params (`/ficha?dep=DEP&mun=MUN`) para unificar el patrón.
**Compatibilidad hacia atrás:** si llega un hash viejo `#/ficha/DEP/MUN`, se parsea
y se reemplaza por la forma query (los enlaces ya compartidos siguen funcionando).

## Arquitectura

Unidades nuevas, cada una con un propósito claro y testeable de forma aislada:

### `src/app/lib/urlState.ts`
Helpers **puros** (sin React) + un hook fino.

- `parseSearch(search: string): Record<string, string>` — lee `URLSearchParams`.
- `buildSearch(params: Record<string, string | undefined>): string` — arma la query
  omitiendo entradas vacías/undefined; resultado determinista (orden estable) para
  no generar replaceStates innecesarios.
- `useUrlState(fields: UrlField[])` — hook que:
  - **En montaje:** lee la URL; por cada campo presente, llama a su `apply(parse(raw))`.
  - **Ante cambios de estado** (efecto sobre los valores): arma la query desde los
    valores actuales y, si difiere de la actual, hace `history.replaceState` (no
    ensucia el historial con cada tecla/clic).
  - **Ante `popstate`:** re-lee y re-aplica (soporta atrás/adelante y la restauración
    de enlaces — ver Flujo).

`UrlField` = `{ key: string; value: string; apply: (raw: string) => void }`.
Cada vista convierte su estado a/desde string (p. ej. `est` ↔ `codes.join(',')`).

### `src/app/components/CopyLinkButton.tsx`
Botón de icono (🔗) para el Navbar. `onClick` → `navigator.clipboard.writeText(location.href)`
+ `toast.success('Enlace copiado')`; si el portapapeles no está disponible, `toast.error`
con instrucción de copiar manualmente. Incluye `aria-label`, `title` y `focus-visible`.

### Cambios en componentes existentes
- **Navbar.tsx:** monta `<CopyLinkButton />` junto a los controles de ayuda/tema.
- **ComparadorEstaciones / Hidrologia / Analytics / MapaEstaciones / FichaClimatica:**
  cada una declara sus `UrlField[]` y llama `useUrlState(...)`. La Ficha además
  reemplaza su lógica de hash por la de query (con el shim de compatibilidad).
- **App.tsx / lib/navigation.ts:** `pathToView` ya ignora la query (lee el primer
  segmento), así que las rutas no se rompen. La Ficha ya está en `VIEWS` (hecho en
  tanda previa). El shim de hash viejo vive en App (al detectar `#/ficha/...`, hace
  `replaceState` a `/ficha?dep=&mun=`).

## Flujo de datos

- **Selección del usuario** → estado del componente cambia → `useUrlState` escribe la
  query con `replaceState`. La barra de direcciones refleja la vista en vivo.
- **Recargar / pegar enlace** → en montaje el componente lee la query y aplica los
  valores (selecciona estación por código, fija variable/rango/filtros).
- **Copiar enlace** → copia `location.href` (que ya incluye la query en vivo).
- **Atrás/adelante del navegador** → `popstate` → la vista re-aplica los params.

## Errores y bordes

- **Param inválido o desconocido:** se ignora; el campo se queda en su valor por defecto.
- **Comparador:** si la URL trae `est`, tiene prioridad sobre los códigos guardados en
  `localStorage`; si no, se usa el almacenado (comportamiento actual).
- **Restaurar estación inexistente** (código que ya no está en el catálogo): no se
  selecciona, se muestra `toast` suave y se deja el selector visible.
- **Restauración asíncrona:** cuando el valor depende de datos cargados (p. ej.
  seleccionar la estación por código requiere el catálogo), el campo se aplica una vez
  que la lista está disponible (efecto que observa catálogo + param).
- **Portapapeles no disponible:** `CopyLinkButton` informa por toast y no rompe.

## Testing

- **`urlState.test.ts`** (vitest): `parseSearch` y `buildSearch` (omisión de vacíos,
  orden estable, round-trip parse→build→parse).
- **`savedViews`**: N/A (descartado).
- Verificación manual: para cada vista, seleccionar → recargar → confirmar restauración;
  copiar enlace y abrir en pestaña nueva; atrás/adelante; abrir un hash viejo de Ficha.
- Regresión: `tsc --noEmit`, `vitest run`, `vite build` en verde.

## Archivos afectados

**Nuevos:** `src/app/lib/urlState.ts`, `src/app/lib/urlState.test.ts`,
`src/app/components/CopyLinkButton.tsx`.
**Modificados:** `Navbar.tsx`, `ComparadorEstaciones.tsx`, `Hidrologia.tsx`,
`Analytics.tsx`, `MapaEstaciones.tsx`, `FichaClimatica.tsx`, `App.tsx`.
