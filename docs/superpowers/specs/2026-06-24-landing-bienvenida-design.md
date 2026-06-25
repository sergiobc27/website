# Landing de bienvenida del proyecto (puerta de entrada en `/`)

- **Fecha:** 2026-06-24
- **Componentes nuevos:** `src/app/components/landing/*`
- **Componentes tocados:** `src/app/App.tsx`, `src/app/lib/navigation.ts`, `src/app/components/Sidebar.tsx`
- **Estado:** diseño aprobado por el autor, pendiente de plan de implementación
- **Alcance:** frontend puro (sin cambios de base de datos, worker, API ni deploy del backend)

## Problema

Al entrar a `ideam.sergiobc.com` aparece de inmediato el panel completo con todas las
herramientas desarrolladas (dashboard, mapa, analítica, extractor, etc.). Para un
visitante nuevo, un tutor o un jurado eso es abrumador y no explica qué es el proyecto,
para qué sirve ni por qué importa. No hay una "portada" que dé contexto antes de soltar
al usuario en la herramienta.

## Objetivo

Crear una landing de bienvenida que viva en la raíz `/` y sea lo primero que se ve:
explica el proyecto de forma breve y atractiva (qué es, para qué, qué hace), con imagen
institucional CUC, animaciones, una pieza 3D protagonista y un cierre lúdico. Desde ahí,
un botón claro lleva a la plataforma. El panel actual se conserva intacto, solo cambia
de ruta.

## Decisiones tomadas (lluvia de ideas)

1. **Puerta de entrada:** la landing es el nuevo inicio en `/`. El panel se mueve a `/app`.
   Un botón "Entrar a la plataforma" lleva al panel. La landing se ve siempre (sin
   recordar/saltar).
2. **Dirección visual:** híbrido por secciones. Arranca sobrio e institucional arriba
   (credibilidad para tutor y jurados) y se vuelve más colorido, ilustrado y animado
   hacia abajo, cerrando con el momento de celebración.
3. **3D:** gota de agua 3D real con Three.js (react-three-fiber), generada por código
   (sin archivo de modelo externo), brillante, con refracción, que gira sola y reacciona
   suave al mouse. Imagen estática de respaldo para equipos sin WebGL o con "reducir
   movimiento".
4. **Celebración:** botón dedicado al final, repetible. Efecto combinado: fuegos
   artificiales que explotan y al caer se vuelven confeti, en colores CUC.
5. **Ilustración:** formas SVG orgánicas + color + motion, reusando iconos `lucide-react`,
   MÁS una mascota gota simpática (personaje SVG hecho por código) en el hero y el cierre.
6. **Créditos:** solo el nombre del autor (Sergio Beltran Coley) como único creador, junto
   a la marca CUC e IDEAM como fuente de datos. Sin tutor ni cotutor.
7. **Volver al inicio:** dentro del panel, el logo CUC del sidebar lleva a la landing (`/`);
   el breadcrumb "Inicio" sigue al panel (`/app`).

## Marca (ya existente, se reutiliza)

- Logos en `src/imports/`: `Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png`,
  `u.png` (CUC compacto), `Ideam_(Colombia)_logo.png`.
- Color: rojo CUC `#A3161A`, oro `#C9A227` (oro accesible `#7A5E0A` para texto sobre
  blanco), verde `#078930`, amarillo `#FCD116`. Tokens ya en `theme.css`.
- Tipografía: Red Hat Display (display y cuerpo), JetBrains Mono (mono). Ya cargadas.
- Dark mode ya resuelto por `theme.css` (`.dark`).

## Arquitectura de enrutado

`src/app/lib/navigation.ts`:

- Añadir `'landing'` a `VIEWS`.
- `viewToPath`: `landing` -> `/`; `dashboard` -> `/app` (deja de ser la raíz); el resto
  igual.
- `pathToView`: raíz pelada (`/` o vacío) -> `landing`; `/app` -> `dashboard`; segmento
  desconocido -> `landing` (antes caía a `dashboard`).
- Mantener compatibilidad: los deep-links a vistas concretas (`/map`, `/hydro`,
  `/ficha?...`, etc.) y el hash viejo de ficha siguen resolviendo a su vista, sin pasar
  por la landing.

`src/app/App.tsx`:

- Estado inicial de `currentView` arranca en `landing` cuando el pathname es `/`.
- `renderContent`: `case 'landing'` devuelve `<Landing onNavigate={navigate} />`.
- La landing es un **chunk lazy** (igual que `HistoriaIdf`) vía `lazyWithRetry`, para que
  Three.js NO entre en el bundle inicial del panel. El panel mantiene su peso actual.
- El botón "Entrar a la plataforma" llama `navigate('dashboard')` (que ahora apunta a
  `/app`).
- Cuando la vista activa es `landing`, App NO renderiza el chrome del panel (Sidebar,
  Navbar, BarraInferior, AsistenteFlotante, BuscadorUniversal). La landing es pantalla
  completa, sin sidebar. El layout actual (`flex h-screen` con sidebar) se condiciona:
  si `currentView === 'landing'`, se renderiza solo `<Landing/>` a pantalla completa.

`src/app/components/Sidebar.tsx`:

- El logo CUC del encabezado pasa a ser un botón/enlace que navega a `landing` (`/`).
  Hoy es una `<img>` sin acción. Se envuelve en un botón accesible (`aria-label="Ir al
  inicio"`).

## Estructura de componentes (nuevos)

Carpeta `src/app/components/landing/`, piezas pequeñas y testeables:

- `Landing.tsx`: orquesta las secciones y el layout a pantalla completa. Prop
  `onNavigate`.
- `HeroGota.tsx`: hero institucional (marca, kicker, título, subtítulo, dos CTAs) con la
  gota 3D y la mascota.
- `GotaTresD.tsx`: el canvas Three.js de la gota + lógica de respaldo (WebGL/reduced
  motion -> SVG estático). Se importa de forma diferida dentro de la landing.
- `MascotaGota.tsx`: personaje gota en SVG (cara amable, parpadeo y leve flotación).
  Sin dependencias. Respeta `prefers-reduced-motion`.
- `SeccionProblemaSolucion.tsx`: antes (manual, Python -> PowerBI) vs ahora (plataforma,
  segundos) + el dato del 98%.
- `SeccionQueHace.tsx`: tarjetas de las capacidades (datos limpios, curvas IDF, mapa y
  analítica, extractor local CLI/TUI, asistente IA), con iconos lucide y micro-animación.
- `SeccionCifras.tsx`: contadores animados (registros, municipios, curvas IDF publicables,
  costo $0). Animación de conteo respeta reduced motion.
- `SeccionCreditos.tsx`: marca CUC, IDEAM (fuente de datos), autor.
- `CierreConfeti.tsx`: sección nocturna lúdica con la mascota, el CTA "Entrar" repetido y
  el `BotonCelebracion`.
- `BotonCelebracion.tsx`: botón "¡Celebra los datos abiertos!" que dispara la animación.

## La gota 3D

- Dependencias nuevas (solo cargan dentro del chunk de la landing): `three`,
  `@react-three/fiber`, `@react-three/drei`.
- Geometría: esfera con material de transmisión (`MeshTransmissionMaterial` de drei) o
  equivalente para dar aspecto de agua/vidrio con refracción y brillo. Forma de gota
  (esfera ligeramente alargada/deformada).
- Movimiento: rotación lenta automática; al mover el mouse, la gota se inclina suave
  hacia el cursor (lerp, sin saltos).
- Respaldo (sin pantallas en blanco):
  - Si no hay soporte WebGL, o `prefers-reduced-motion: reduce`, o el equipo es de gama
    muy baja, se muestra una gota SVG estática (degradado azul con brillo), no el canvas.
  - El canvas se monta solo tras detectar soporte; el SVG es el contenido por defecto del
    servidor/primer render para que nunca haya hueco.

## La celebración (fuegos + confeti)

- Dependencia nueva: `canvas-confetti` (~6 kb), cargada de forma diferida al primer uso
  (import dinámico dentro del handler del botón, no en el bundle).
- Efecto: ráfagas tipo fuego artificial (varios orígenes que "suben" y estallan) y al caer
  se dispersan como confeti. Paleta CUC: `#A3161A`, `#C9A227`, `#078930`, `#FCD116`.
- Repetible: cada clic relanza el efecto. Sin estado persistente.
- Accesibilidad: con `prefers-reduced-motion: reduce` el botón hace un efecto mínimo
  (un destello suave o nada de partículas), nunca la lluvia completa. El botón sigue
  siendo funcional y visible.

## Contenido por sección (copy lo redacta el autor/Claude, sin rayas largas)

1. **Hero (sobrio):** kicker "Trabajo de grado · Ingeniería Civil", título
   "Automatización de datos hídricos del IDEAM", subtítulo de una línea sobre pasar de
   millones de registros crudos a datos limpios y una plataforma viva, en segundos. CTAs:
   "Entrar a la plataforma" (primario rojo) y "Conoce el proyecto" (baja con scroll).
   Gota 3D + mascota.
2. **Del problema a la solución:** dos tarjetas (antes manual / ahora automático) y el
   dato grande del 98% de ahorro de tiempo (cifra citable de la tesis).
3. **Qué hace la plataforma:** 5 capacidades en tarjetas con icono y una línea cada una.
4. **Cifras:** contadores (orden de magnitud de registros, 569 municipios, número de
   curvas IDF publicables, costo $0). Las cifras exactas se confirman contra los números
   reales del proyecto al implementar; nada inventado.
5. **Créditos:** CUC, IDEAM como fuente de datos, autor Sergio Beltran Coley.
6. **Cierre lúdico:** sección nocturna, mascota, enlace a `/historia` ("la historia
   completa del dato"), CTA "Entrar a la plataforma" y `BotonCelebracion`.

Enlace a `/historia` para no duplicar la narrativa editorial que ya existe.

## Accesibilidad y rendimiento

- Dark mode: todas las secciones usan los tokens de `theme.css`; la sección nocturna del
  cierre es oscura por diseño en ambos modos (escena física, como el libro `/historia`).
- `prefers-reduced-motion`: neutraliza rotación de la gota (usa el SVG estático),
  contadores (muestran el valor final directo), confeti (efecto mínimo) y micro-anims.
- WebGL ausente: gota SVG estática.
- Peso: Three.js y `canvas-confetti` NO entran al bundle del panel; viven en el chunk
  diferido de la landing y el confeti se importa al primer clic. El panel mantiene su
  tiempo de carga actual.
- Semántica: un solo `<h1>` (el título del hero), landmarks correctos, foco visible en
  CTAs, `aria-label` en el botón del logo y en el botón de celebración.

## Dependencias nuevas

- `three`, `@react-three/fiber`, `@react-three/drei` (gota 3D, solo en el chunk landing).
- `canvas-confetti` (celebración, import dinámico al usar).

## Lo que NO se toca

- Panel completo (dashboard y todas sus vistas), worker, asistente, API, base de datos.
- Deep-links, persistencia de estado en URL y compatibilidad de rutas existentes.
- Estilos globales más allá de añadir, si hace falta, animaciones nuevas scoped a la
  landing en `theme.css` (siguiendo el patrón scoped de `.historia-libro`).

## Pruebas

- `navigation.test.ts`: `pathToView('/')` -> `landing`; `pathToView('/app')` ->
  `dashboard`; `viewToPath('landing')` -> `/`; `viewToPath('dashboard')` -> `/app`; una
  ruta desconocida -> `landing`; las vistas existentes siguen mapeando igual.
- Test de la lógica del `BotonCelebracion` (que dispara el efecto y respeta reduced
  motion), aislando la dependencia de `canvas-confetti`.
- Verificación en vivo tras deploy (typecheck + build + tests + captura clara/oscura),
  siguiendo el flujo habitual del repo (PR a main, auto-deploy por CI).

## Riesgos y decisiones abiertas

- **Peso de Three.js:** mitigado por carga diferida; verificar que el chunk de la landing
  carga rápido y que el panel no engorda. Si el peso molesta, se puede degradar la gota a
  la versión SVG por defecto.
- **Cifras exactas:** se confirman contra los datos reales del proyecto al implementar.
- **Mascota gota:** diseño del personaje en SVG; iterar el carácter (cara, color) en la
  fase de implementación con vista previa.

## Criterios de aceptación

- Entrar a `/` muestra la landing a pantalla completa, sin el chrome del panel.
- "Entrar a la plataforma" lleva a `/app` con el panel intacto.
- El logo CUC del panel regresa a `/`.
- La gota 3D se ve y reacciona; en equipos sin WebGL o con reduced motion aparece la gota
  estática, sin huecos.
- El botón de celebración lanza fuegos + confeti en colores CUC, repetible, y se reduce
  con reduced motion.
- El bundle del panel no crece (Three.js y confeti quedan en el chunk de la landing).
- Funciona en claro y oscuro, escritorio y móvil.
