# Diseño: explicaciones de cada gráfica + metodología trazable y verificable

Fecha: 2026-06-26
Repo: `ideam-webapp` (frontend, despliega el Worker `ideam`)
Estado: aprobado el esqueleto por el autor; pendiente revisión de este documento.

## 1. Problema y objetivo

Dos necesidades del autor (tesis de Ing. Civil, CUC):

1. **Cada gráfica que la app presenta debe explicarse a sí misma**: qué es, cómo se
   lee y para qué sirve, de forma que cualquier persona la entienda.
2. **Cada cálculo y cada fórmula debe ser trazable y verificable hasta su fuente
   exacta**. La profesora preguntó "¿de dónde sacaste estas fórmulas?". La respuesta
   no puede ser solo "RAS 0330 (2017)": tiene que poder abrirse la norma y confirmar
   "sí, esta fórmula/tabla está en el Artículo X / Tabla Y / sección Z, es real, no
   está inventada".

Hoy la matemática ya es correcta y defendible (verificada analíticamente: Kirpich,
Témez, Giandotti, racional Q = C·I·A/360, Cf de Chow, Manning, Gumbel/GEV/LP3 + KS).
Lo que falta no es matemática: es **presentación explicativa por capas** y
**trazabilidad exacta y visible**.

## 2. Principios de diseño

1. **Una sola fuente de verdad.** El contenido (explicaciones, fórmulas, tablas de
   norma, citas con localizador) vive en un registro central; tanto el popup in situ
   como la página de Metodología leen de ahí. Nunca se duplica ni se desincroniza.
2. **Por capas.** Capa 1: una frase de resumen, siempre visible. Capa 2: popup con
   qué es / cómo se lee / para qué sirve + la fórmula + la fuente con localizador.
   Capa 3: página de Metodología con la derivación completa, las tablas de norma y
   las referencias. Sirve al público (capa 1) y a la sustentación (capa 3).
3. **Trazabilidad exacta y verificable.** Toda fórmula, tabla y constante apunta al
   **localizador concreto** dentro de su fuente: Artículo/Tabla de una resolución,
   sección/tabla de un manual, ecuación/página de un libro. El usuario debe poder ir
   a la fuente y encontrarlo.
4. **Honestidad sobre la cita (regla dura).** Si un localizador exacto no se puede
   verificar contra la fuente primaria, se marca explícitamente como "referencia
   general (localizador por confirmar)" en vez de inventar un número de artículo o
   tabla. Una cita falsa es peor que una cita general honesta.
5. **No se toca la matemática.** Este trabajo es presentación + trazabilidad. Si la
   verificación destapa un error de cálculo, se corrige en un cambio aparte y se
   reporta antes de tocar nada.
6. **Reusar lo que ya existe.** `referencias.ts` (`REFERENCIAS`, APA verificada) y
   `normas.ts` (`CITAS`) ya tienen las fuentes; el registro nuevo las referencia por
   `id`/clave y solo añade el localizador. No se crea una tercera lista de fuentes
   sueltas; se consolida sobre `REFERENCIAS`.

## 3. Arquitectura

### 3.1 Registro de contenido (`src/app/lib/metodologia/`)

Modelo de datos (TypeScript), separado de toda presentación:

```ts
// Localizador exacto dentro de una fuente ya catalogada en REFERENCIAS.
interface Fuente {
  ref: string;            // id en REFERENCIAS (p. ej. 'ras-0330', 'invias-drenaje-2009', 'chow-1959')
  localizador: string;    // EXACTO: "Art. 135, Tabla D.4.x" / "Cap. 2.x, Tabla 2.x" / "Ec. 15.1.4, p. 496"
  verificado: boolean;    // true solo si se confirmó contra la fuente primaria
  nota?: string;          // p. ej. "valor adaptado al rango colombiano"
}

interface TablaNorma {
  titulo: string;
  fuente: Fuente;         // de dónde sale ESTA tabla, con localizador
  columnas: string[];
  filas: (string | number)[][];
}

interface Variable { simbolo: string; significado: string; unidad: string; }

interface EntradaMetodo {
  id: string;             // 'idf', 'periodos-retorno', 'racional', 'tc-kirpich', 'manning', ...
  titulo: string;
  resumen: string;        // capa 1: una frase
  queEs: string;          // capa 2
  comoSeLee: string;      // capa 2 (ejes, colores, leyenda) — para gráficas
  paraQueSirve: string;   // capa 2
  formula?: ReactNode;    // render con el componente Formula existente
  variables?: Variable[];
  derivacion?: string;    // capa 3: de dónde sale / cómo se obtiene
  tablas?: TablaNorma[];  // tablas de norma asociadas
  fuentes: Fuente[];      // citas con localizador exacto
}
```

Un único objeto `METODOLOGIA: Record<string, EntradaMetodo>`.

### 3.2 Componentes de UI

- **`<InfoGrafica id />`**: botón circular "i" que se inserta en el cluster derecho
  del encabezado de cada gráfica (junto al botón de descargar PNG que ya existe).
  Abre un popover/diálogo que muestra resumen + queEs + comoSeLee + paraQueSirve +
  fórmula + fuentes (con su localizador) y un enlace "Ver metodología completa →"
  que hace deep-link a `/metodologia#<id>`. Usa el `Dialog`/`Popover` de `ui/` que ya
  existe (accesible, funciona en móvil).
- **`<TituloGrafica titulo subtitulo infoId derecha />`**: encabezado compartido que
  reemplaza el header copiado a mano ~15 veces (`<h3>` + `<p>` + cluster derecho).
  Centraliza el botón (i) y deja todas las gráficas consistentes. (Ver opción A en §6.)
- **`<CitaFuente fuente />`**: muestra "RAS 0330 (2017), Art. X, Tabla Y" como texto
  citable; tooltip con la APA completa de `REFERENCIAS`; si `verificado === false`,
  añade el matiz honesto ("referencia general; localizador por confirmar").
- **`<TablaNormaView tabla />`**: renderiza una `TablaNorma` con su `<CitaFuente>` al
  pie. Reusable en la calculadora y en Metodología.

### 3.3 Página de Metodología (`/metodologia`)

- Vista nueva, lazy-loaded como las demás (`lazyWithRetry`), registrada en
  `lib/navigation` (`viewToPath`/`pathToView`) y en `MENU_SECTIONS` del `Sidebar`
  (sección "Sistema", junto a Documentación) y en los breadcrumbs de `App.tsx`.
- Renderiza desde `METODOLOGIA`: índice navegable + una sección anclada por `id`
  (`#idf`, `#racional`, ...) para el deep-link desde los popups.
- Cada sección: qué es / cómo se lee / para qué sirve / fórmula con sus variables /
  derivación (de dónde sale) / tablas de norma (`<TablaNormaView>`) / referencias con
  localizador (`<CitaFuente>`).
- Encabezado con el alcance y los límites (producto hidrológico; el dimensionamiento
  estructural se rige por NSR-10 / AASHTO / INVÍAS y queda fuera).
- Es el anexo imprimible de la tesis (sirve para citar y para el documento escrito).
- Se enlaza también desde Documentación y desde la sección "6 · Método y referencias"
  de la calculadora.

### 3.4 Calculadora: "el cálculo paso a paso" + tablas in situ

- Bloque desplegable nuevo en `CalculadoraCaudal.tsx`: **"Ver el cálculo paso a paso"**.
  Toma los valores reales que el usuario tiene en el momento y muestra la aritmética
  sustituida, paso a paso, cada uno con su `<CitaFuente>`:
  - Tc por los tres métodos con números sustituidos → mediana → piso de 10 min.
  - Cf(Tr) → C·Cf.
  - I = K·Tᵐ/Dⁿ con números.
  - **Q = C·I·A/360** con números → resultado.
  Es dinámico (se recalcula con cada cambio de entrada): responde directamente a
  "muéstrame de dónde sale ese número".
- Las tablas de norma (C, Tr, n de Manning, Cf) se muestran con `<TablaNormaView>`
  dentro de sus secciones (3 · Coeficiente C, 5 · Manning) y/o se enlazan a
  Metodología. La sección "6 · Método y referencias" pasa a citar con localizador.

## 4. Inventario de contenido (entradas del registro)

**Gráficas (tratamiento completo, botón i + sección en Metodología):**
IDF, períodos de retorno (Gumbel/GEV/LP3 + AIC + KS), SPI, hietograma mensual,
histograma de acumulados diarios, climatología mensual, anomalías mensuales, serie
temporal, mapa de calor climático, top departamentos, comparador (series + IDF),
coropleta del mapa.

**Métodos de la calculadora (sección en Metodología + cita in situ):**
Tc Kirpich, Tc Témez, Tc Giandotti, regla de la mediana + piso 10 min, coeficiente C,
factor de frecuencia Cf, método racional, Manning + chequeos (llenado, velocidades),
y el procedimiento de ajuste de la IDF (cómo se obtienen K, m, n).

## 5. Trazabilidad: tabla de procedencia a verificar

Localizadores **objetivo**, a confirmar contra la fuente primaria antes de mostrarlos
(`verificado: true` solo tras confirmar). Lo que no se confirme se marca como general.

| Elemento | Fuente (`REFERENCIAS` id) | Localizador objetivo | Estado |
|---|---|---|---|
| Método racional Q = C·I·A/360 | `invias-drenaje-2009` / `ras-0330` | Cap. Hidrología, método racional | por verificar |
| Tabla de coeficiente C | `invias-drenaje-2009` (y/o `ras-0330`) | tabla de coef. de escorrentía | por verificar |
| Factor de frecuencia Cf(Tr) | Chow, Maidment & Mays (1988) | tabla del factor de frecuencia | por verificar (añadir ref si falta) |
| Tr por tipo de obra | `invias-drenaje-2009` / `ras-0330` | tabla de períodos de retorno de diseño | por verificar |
| Tc Kirpich | `kirpich-1940` | p. 362 (artículo original) | confianza alta |
| Tc Témez | `temez-1978` | documento MOPU | confianza media |
| Tc Giandotti | `giandotti-1934` | artículo original | confianza media |
| Manning Q = (1/n)·A·R^(2/3)·S^(1/2) | `manning-1891` / `chow-1959` | Chow (1959), cap. 5 | por verificar |
| Tabla de n de Manning | `chow-1959` | Tabla de n (cap. 5) | por verificar |
| Velocidades mín/máx | `ras-0330` | artículo de velocidades de diseño | por verificar |
| Piso de Tc 10 min | `ras-0330` | artículo de tiempo de concentración | por verificar |
| Validez racional (A < 80 ha urbano / ≤ 2,5 km²) | `ras-0330` / `invias-drenaje-2009` | artículos de aplicabilidad | por verificar |
| Gumbel por L-momentos | `gumbel-1958` / `hosking-wallis-1997` | — | confianza alta |
| GEV / Log-Pearson III / AIC | `coles-2001` / textbook | — | confianza media |
| Bondad de ajuste KS | `invias-drenaje-2009` (exigencia) + `stephens-1974` | artículo de pruebas de bondad | por verificar |
| SPI | `mckee-1993` + guía OMM `wmo-168-2008` | — | confianza alta |
| Ajuste IDF (K, m, n) | procedimiento propio + `vargas-diazgranados-1998` | describir fiel al ingestor | por verificar contra código |

La forma de la IDF y el ajuste se documentan describiendo el procedimiento real del
ingestor (`ideam-data-automator`): máximos anuales sub-horarios (datos de 10 min) →
ajuste de extremos por duración → intensidades por Tr y duración → regresión log-log
para K, m, n con su R². Se confirma leyendo el código antes de redactarlo.

### 5.1 Estado de verificación (2026-06-26)

**Fuentes oficiales descargadas y guardadas** en `Github/fuentes-normativas/` (fuera
de cualquier repo git; con `README.md` índice). Ver ese README para el detalle.

- `RAS-0330-2017_Resolucion_MinVivienda.pdf` (oficial MinVivienda, escaneado) +
  `RAS-0330-2017_texto-buscable.pdf` (texto seleccionable, aportado por el autor →
  permitió verificar los artículos del RAS, ver tabla abajo).
- `Manual-de-Drenaje-para-Carreteras-INVIAS-2009.pdf` (oficial INVÍAS, con texto).
- `McKee-etal-1993_SPI_drought-time-scales.pdf` (SPI) y
  `Velez-Botero-2011_tiempo-concentracion_Dyna.pdf` (Tc urbano).

**Localizadores VERIFICADOS contra el Manual INVÍAS 2009** (leyendo la tabla/sección
real, no el índice):

| Elemento | Localizador | `verificado` |
|---|---|---|
| Coeficiente de escorrentía, áreas urbanas | Tabla 2.9 (pág. 2-39) | true |
| Coeficiente de escorrentía, áreas rurales | Tabla 2.10 (pág. 2-40) | true |
| Períodos de retorno de diseño en obras de drenaje vial | Tabla 2.8 (pág. 2-31) | true |
| Método racional (definición de C y caudal) | Sección 2.5.5.2 (pág. 2-36, ec. 2.46+) | true |
| Aplicabilidad del racional por área (límite 1,3–2,5 km²) | Sección 2.5.5.1 (pág. 2-35/36) | true |
| Bondad de ajuste (Chi² y Smirnov-Kolmogorov) | Sección 2.3.4.4 (pág. 2-17) | true |
| Tc: recomienda Kirpich; mínimo de diseño 15 min | pág. 2-8 (Ref. 2.6) | true |

**Localizadores VERIFICADOS contra el RAS 0330 de 2017** (versión con texto):

| Elemento | Localizador | `verificado` |
|---|---|---|
| Método racional / caudal de aguas lluvias (válido si A < 80 ha) | Art. 135 | true |
| Período de retorno de diseño urbano (por área) | Art. 135, num. 1, Tabla 16 | true |
| Intensidad / curvas IDF (definición en Art. 256) | Art. 135, num. 2 | true |
| Tiempo de concentración: mínimo entre 3 y 10 min | Art. 135, num. 4 | true |
| Velocidad mínima pluvial (esfuerzo cortante ≥ 2,0 Pa) | Art. 149 | true |
| Velocidad máxima pluvial (5,0 m/s) | Art. 150 | true |
| Relación máxima profundidad/diámetro (93%) | Art. 151 | true |

Lección de método (importante): el índice de tablas extraído venía revuelto por las
columnas y daba números equivocados (sugería 2.13/2.14/2.15). Al leer las páginas
reales, esas son humedad antecedente AMC y números de curva CN. Por eso **cada
localizador se confirma sobre la página real, nunca sobre el índice.**

**Hallazgos de verificación y DECISIONES de reconciliación (2026-06-26, aprobadas por
el autor)** — cambian la lógica de la calculadora, no solo la documentación:

1. **Tr vial → DECIDIDO: alinear a la Tabla 2.8 (INVÍAS).** `OBRAS_TR` adopta las
   categorías y valores literales de la Tabla 2.8 (cunetas 5; zanjas de coronación 10;
   estructuras de caída 10; alcantarillas ≤0,90 m 10 y >0,90 m 20; puentes <10 m 25,
   10–50 m 50, ≥50 m 100; drenaje subsuperficial 2). El Tr sigue siendo sobrescribible.
2. **Tr urbano → DECIDIDO: usar la Tabla 16 del RAS (Art. 135).** Reemplazar
   "riesgo bajo/medio/alto" por las categorías reales por área tributaria/tipo de tramo
   (resid. <2 ha: 3; comercial/industrial <2 ha: 5; alcantarillado 2–10 ha: 5; >10 ha:
   10; canales <1000 ha: 50; canales >1000 ha: 100).
3. **Llenado y/D → DECIDIDO: límite 0,93 (RAS Art. 151, pluvial).** `chequeoLlenado`
   marca rojo a 0,93 (no 0,85), citando RAS Art. 151; se elimina la inconsistencia con
   F_MAX = 0,93 del solver. (Se puede dejar amarillo de aviso antes del 93%.)
4. **Velocidad mínima → DECIDIDO: implementar esfuerzo cortante.** Sustituir el chequeo
   de `V_MIN_AUTOLIMPIEZA = 0,75 m/s` por el criterio del RAS Art. 149: esfuerzo cortante
   de pared τ = γ·R·S ≥ **2,0 Pa** (γ = 9.810 N/m³; R = radio hidráulico a Q de diseño;
   S = pendiente). La velocidad máxima sigue por velocidad (RAS Art. 150: 5,0 m/s).
5. **OK (sin cambio):** velocidad máxima 5,0 m/s = RAS Art. 150; piso de Tc 10 min =
   extremo del rango 3–10 min del RAS Art. 135 num. 4; tabla de C = INVÍAS Tabla 2.9/2.10
   (se mostrará completa, mapeando las categorías simplificadas de `TIPOS_SUPERFICIE`).

**Pendientes de obtención** (no bloquean; ver README de `fuentes-normativas/`):

- **Textos de Ven Te Chow** (Cf en Applied Hydrology 1988; n de Manning en Open-Channel
  Hydraulics 1959): con derechos de autor; no se piratean. Se verifica el número de
  tabla/ecuación por vía legítima y, si el autor tiene acceso por la biblioteca CUC, ahí.
- Acceso abierto por descargar si se quiere completar: guías OMM 168/8, Vargas &
  Díaz-Granados (1998), Manning (1891, dominio público).

## 6. Decisión de implementación: inyección del botón (i)

- **(A, elegida) Encabezado compartido `<TituloGrafica>`.** Se extrae el header
  duplicado ~15 veces y se migran las gráficas a él; el botón (i) queda consistente.
  Mejora honesta del código que se está tocando, riesgo moderado.
- (B) Cirugía mínima sin extraer header. Menos cambios, markup repetido. Descartada.
- (C) `ChartCard` completo. Demasiada superficie tocada. Descartada.

## 7. Alcance fino por componente

- **Completo** (botón i + Metodología): Hidrología (IDF, retorno, SPI, hietograma,
  histograma), Analítica (serie, heatmap, climatología, top deptos, anomalías),
  Comparador (series, IDF), Ficha (climatología, anual), Mapa (coropleta), Calculadora.
- **Ligero / nada**: celdas del Dashboard y "La historia del dato" ya son explicativas
  por diseño (números rotulados / narrativa guiada). No llevan botón (i); a lo sumo un
  enlace a Metodología. Las tablas de datos (no gráficas) no llevan botón (i).

## 8. Verificación de correctitud (workstream propio)

1. Confirmar el ajuste IDF leyendo el ingestor; documentarlo fiel.
2. Contrastar los rangos de la tabla de C contra la fuente citable.
3. Comprobaciones numéricas puntuales (Tc, Cf, Q, Manning) con un caso conocido.
4. Fijar los localizadores exactos contra las fuentes primarias (RAS 0330, Manual
   INVÍAS, Chow). Lo no confirmado queda como cita general honesta.
Hallazgos (si los hay) se reportan antes de cambiar nada.

## 9. No-objetivos (YAGNI)

- No reescribir ni "mejorar" la matemática existente.
- No botón (i) en celdas del Dashboard ni en la Historia.
- No internacionalización (la app es en español).
- No un editor de contenido; el registro se versiona en git.

## 10. Pruebas

- El registro: todo `id` usado por un `<InfoGrafica>` existe en `METODOLOGIA`; toda
  `Fuente.ref` existe en `REFERENCIAS`; toda entrada con `formula` tiene ≥1 fuente.
- (Opcional) test que falle si una `Fuente` tiene `verificado: false` sin `nota`.
- Render básico de `/metodologia`, `<InfoGrafica>`, `<TablaNormaView>`.
- `typecheck` + `build` + suite existente (no romper las ~110 pruebas).

## 11. Preguntas abiertas / dependencias

- ¿El autor tiene los PDF primarios (RAS 0330 de 2017, Manual de Drenaje INVÍAS 2009,
  Chow et al.) para fijar artículos/tablas exactos con máxima autoridad? Si no, se hace
  investigación web + verificación, y lo no confirmado queda como cita general honesta.
- Ubicación exacta de la entrada "Metodología" en el Sidebar (propuesta: "Sistema").
