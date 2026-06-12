# Spec: Tanda "vida e interacción" (hover anims + navbar interactiva + Liquid Glass por plataforma)

**Fecha:** 2026-06-11 · **Estado:** aprobada por Sergio (menú de vistas en el crumb; glass en chrome móvil + navbar desktop sutil)

## 1. Micro-animaciones hover

Keyframes nuevas en `theme.css` (solo transform; el neutralizador global de reduced-motion las apaga):
`icono-wiggle` (rotate ±8°, 350ms), `icono-bounce` (translateY -3px, 400ms cubic-bezier(0.23,1,0.32,1)),
`icono-float` (±4px, 3s infinite — SOLO para la gota decorativa de la portada de Historia).
Clases `.anim-wiggle`/`.anim-bounce` se activan con `.group:hover`. Puntos de aplicación:
iconos de items del sidebar (wiggle), iconos de CeldaAcceso y MapPin de la celda mapa (bounce),
iconos de los botones del navbar (wiggle), Droplets de la escena 1 de GraficaViva (float).

## 2. Navbar interactiva

- El último crumb (vista actual) pasa de `<span>` a botón con `ChevronDown` que abre un
  `DropdownMenu` (mismo shadcn del perfil) con TODAS las vistas agrupadas como el sidebar
  (Explorar/Herramientas/Sistema), icono por vista y check en la actual. Click → `onNavigate(id)`
  (el id `asistente` ya lo intercepta App y abre el widget). El chevron rota 180° al abrir
  (`data-state` del trigger).
- `MENU_SECTIONS` se EXPORTA desde Sidebar.tsx (fuente única de vistas) y Navbar lo importa.
- Navbar recibe prop nueva `currentView` (desde App) para el check.

## 3. Plataforma + Liquid Glass

- `src/app/lib/plataforma.ts`: `detectarPlataforma(ua, maxTouchPoints): 'ios'|'android'|'desktop'`
  — iPhone/iPod → ios; iPad o (Macintosh + maxTouchPoints>1, el camuflaje de iPadOS) → ios;
  Android → android; resto desktop. Test vitest con UAs reales.
- App al montar: `document.documentElement.dataset.plataforma = detectarPlataforma()`.
- `theme.css`: `.glass-chrome` con fallback sólido (`background: var(--card)`) y dentro de
  `@supports (backdrop-filter)` el vidrio: blur(14px) saturate(150%) + fondo `color-mix`
  (card 70%) + brillo especular superior (`inset 0 1px 0 rgba(255,255,255,.08)`).
  Variantes: `[data-plataforma="ios"]` blur(24px) saturate(180%) card 55% + brillo .18
  (Liquid Glass pleno); `[data-plataforma="android"]` blur(14px) saturate(140%) card 78%
  (Material entintado). Desktop usa la base (sutil). `.glass-rojo` para el drawer móvil
  (#A3161A al 80% + blur 16px).
- **Para que el vidrio sea real, el contenido debe pasar POR DEBAJO**: la columna de contenido
  pasa a `relative`, el Navbar a `absolute inset-x-0 top-0 z-30 glass-chrome` y `<main>` gana
  `pt-20` (el contenido scrollea bajo la barra). Ajustes de sticky que referencian el scrollport:
  barra de progreso de HistoriaIdf `top-0`→`top-16` y la gráfica sticky móvil `top-2`→`top-[4.5rem]`
  (el `md:top-20` ya libra la barra).
- Aplicación: Navbar (`bg-card`→`glass-chrome`), drawer móvil (SheetContent `bg-[#A3161A]`→
  `glass-rojo`), panel del asistente flotante (`bg-card`→`glass-chrome`). El botón flotante
  conserva su gradiente de marca. Tarjetas y gráficas NO se tocan.

## Testing
Vitest: `plataforma.test.ts` (UAs iPhone/iPad-camuflado/Android/desktop) y export de
`MENU_SECTIONS` (12 vistas, ids válidos contra VIEWS + asistente). Suites completas + build.
Sin screenshots (Sergio prueba en vivo, incluido su celular).

## Fuera de alcance
Glass en tarjetas/contenido, dock central en navbar, animaciones infinitas fuera de la gota,
detección de tablet como categoría aparte.

---

## V2 (mismo día, feedback de Sergio con iPhone 16 Pro Max / iOS 26)

Decisión de Sergio: fuera el menú del crumb (el sidebar es LA navegación) + buscador
universal + experiencia móvil de verdad. Sin "diseño aparte": misma base responsive con
chrome móvil propio.

1. **Revertir el menú del crumb** (vuelve a texto con hover). El espacio lo ocupa el botón
   del buscador (lupa + kbd ⌘K).
2. **Buscador universal** (`BuscadorUniversal.tsx`, CommandDialog de cmdk ya instalado):
   atajo Ctrl/⌘K + botón navbar (evento `ideam:abrir-buscador`). Grupos: Vistas
   (MENU_SECTIONS), Acciones (preguntar al asistente, cambiar tema), Estaciones IDF
   (lazy-fetch de `/api/analytics/idf-stations` al abrir; busca nombre/municipio/código;
   al elegir → `history.pushState('/hydro?est=CODIGO')` + `PopStateEvent('popstate')` —
   Hidrología restaura la estación con su deep-link existente).
3. **Sidebar animado**: entrada con stagger (reusa `bento-enter`, delay 30ms/item),
   `hover:translate-x-0.5` acompañando el wiggle.
4. **Barra de pestañas inferior móvil** (`BarraInferior.tsx`, `lg:hidden`, glass-chrome,
   borde superior, `pb-[env(safe-area-inset-bottom)]`, `viewport-fit=cover` en index.html):
   5 destinos — Panel, Analítica, Hidrología, Mapa y "Más" (abre el drawer existente con
   todo). Activo en oro con `aria-current`; targets ≥44px. El hamburger del navbar se VA
   (lo reemplaza "Más"). `<main>` gana `pb-24 lg:pb-6`; el FAB del asistente sube en móvil
   (`bottom-[5.5rem] lg:bottom-5`) y su panel también.
5. **Glass robusto y visible**: fuera `color-mix` → tokens `--glass-bg`/`--glass-brillo`
   en rgba definidos en `:root`/`.dark` con overrides por `[data-plataforma]` (ios más
   transparente y brillante: 0.50 claro / 0.42 oscuro; android más opaco: 0.80/0.78).
   En móvil el vidrio se nota de verdad en la barra inferior (siempre hay contenido debajo).
