# Rediseño de "La historia del dato" como libro editorial — Diseño

**Fecha:** 2026-06-20
**Estado:** aprobado por el usuario (dirección y mockup), pendiente de revisión del spec
**Vista afectada:** `/historia` (componente `HistoriaIdf`)
**Mockup de referencia:** artefacto "Mockup libro — La historia del dato" (https://claude.ai/code/artifact/b236b89e-5deb-4728-8c21-b2cbac3a6be4)

---

## 1. Contexto y objetivo

"La historia del dato" es un scrollytelling de 8 escenas que explica, a público **no técnico** y a **jurados** de una tesis de Ing. Civil (CUC), cómo la lluvia que el IDEAM mide cada 10 minutos se convierte en curvas IDF reales. Hoy tiene el esqueleto correcto (gráfica sticky + 8 secciones + IntersectionObserver) pero el usuario reporta: *"está mal diseñada, no es tan didáctica, le hacen falta animaciones, la línea que muestra el progreso está mal"* y pide que **"se vea como una especie de libro"**.

Una auditoría multiagente read-only (verificada contra el código) confirmó las cuatro quejas y sus causas raíz (sección 3). El objetivo de este rediseño es convertir la vista en un **libro editorial digital** (long-read estilo Pudding/NYT con piel de marca CUC/IDEAM) que sea más didáctico, con motion con sentido y una barra de progreso correcta — **sin añadir librerías** (Tailwind v4 + `tw-animate-css` + CSS + recharts + el IntersectionObserver existente).

### Decisiones tomadas con el usuario
1. **Alcance:** Libro editorial + índice navegable + gráfica que ya no se remonta (continuidad). (Dirección "A + piezas de B"; se **descarta** el page-flip 3D y el `motion`/framer-motion.)
2. **Texto:** se **reescribe el copy de las escenas 5–8** con definiciones al vuelo de la jerga; se permite partir la escena 5 en sub-pasos.
3. **Móvil:** **apilado por escena** (cada capítulo muestra su lámina + su texto en secuencia; sin la gráfica sticky diminuta).
4. **Tipografía:** **serif del sistema** (sin CDNs por el CSP) solo en esta vista.
5. **Marca / papel:** estética "papel" sobria — crema en claro, pergamino oscuro en modo oscuro; rojo CUC + oro IDEAM en detalles (números clave, filetes, capitular), sin recargar.

### Fuera de alcance
- Page-flip 3D con librería (react-pageflip / StPageFlip / turn.js): sin mantenimiento desde 2020, sin accesibilidad, secuestra el scroll.
- `motion`/framer-motion/gsap: el stack actual basta.
- Soporte multi-estación (el dataset embebido sigue igual).
- El gesto de "pasar página" CSS 3D (dirección C) queda como **fase 2 opcional** posterior, no en este alcance.

---

## 2. Audiencia y principios

- **Didáctico primero:** una idea por paso; de lo concreto a lo abstracto; definir la jerga donde aparece.
- **Sobrio:** la metáfora de libro sirve a la jerarquía de información; no compite con los datos (coherente con la rúbrica de diseño del proyecto).
- **Accesible y robusto:** HTML semántico real, teclado, lector de pantalla, `prefers-reduced-motion`, y degradación con gracia en cualquier navegador (clave: lo evalúan jurados con equipos desconocidos).
- **Sin dependencias nuevas.**

---

## 3. Problemas que resuelve (hallazgos verificados)

| # | Problema (causa raíz, con evidencia) | Lo resuelve |
|---|---|---|
| P1 | **Barra de progreso a saltos.** `HistoriaIdf.tsx:106` usa `scaleX(escena/TOTAL_ESCENAS)` con `escena` entero 1–8 → 8 posiciones discretas, arranca en 12.5%, no mide scroll real, se atasca en bordes, flota con retraso por `transition` 300 ms. | §5.1 |
| P2 | **Motion inerte.** `GraficaViva.tsx:59` usa `key={escena}` → remonta el SVG entero cada escena (se siente como 8 gráficos sueltos); el texto no anima; sin foco progresivo ni anotaciones ancladas. | §5.2, §5.4 |
| P3 | **Poca didáctica.** Escenas 5–8 amontonan jerga sin definir (Gumbel, Tr, IC 90%, R², C, método racional, "desagrega") en párrafos densos; el hilo de "la gota" se rompe tras la escena 3. | §5.5 |
| P4 | **Diseño genérico.** Gráfica con la misma tarjeta que cualquier dashboard; sin portada/cierre con peso; capítulos sin numeración ni jerarquía; marca relegada. | §5.3 |
| P5 (alto) | **Móvil ilegible.** Gráfica sticky `h-[38vh]` (~253 px) comprime recharts; texto interminable debajo; `vh` provoca jank por la barra de URL. | §5.6 |
| P6 | **A11y:** barra sin `role=progressbar`; recharts anima por JS e ignora el bloque global `prefers-reduced-motion`. | §5.7 |

---

## 4. Arquitectura de componentes

Se conserva la lógica de datos y se moduliza la vista (hoy todo vive en un único `HistoriaIdf.tsx` que ha crecido). Cada unidad tiene un propósito claro y se puede probar/entender aislada.

```
app/components/HistoriaIdf.tsx        Orquestador: layout de libro, ensambla portada→índice→capítulos→epílogo,
                                      monta la cinta de progreso y el stepper. Sin lógica de cálculo.
app/components/historia/
  Portada.tsx                         Héroe de apertura (badge, kicker, título grande, gancho, ficha de estación, hint de scroll).
  IndiceHistoria.tsx                  Tabla de contenidos navegable (8 capítulos → scrollIntoView a cada sección).
  Capitulo.tsx                        Un capítulo: kicker "Capítulo {romano} · de VIII", título, cuerpo serif con
                                      drop-cap, callouts de definición, folio al pie, y su Lámina.
  Lamina.tsx                          Marco editorial de la gráfica (doble borde dorado, fondo cálido, figcaption).
                                      Monta su gráfica de forma perezosa al entrar en viewport (entrada animada + perf).
  GraficaViva.tsx                     (existente, refactor) la gráfica recharts por escena, ahora con foco progresivo
                                      y anotaciones; ya NO se controla con key={escena}.
  CintaProgreso.tsx                   Barra de lectura continua + indicador "Capítulo N · de VIII" (marcador).
  StepperCapitulos.tsx               Puntos clicables (índice lateral) en escritorio; oculto en móvil.
  contenido.ts                        El copy de los 8 capítulos (reescrito 5–8) + metadatos de capítulo (romano, título, ancla).
app/lib/historia.ts                   (existente, +helpers puros) escenaMasVisible, progresoLectura, aRomano, capituloActivo.
app/data/historiaIdf.ts               (sin cambios) dataset embebido de la estación.
src/styles/theme.css                  (+) tokens y keyframes scoped a `.historia-libro` (papel, serif, drop-cap, folios, cinta).
```

**Principio de aislamiento:** `lib/historia.ts` no toca el DOM (testeable puro). `Lamina`/`GraficaViva` no saben de scroll. `CintaProgreso`/`StepperCapitulos` no saben de contenido (reciben capítulos + estado). `Capitulo` no sabe qué gráfica le toca (recibe `escena`).

---

## 5. Diseño detallado

### 5.1 Cinta de progreso continua (P1)
- **Cálculo (puro, testeable):** nueva función `progresoLectura(scrollTop, rootTop, rootAlto, ventanaAlto)` en `lib/historia.ts` que devuelve un valor 0–1 = avance real a través del contenedor de la historia (clamp). El componente lo aplica como `width`/`scaleX` de la cinta.
- **Motor preferido (sin JS):** keyframe `scaleX(0→1)` con `animation-timeline: scroll()` sobre la cinta, bajo `@supports (animation-timeline: scroll())` y `@media (prefers-reduced-motion: no-preference)`. Corre off-main-thread.
- **Fallback (Firefox / sin soporte / reduced-motion):** el cálculo JS de `progresoLectura` con un listener de scroll **throttled con `requestAnimationFrame`** (`passive`).
- Se **elimina** la `transition-transform duration-300` (causa del retraso). Apilado sticky: `top-16` revisado para no solaparse con el Navbar.
- **Indicador de capítulo:** "Capítulo {romano} · de VIII" derivado del capítulo activo (vía IntersectionObserver, que se conserva **solo** para el capítulo activo / resaltado del stepper, **no** para la barra).

### 5.2 Continuidad de la gráfica (P2) — fin del remount
- Se **elimina `key={escena}`**. Nuevo modelo: **una lámina por capítulo** (no una sola gráfica que conmuta). Cada `Capitulo` renderiza su `Lamina` con su `escena` fija.
- `Lamina` **monta su gráfica de forma perezosa** la primera vez que entra al viewport (IntersectionObserver). Beneficios: (a) cada gráfica **anima su entrada una vez** (resuelve "faltan animaciones" sin el churn de 8 remounts); (b) no se montan 8 recharts de golpe (perf); (c) desaparece el coste de reconciliación del `key`.
- Recharts conserva `isAnimationActive` (gateado por reduced-motion, ver §5.7). Como cada gráfica es de un tipo distinto (barras/scatter/líneas/fórmula), **no** se intenta morphing entre tipos: cada lámina es su propia "plancha" del libro (más fiel a la metáfora).

### 5.3 Estética de libro (P4)
**Estructura y conteo (sin ambigüedad):** se mantienen **8 capítulos = las 8 escenas actuales** (I–VIII). El **Capítulo I se presenta como cubierta/portada** (no se duplica el gancho ni se añade una escena extra), y el **Capítulo VIII incorpora el epílogo** (resultado + CTAs como cierre). El **Índice** es una sección propia **no numerada** entre la cubierta y el Capítulo II.

- **Portada** (`Portada.tsx`): es el **Capítulo I tratado como cubierta** a altura completa — badge "Universidad de la Costa · IDEAM", kicker "El viaje de una gota de dato", título grande en serif, el gancho ("¿Qué tan fuerte puede llover aquí?"), ficha de la estación y hint de scroll. Reemplaza el encabezado minúsculo actual.
- **Índice** (`IndiceHistoria.tsx`): lista en romanos de los 8 capítulos, clicable (scrollIntoView a cada sección), con folio. Sección propia, no numerada.
- **Capítulos II–VIII**: kicker "Capítulo {romano} · de VIII" + filete dorado; título; **drop-cap** dorada en la primera letra del primer párrafo (`::first-letter` con `float`, soportado en todos los navegadores; **no** `initial-letter`); cuerpo serif, medida ~60–62ch, ritmo vertical generoso; **folio** al pie ("capítulo dos"); números clave en rojo/oro.
- **Epílogo**: es el cierre del **Capítulo VIII** — resultado (Q) y CTAs (Calcular IDF / Asistente) enmarcados como conclusión, no como botones sueltos (no es una 9ª sección).
- **Stepper lateral** (`StepperCapitulos.tsx`): puntos clicables a la derecha en escritorio; resalta el activo; tooltip con el título. Oculto en móvil.

### 5.4 Foco progresivo y anotaciones (P2/didáctica)
Por capítulo, dentro de `GraficaViva`:
- **Foco progresivo:** resaltar lo relevante y atenuar el resto (~30% opacidad) — barras del pico (esc.2), año/punto destacado (esc.4), curva Tr=25 (esc.6, ya tiene `strokeWidth` mayor) frente a las demás. Se logra con `opacity`/`fillOpacity` condicionados, sin remount.
- **Anotaciones ancladas** con componentes `Reference*`/`Label` de recharts que pertenecen a cada escena: "↑ pico: X mm/h" (esc.2), línea Tr=25 con "4% anual" (esc.5), etiqueta de la banda IC 90% como "incertidumbre por serie corta" (esc.5/6).
- **Regla de accesibilidad:** cualquier dato **nuevo** que aparezca solo en la gráfica (anotación) debe existir también en el copy del capítulo (la gráfica sigue `aria-hidden`).

### 5.5 Reescritura del copy 5–8 (P3)
- Reescribir escenas **5–8** con **definiciones al vuelo** mediante callouts `.defn` y prosa más concreta para: período de retorno (Tr) y la "trampa" del 4% anual, IC 90% (incertidumbre), Gumbel (valores extremos), IDF (Intensidad–Duración–Frecuencia), R² ("explica el 98% de los datos"), C de escorrentía (0,80), método racional (qué multiplica y por qué `/360`).
- **Partir la escena 5** ("Domar el azar") en 2–3 **sub-pasos de lectura sobre la MISMA lámina** de Gumbel (Gumbel → período de retorno → banda IC), **sin crear capítulos nuevos** (el conteo sigue en 8). Línea base: la lámina del Capítulo V muestra sus anotaciones; *opcional* (mejora, no requisito): resaltar la anotación correspondiente a medida que se leen los sub-pasos (detección sub-capítulo). Esto preserva el modelo "una lámina por capítulo" de §5.2.
- Reforzar el **hilo narrativo de "la gota"** en los capítulos IV–VII (conectar máximos anuales → Gumbel → curvas → diseño con la misma tormenta/estación como personaje).
- El copy vive en `historia/contenido.ts` (separado del layout) para revisarlo como texto.

### 5.6 Móvil — apilado por escena (P5)
- En móvil, cada capítulo se renderiza como **una página**: lámina (legible, ancho completo) **seguida de** su texto; sin la gráfica sticky de 38vh. En escritorio se mantiene el "spread" de dos columnas (texto + lámina).
- Migrar **todas las unidades `vh` → `svh`/`dvh`** (o `rem`) en zonas de altura/sticky y espaciadores (evita el jank de la barra de URL — advertencia explícita de Scrollama).
- Grids de datos (`grid-cols-3`) bajan a 2 columnas en pantallas angostas.
- Stepper oculto en móvil; basta la cinta + "N/VIII".

### 5.7 Accesibilidad (P6)
- Cinta con `role="progressbar"`, `aria-valuenow/min/max`, `aria-label`; región `sr-only` con `aria-live="polite"` que anuncia "Capítulo N de 8: {título}" al cambiar.
- Contenedor raíz como `<main>` (o `role="main"`) con `aria-label`; cada capítulo `<section aria-label="Capítulo N: {título}">`.
- `prefers-reduced-motion`: (a) las animaciones CSS ya se gatean; (b) el scroll de índice/stepper usa `behavior:'auto'` cuando reduced-motion; (c) **recharts**: `isAnimationActive={!reducedMotion}` vía un pequeño hook `usePrefersReducedMotion()` (lee `matchMedia`), porque recharts anima por JS y el bloque global de `theme.css` no lo desactiva.
- Índice y stepper son `<button>` reales (foco/teclado); `focus-visible` cuidado.
- La gráfica sigue `aria-hidden` con el copy como alternativa textual (patrón actual correcto).

---

## 6. Theming / tokens (scoped)

Todo bajo una clase raíz `.historia-libro` para **no** afectar el resto de la app:
- **Serif** del sistema: `"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif` para cuerpo y títulos de la historia.
- **Papel:** claro = crema cálida (degradado sutil); oscuro = pergamino oscuro equivalente (derivado de las variables de tema existentes).
- **Acentos:** oro `--accent` (#C9A227) y rojo CUC (#A3161A) en números clave, filetes, capitular, kickers.
- Keyframes/utilidades nuevas en `theme.css`: drop-cap (`::first-letter`), folios, callout `.defn`, lámina, cinta con `animation-timeline: scroll()`. Todas bajo `@media (prefers-reduced-motion: no-preference)` donde apliquen.

---

## 7. Plan de pruebas

- **Unitarias (`vitest`, `lib/historia.ts`):** conservar tests de `escenaMasVisible`; añadir `progresoLectura` (límites: antes/durante/después; clamp 0–1), `aRomano` (1→I … 8→VIII), `capituloActivo`. Mantener `validarHistoria`/`intensidadDeCurva`.
- **Tipos/build:** `npm run typecheck` + `vite build` limpios.
- **Verificación en vivo (norma del proyecto):** Chrome contra el dev/preview en **claro, oscuro y móvil**; comprobar: cinta continua de 0→100%, índice/stepper saltan al capítulo, drop-cap/serif/folios, foco progresivo y anotaciones por capítulo, móvil apilado legible, `prefers-reduced-motion` (animaciones y recharts quietos), teclado en índice/stepper. Capturas claro/oscuro.
- **Regresión:** no romper deep-link/estado de vista ni la navegación `onNavigate`.

---

## 8. Riesgos y mitigaciones

- **CSS scroll-driven animations** soporte ~85% (Firefox tras flag) → degradación con gracia + **fallback JS** para la cinta (garantía total). El estado final sin animación debe verse correcto.
- **Montaje perezoso de láminas:** asegurar que sin JS / sin IntersectionObserver el contenido siga visible (render del fallback) — importante para robustez ante jurados.
- **Reescritura de copy:** cambia el texto del usuario; se revisa el contenido con él antes de implementar (vive en `contenido.ts`).
- **Sobre-adorno:** mantener la rúbrica sobria; la marca en detalles, no en bloques pesados.
- **Apilado móvil:** validar que láminas recharts a ancho completo no desborden ni descuadren.

---

## 9. Criterios de aceptación
1. La cinta de progreso avanza **continua** con el scroll (0→100%), sin saltos ni retraso.
2. Cada capítulo **anima su entrada** una vez; ninguna gráfica se remonta por cambio de escena.
3. Escenas 5–8 **definen su jerga al vuelo**; un lector no técnico entiende Tr, IC, IDF, R², C y método racional.
4. La vista **luce a libro**: portada, índice, capítulos numerados, drop-cap, serif, folios, láminas enmarcadas, epílogo.
5. En **móvil** la gráfica es legible (apilado por escena), sin jank de `vh`.
6. **Accesible:** progressbar con ARIA + aria-live; `prefers-reduced-motion` detiene todo el motion (incl. recharts); índice/stepper por teclado.
7. **Cero dependencias nuevas**; `typecheck`+`build`+tests en verde; verificado en vivo claro/oscuro/móvil.
