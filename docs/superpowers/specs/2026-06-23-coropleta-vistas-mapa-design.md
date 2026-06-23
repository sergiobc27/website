# Vistas temáticas para la coropleta del mapa de estaciones

- **Fecha:** 2026-06-23
- **Componente:** `src/app/components/MapaEstaciones.tsx`
- **Estado:** diseño aprobado, pendiente de plan de implementación
- **Alcance:** frontend puro (sin cambios de base de datos ni deploy del backend)

## Problema

La coropleta del mapa de estaciones colorea hoy los departamentos por **número de
observaciones** (`rowCount`) de una variable. Para el público es poco informativo:
un departamento con muchas estaciones se pinta intenso aunque el fenómeno sea bajo.
No responde la pregunta natural de un visitante: "¿dónde llueve más?", "¿dónde hace
más calor?".

Además, aunque el selector de variable ya existe, la métrica está fija en "conteo de
filas", así que no hay forma de ver la magnitud real del fenómeno por región.

## Objetivo

Ofrecer un conjunto de **vistas temáticas con nombre claro** (pensadas para público
no técnico) que coloreen el mapa por la magnitud real del fenómeno, eligiendo cada
vista por su cuenta la variable IDEAM y la métrica correcta, con leyenda y unidades
honestas.

## Hecho relevante de backend (no se toca)

`POST /api/analytics/by-region` ya devuelve por departamento, además de `rowCount`:

- `mean`: valor promedio de la variable (magnitud real para temperatura, humedad,
  viento, niveles).
- `monthlyDepth`: solo precipitación, lámina mensual media en mm/mes (la métrica
  correcta de "cuánto llueve"; el `mean` de precipitación es mm por lectura de 10 min,
  que no sirve como magnitud).
- `stationCount`: número de estaciones distintas con datos.

Por lo tanto **no hace falta tocar la base de datos ni desplegar el backend**.

## Catálogo de vistas

| id      | Vista (rótulo público)            | Familia    | datasetId   | Variable IDEAM            | Métrica        | Unidad   | Dirección | Nota          |
|---------|-----------------------------------|------------|-------------|---------------------------|----------------|----------|-----------|---------------|
| lluvia  | Dónde llueve más                  | Clima      | s54a-sgyg   | Precipitación             | `monthlyDepth` | mm/mes   | alto=más  |               |
| calor   | Dónde hace más calor              | Clima      | ccvq-rp9s   | Temp. máxima del aire     | `mean`         | °C       | alto=más  |               |
| frio    | Dónde hace más frío               | Clima      | afdg-3zpb   | Temp. mínima del aire     | `mean`         | °C       | bajo=más  |               |
| humedad | Qué tan húmedo es el aire         | Clima      | uext-mhny   | Humedad del aire          | `mean`         | %        | alto=más  |               |
| viento  | Qué tan fuerte sopla el viento    | Clima      | sgfv-3yp8   | Velocidad del viento      | `mean`         | m/s      | alto=más  |               |
| cobertura | Dónde hay más estaciones        | Cobertura  | s54a-sgyg   | (red de monitoreo)        | `stationCount` | estaciones | alto=más | mide red, no clima |
| rios    | Nivel de los ríos                 | Agua       | bdmn-sqnh   | Nivel instantáneo del río | `mean`         | m        | alto=más  | "datos en revisión" |
| mar     | Nivel del mar                     | Agua       | ia8x-22em   | Nivel del mar             | `mean`         | m        | alto=más  |               |

- **Dirección:** "Dónde hace más frío" resalta los valores bajos, así que su degradado
  va invertido (más frío = color más intenso).
- **"datos en revisión":** la vista de ríos lleva una etiqueta visible advirtiendo de
  la mezcla de unidades detectada en las auditorías de datos, para ser honestos con el
  visitante. No se oculta; se rotula.

## Comportamiento de la interfaz

### Control único

El botón "Coropleta" actual se reemplaza por un desplegable **"Colorear el mapa por…"**:

- Primera opción: **"Ninguno (solo estaciones)"** (valor por defecto).
- Resto de opciones agrupadas por familia (Clima / Cobertura / Agua) con `optgroup`.
- Al elegir una vista se activa la capa de relleno departamental con la variable y la
  métrica de esa vista.

### Leyenda

Caja flotante abajo a la izquierda (la actual, mejorada):

- Título: el rótulo de la vista (ej. "Dónde llueve más").
- Barra de degradado del color de la vista.
- Mínimo y máximo **con su unidad** (ej. "120 mm/mes" … "640 mm/mes"; "18 °C" … "34 °C").
- Casilla de **"sin datos"** (gris) cuando existan departamentos sin dato.
- En la vista de ríos, la etiqueta "datos en revisión".

### Manejo de "sin datos"

Un departamento sin dato para la variable de la vista se pinta en **gris neutro**, NO
en el color más bajo del degradado. Pintarlo como el valor mínimo sería engañoso (un
departamento sin estaciones de temperatura aparecería como "el más frío"). El relleno
distingue "sin dato" de "valor bajo" mediante una marca `hasData` en cada feature.

### Colores

Degradados secuenciales de un solo tono (buena práctica cartográfica y accesibilidad),
elegidos por significado:

- lluvia / humedad / mar / ríos: tonos de azul (agua).
- calor: degradado cálido (amarillo a rojo).
- frío: degradado frío (invertido).
- viento: degradado neutro/teal.
- cobertura: dorado de la marca (mide la red IDEAM, no el clima).

Los cortes del degradado se calculan a partir del mínimo y máximo observados (con la
misma lógica de tramos que hoy: 0, 25%, 60%, 100%). Antes de implementar se puede
mostrar una vista previa de los degradados para aprobarlos visualmente.

### Sincronización con el popup

Al elegir una vista de clima, la mini-serie histórica del popup de cada estación se
sincroniza a la misma variable de la vista (clic en una estación => su serie de lluvia
o temperatura). Para la vista "cobertura" (sin variable única) el popup conserva
precipitación como variable por defecto. No agrega controles nuevos.

## Arquitectura

### Archivos

- **Nuevo `src/app/lib/vistasMapa.ts`:** define el catálogo de vistas como datos
  (id, rótulo, familia, datasetId, métrica, unidad, degradado, dirección, badge). Esto
  evita inflar `MapaEstaciones.tsx` y deja las vistas testeables. Incluye un helper para
  obtener la lista agrupada por familia.
- **`src/app/lib/units.ts`:** se extiende para que la unidad de la vista de lluvia sea
  "mm/mes" (la métrica `monthlyDepth`), distinta del "mm" por lectura de la variable.
- **Nuevo `src/app/lib/coroplethData.ts` (o función en `vistasMapa.ts`):** función pura
  que toma la respuesta `by-region` + los límites departamentales y produce el
  FeatureCollection con el valor por DANE y la marca `hasData`. Testeable.
- **`src/app/components/MapaEstaciones.tsx`:** consume lo anterior; cambia el control,
  el estado y la capa de relleno.

### Agregación por departamento (correctitud)

`by-region` agrupa por `departamento` crudo, así que un mismo departamento canónico
puede llegar en varias filas (variantes de nombre y mojibake). Hoy el frontend **suma**
`rowCount` por DANE, lo cual es correcto para conteos pero **incorrecto para promedios**.

Regla de combinación por DANE canónico:

- `rowCount`, `stationCount`: suma (como hoy).
- `mean`, `monthlyDepth`: **promedio ponderado** por `rowCount` como proxy del tamaño de
  muestra: `Σ(valor_i · rowCount_i) / Σ(rowCount_i)`, ignorando variantes con valor nulo.

Es una aproximación (lo exacto requeriría que la API exponga `valor_sum`/`n_validos` o
que agrupe por departamento canónico, lo cual sería un cambio de backend que aquí se
evita por mantenerlo frontend puro y sin riesgo en producción). En la práctica casi
todo el dato de un departamento cae en una variante dominante, así que el error es
mínimo. La función de combinación vive aislada y con test.

### Estado y URL

- Nuevo estado `mapaVista: string | null` (id de vista o `null` = solo estaciones).
  Sustituye al booleano `choroplethOn` y al uso de `sparkDataset` para el relleno.
- Parámetro de URL `vista=<id>` reemplaza a `choro=1`. Compatibilidad hacia atrás: si
  llega un `choro=1` antiguo, se restaura como `vista=lluvia`.
- `sparkDataset` (variable del popup) se deriva de la vista de clima elegida; sigue
  existiendo para que el popup funcione.

### Cacheo

La respuesta de `by-region` se cachea por `datasetId` en un `ref` para no re-consultar
al alternar entre vistas ya vistas. Los límites departamentales ya se cachean.

## Tests

Siguiendo la convención del repo (se testean funciones puras, no la interacción de
MapLibre):

- Combinación por DANE: suma de conteos, promedio ponderado de magnitudes, manejo de
  nulos y de variantes múltiples.
- Catálogo de vistas: cada vista resuelve a un datasetId válido y a una unidad.
- Unidades: "mm/mes" para lluvia, unidad física para el resto, "estaciones" para
  cobertura.
- Construcción del FeatureCollection: marca `hasData` correcta para departamentos con y
  sin dato.

## Fuera de alcance (YAGNI)

- Cambios de backend (agrupación canónica en la API, nuevas métricas).
- Vistas para presión atmosférica (problema de valores por altitud en auditorías).
- Vistas de dirección del viento (variable circular, no apta para coropleta lineal).
- Animación temporal de la coropleta (por año/mes).
- Umbral mínimo de estaciones por departamento para "representatividad".

## Riesgos y notas

- **Calidad de datos:** la vista de ríos se rotula "en revisión" por la mezcla de
  unidades. Presión queda fuera por el mismo motivo. Precipitación usa `monthlyDepth`,
  que ya está capada por el techo de 2500 mm/mes (Fix #1), así que es segura.
- **Departamentos poco muestreados:** un departamento con una sola estación puede no
  ser representativo; se acepta como límite conocido (se documenta, no se corrige aquí).
- **Despliegue:** sale por PR a `sergiobc27/website` con auto-deploy; sin escritura en
  la base de datos de producción.
