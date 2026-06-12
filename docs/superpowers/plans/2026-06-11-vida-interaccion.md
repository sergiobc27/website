# Tanda "vida e interacción" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Micro-animaciones hover en iconos, menú de vistas en el crumb del navbar, y Liquid Glass por plataforma (ios/android/desktop) en el chrome.

**Architecture:** CSS puro para anims y glass (theme.css), detección de plataforma como lib pura con test, navbar pasa a overlay absoluto para que el contenido scrollee bajo el vidrio.

**Tech Stack:** CSS keyframes + backdrop-filter + color-mix, shadcn DropdownMenu existente, vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-vida-interaccion-design.md` (detalle completo de valores).

### Task 1: `lib/plataforma.ts` + test (TDD)
- [ ] Test `plataforma.test.ts`: iPhone UA→ios, iPad camuflado (Macintosh + maxTouchPoints 5)→ios, Android→android, Windows→desktop.
- [ ] Implementar `detectarPlataforma(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0)`.
- [ ] Vitest verde. Commit.

### Task 2: theme.css — keyframes de iconos + clases glass
- [ ] Añadir `icono-wiggle`/`icono-bounce`/`icono-float` + `.group:hover .anim-*` + `.anim-float`.
- [ ] Añadir `.glass-chrome` (fallback sólido + @supports con variantes por `[data-plataforma]`) y `.glass-rojo` según la spec. Commit.

### Task 3: App — dataset de plataforma + layout overlay + props
- [ ] `useEffect` al montar: `document.documentElement.dataset.plataforma = detectarPlataforma()`.
- [ ] Columna de contenido `relative`; `<Navbar>` recibe `currentView`; `<main>` con `pt-20` (navbar pasa a absolute en Task 4). SheetContent del drawer: `bg-[#A3161A]`→`glass-rojo` (mantener borde).
- [ ] HistoriaIdf: progreso `sticky top-0`→`top-16`; gráfica móvil `top-2`→`top-[4.5rem]`. Commit.

### Task 4: Navbar — overlay glass + menú de vistas + anims
- [ ] Contenedor: `absolute inset-x-0 top-0 z-30 glass-chrome border-b border-border` (quitar bg-card).
- [ ] Exportar `MENU_SECTIONS` desde Sidebar; en Navbar: último crumb → DropdownMenu trigger (label + ChevronDown con `data-[state=open]:rotate-180`), content con secciones + check en `currentView`.
- [ ] Botones de la derecha: añadir `group` + `anim-wiggle` en el icono. Typecheck. Commit.

### Task 5: Iconos vivos en sidebar/bento/historia
- [ ] Sidebar item: `group` en el botón + `anim-wiggle` en `<Icon>`.
- [ ] CeldaAcceso: `anim-bounce` en el icono; celda Mapa: `anim-bounce` en MapPin.
- [ ] GraficaViva escena 1: `anim-float` en Droplets. Commit.

### Task 6: Verificación + deploy
- [ ] check + typecheck + npm test + chat-data + test:unit + build → verde.
- [ ] push a main → CI verde → smoke prod (200 + navbar overlay sin romper vistas). Memoria.
