# Landing de bienvenida (puerta de entrada en `/`) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una landing de bienvenida a pantalla completa en `/` que explique el proyecto (institucional arriba, lúdico abajo), con una gota de agua 3D y un botón de fuegos/confeti, y mover el panel actual a `/app`.

**Architecture:** Frontend puro sobre el SPA React + Vite existente. La landing es una vista nueva (`landing`) renderizada a pantalla completa sin el chrome del panel, cargada como chunk lazy para que Three.js y `canvas-confetti` no engorden el bundle del panel. La gota 3D solo descarga si hay WebGL y no se pidió reducir movimiento; si no, una gota SVG estática. El confeti se importa dinámicamente al primer clic.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind v4 (tokens en `theme.css`), lucide-react, `three` + `@react-three/fiber` + `@react-three/drei` (gota 3D), `canvas-confetti` (celebración), vitest (lógica pura).

**Convenciones del repo (obligatorias):**
- `main` va por PR + auto-deploy por CI. Trabajar en rama `feat/landing-bienvenida`.
- Sin firmas de Claude en commits (nada de `Co-Authored-By` ni `Generated with`).
- Sin rayas largas (—) en el texto que ve el usuario.
- Directorio de trabajo de todos los comandos: `ideam-webapp/`.
- vitest solo recoge `src/**/*.test.ts` (NO `.tsx`): los componentes React se verifican con `npm run typecheck` + `npm run build` + verificación en vivo; la lógica pura sí lleva test unitario TDD.

**Mapa de archivos:**
- Crear: `src/app/components/landing/Landing.tsx` (orquesta)
- Crear: `src/app/components/landing/HeroGota.tsx`
- Crear: `src/app/components/landing/GotaTresD.tsx` (canvas Three.js, default export)
- Crear: `src/app/components/landing/GotaEstatica.tsx` (respaldo SVG)
- Crear: `src/app/components/landing/MascotaGota.tsx` (personaje SVG)
- Crear: `src/app/components/landing/SeccionProblemaSolucion.tsx`
- Crear: `src/app/components/landing/SeccionQueHace.tsx`
- Crear: `src/app/components/landing/SeccionCifras.tsx`
- Crear: `src/app/components/landing/SeccionCreditos.tsx`
- Crear: `src/app/components/landing/CierreConfeti.tsx`
- Crear: `src/app/components/landing/BotonCelebracion.tsx`
- Crear: `src/app/lib/soporteWebgl.ts`
- Crear: `src/app/lib/celebracion.ts` (+ `celebracion.test.ts`)
- Modificar: `src/app/lib/navigation.ts` (+ `navigation.test.ts`)
- Modificar: `src/app/App.tsx`
- Modificar: `src/app/components/Sidebar.tsx`
- Modificar: `src/styles/theme.css`

---

### Task 0: Rama y dependencias

**Files:** ninguno de código (solo `package.json` / lockfile).

- [ ] **Step 1: Crear la rama de trabajo**

Run:
```bash
git checkout -b feat/landing-bienvenida
```
Expected: cambia a la rama nueva.

- [ ] **Step 2: Instalar dependencias de la gota 3D y el confeti**

Run:
```bash
npm install three @react-three/fiber @react-three/drei canvas-confetti
npm install -D @types/three @types/canvas-confetti
```
Expected: instala sin errores de peer-deps. `@react-three/fiber` v8 es compatible con React 18.3. Si npm reporta conflicto de peer, reintentar la línea problemática con la versión que sugiera el propio npm (no usar `--force`).

- [ ] **Step 3: Verificar que el build sigue sano antes de tocar código**

Run:
```bash
npm run typecheck
npm run build
```
Expected: ambos PASAN (las dependencias nuevas aún no se importan).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: añade three, react-three-fiber, drei y canvas-confetti para la landing"
```

---

### Task 1: Enrutado (landing en `/`, panel en `/app`) — TDD

**Files:**
- Modify: `src/app/lib/navigation.ts`
- Test: `src/app/lib/navigation.test.ts`

- [ ] **Step 1: Reescribir el test con las expectativas nuevas**

Reemplazar TODO el contenido de `src/app/lib/navigation.test.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import { viewToPath, pathToView } from './navigation';

describe('lib/navigation', () => {
  it('la landing vive en la raiz', () => {
    expect(viewToPath('landing')).toBe('/');
    expect(pathToView('/')).toBe('landing');
    expect(pathToView('')).toBe('landing');
  });

  it('el panel (dashboard) vive en /app', () => {
    expect(viewToPath('dashboard')).toBe('/app');
    expect(pathToView('/app')).toBe('dashboard');
    expect(pathToView('/app/')).toBe('dashboard');
  });

  it('las demas vistas son /<vista>', () => {
    expect(viewToPath('map')).toBe('/map');
    expect(pathToView('/map')).toBe('map');
    expect(pathToView('/hydro/')).toBe('hydro');
  });

  it('ruta desconocida -> landing', () => {
    expect(pathToView('/no-existe')).toBe('landing');
    expect(pathToView('/favicon.ico')).toBe('landing');
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run:
```bash
npx vitest run src/app/lib/navigation.test.ts
```
Expected: FAIL (`pathToView('/')` aún devuelve `'dashboard'`, etc.).

- [ ] **Step 3: Actualizar la implementación**

En `src/app/lib/navigation.ts`:

Reemplazar el array `VIEWS` (añade `'landing'` al inicio):
```ts
export const VIEWS = [
  'landing', 'dashboard', 'analytics', 'map', 'compare', 'ficha', 'hydro', 'historia',
  'status', 'extractor', 'history', 'settings', 'docs',
] as const;
```

Reemplazar `viewToPath`:
```ts
// 'landing' vive en la raíz '/'; el panel ('dashboard') en '/app'; el resto en '/<vista>'.
export function viewToPath(view: string): string {
  if (view === 'landing') return '/';
  if (view === 'dashboard') return '/app';
  return `/${view}`;
}
```

Reemplazar `pathToView` (raíz -> landing; '/app' -> dashboard; desconocido -> landing):
```ts
// Deriva la vista desde un pathname. Raíz pelada -> 'landing' (la portada). '/app'
// es el panel. Segmento desconocido -> 'landing'. ('/landing' y '/dashboard' quedan
// como alias inofensivos de sus rutas canónicas '/' y '/app').
export function pathToView(pathname: string): string {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (!seg) return 'landing';
  if (seg === 'app') return 'dashboard';
  return (VIEWS as readonly string[]).includes(seg) ? seg : 'landing';
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run:
```bash
npx vitest run src/app/lib/navigation.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/navigation.ts src/app/lib/navigation.test.ts
git commit -m "feat: landing en / y panel en /app en el enrutado"
```

---

### Task 2: Wiring de App + logo del Sidebar + scaffold de Landing (milestone navegable)

**Files:**
- Create: `src/app/components/landing/Landing.tsx` (placeholder, se completa en Task 10)
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/Sidebar.tsx`

- [ ] **Step 1: Crear un Landing placeholder navegable**

Crear `src/app/components/landing/Landing.tsx`:
```tsx
interface LandingProps {
  onNavigate: (view: string) => void;
}

// Placeholder navegable; se reemplaza por la landing completa en la Task 10.
export function Landing({ onNavigate }: LandingProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center text-foreground">
      <h1 className="text-3xl font-extrabold">Automatización de datos hídricos del IDEAM</h1>
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground"
      >
        Entrar a la plataforma
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Cargar Landing como chunk lazy en App**

En `src/app/App.tsx`, junto a los demás `lazyWithRetry` (tras la línea de `HistoriaIdf`, alrededor de la línea 18), añadir:
```tsx
const Landing = lazyWithRetry(() => import('./components/landing/Landing').then((m) => ({ default: m.Landing })));
```

- [ ] **Step 3: Renderizar la landing a pantalla completa, sin el chrome del panel**

En `src/app/App.tsx`, dentro de `export default function App()`, JUSTO antes del `return (` que abre el layout con `<div className="flex h-screen ...">` (alrededor de la línea 185), insertar este early-return:
```tsx
  // La landing es portada a pantalla completa: sin sidebar, navbar ni barras.
  if (currentView === 'landing') {
    return (
      <ErrorBoundary key="landing">
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">Cargando…</div>}>
          <Landing onNavigate={navigate} />
        </Suspense>
      </ErrorBoundary>
    );
  }
```

- [ ] **Step 4: Actualizar el shim de `/asistente` (la raíz ya no es el panel)**

En `src/app/App.tsx`, el efecto que migra `/asistente` (alrededor de la línea 76) cambia su destino de `/` a `/app` y fija la vista del panel antes de abrir el asistente. Reemplazar el cuerpo del efecto por:
```tsx
  useEffect(() => {
    if (window.location.pathname.replace(/\/+$/, '') === '/asistente') {
      window.history.replaceState(null, '', '/app');
      setCurrentView('dashboard');
      window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT));
    }
  }, []);
```

- [ ] **Step 5: El logo del Sidebar vuelve a la landing**

En `src/app/components/Sidebar.tsx`, dentro de `SidebarContent`, envolver las dos imágenes del logo (la vertical y la compacta) en un botón que navegue a `landing`. Reemplazar el bloque de cabecera del logo (las ramas `!isCollapsed ? (...) : (...)` con las `<img>`, alrededor de las líneas 74-87) por:
```tsx
        {!isCollapsed ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              aria-label="Ir al inicio"
              className="block w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A227]"
            >
              <img src={logoVertical} alt="Universidad de la Costa CUC" className="mx-auto h-auto w-28" />
            </button>
            <div className="pt-1 text-center">
              <p className="text-xs font-bold leading-4 text-white">AUTOMATIZACIÓN DE DATOS HÍDRICOS DEL IDEAM</p>
              <p className="text-[0.7rem] text-white/80">Por: Sergio Beltran Coley</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              aria-label="Ir al inicio"
              className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A227]"
            >
              <img src={logoCollapsed} alt="CUC" className="h-10 w-10 object-contain" />
            </button>
          </div>
        )}
```

- [ ] **Step 6: Typecheck + build**

Run:
```bash
npm run typecheck
npm run build
```
Expected: ambos PASAN.

- [ ] **Step 7: Verificación manual rápida en dev**

Run:
```bash
npm run dev:web
```
Abrir la URL local. Verificar: `/` muestra el placeholder de la landing (sin sidebar); el botón "Entrar a la plataforma" lleva a `/app` con el panel completo; en el panel, clic en el logo CUC del sidebar regresa a `/`. Cerrar el dev server.

- [ ] **Step 8: Commit**

```bash
git add src/app/App.tsx src/app/components/Sidebar.tsx src/app/components/landing/Landing.tsx
git commit -m "feat: portada en / a pantalla completa y panel en /app navegables"
```

---

### Task 3: Soporte WebGL + gota estática + mascota

**Files:**
- Create: `src/app/lib/soporteWebgl.ts`
- Create: `src/app/components/landing/GotaEstatica.tsx`
- Create: `src/app/components/landing/MascotaGota.tsx`

- [ ] **Step 1: Crear el detector de WebGL**

Crear `src/app/lib/soporteWebgl.ts`:
```ts
/**
 * `true` si el navegador puede crear un contexto WebGL. Se usa para decidir si se
 * carga la gota 3D (Three.js) o el respaldo SVG estático. Toca el DOM, así que no
 * lleva test unitario (vitest corre en Node sin document).
 */
export function soporteWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Crear la gota SVG estática (respaldo)**

Crear `src/app/components/landing/GotaEstatica.tsx`:
```tsx
interface GotaEstaticaProps {
  className?: string;
}

// Respaldo de la gota 3D para equipos sin WebGL o con "reducir movimiento".
// Es una escena física (azul agua): colores fijos, no se invierte en dark mode.
export function GotaEstatica({ className = '' }: GotaEstaticaProps) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Gota de agua" className={`h-full w-full ${className}`}>
      <defs>
        <radialGradient id="gota-estatica-grad" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#cfeeff" />
          <stop offset="55%" stopColor="#2b8fd6" />
          <stop offset="100%" stopColor="#155a92" />
        </radialGradient>
      </defs>
      <path d="M100 18 C100 18 36 96 36 132 a64 64 0 0 0 128 0 C164 96 100 18 100 18 Z" fill="url(#gota-estatica-grad)" />
      <ellipse cx="74" cy="108" rx="15" ry="26" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
```

- [ ] **Step 3: Crear la mascota gota**

Crear `src/app/components/landing/MascotaGota.tsx`:
```tsx
interface MascotaGotaProps {
  size?: number;
  className?: string;
}

// "Gotita": personaje SVG por código (sin assets externos). El parpadeo y la
// flotación se animan con CSS scoped en theme.css (.mascota-ojos, .landing-flota),
// que el bloque global de prefers-reduced-motion neutraliza.
export function MascotaGota({ size = 120, className = '' }: MascotaGotaProps) {
  return (
    <svg width={size} height={size * 1.17} viewBox="0 0 120 140" role="img" aria-label="Gotita, la mascota del proyecto" className={className}>
      <path d="M60 8 C60 8 18 62 18 92 a42 42 0 0 0 84 0 C102 62 60 8 60 8 Z" fill="#2b8fd6" />
      <ellipse cx="44" cy="74" rx="9" ry="15" fill="#bfe6ff" opacity="0.7" />
      <g className="mascota-ojos">
        <circle cx="48" cy="92" r="6" fill="#ffffff" />
        <circle cx="72" cy="92" r="6" fill="#ffffff" />
        <circle cx="49" cy="93" r="3" fill="#15324a" />
        <circle cx="73" cy="93" r="3" fill="#15324a" />
      </g>
      <path d="M50 106 q10 9 20 0" fill="none" stroke="#15324a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="39" cy="102" r="4" fill="#f6a6c0" opacity="0.7" />
      <circle cx="81" cy="102" r="4" fill="#f6a6c0" opacity="0.7" />
    </svg>
  );
}
```

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/soporteWebgl.ts src/app/components/landing/GotaEstatica.tsx src/app/components/landing/MascotaGota.tsx
git commit -m "feat: detector webgl, gota estatica de respaldo y mascota gota"
```

---

### Task 4: Gota 3D con Three.js

**Files:**
- Create: `src/app/components/landing/GotaTresD.tsx`

- [ ] **Step 1: Crear el canvas 3D de la gota**

Crear `src/app/components/landing/GotaTresD.tsx`:
```tsx
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Orbe de agua: esfera ligeramente alargada con material de transmisión (refracción
// y brillo). Gira sola y se inclina suave hacia el cursor. El Environment usa
// Lightformers procedurales (sin HDRI externo) para que refleje sin pedir red.
function Orbe() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.y += delta * 0.4;
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, state.pointer.y * 0.3, 0.05);
    m.rotation.z = THREE.MathUtils.lerp(m.rotation.z, -state.pointer.x * 0.3, 0.05);
  });
  return (
    <mesh ref={ref} scale={[1.3, 1.5, 1.3]}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        thickness={1.2}
        roughness={0.05}
        transmission={1}
        ior={1.33}
        chromaticAberration={0.04}
        color="#9fd6ff"
        attenuationColor="#2b8fd6"
        attenuationDistance={2.4}
      />
    </mesh>
  );
}

export default function GotaTresD() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <Orbe />
      <Environment resolution={64}>
        <Lightformer form="circle" intensity={2} position={[2, 3, 4]} scale={3} />
        <Lightformer form="circle" intensity={1.2} position={[-3, -1, 2]} scale={2} color="#ffd9a0" />
      </Environment>
    </Canvas>
  );
}
```

- [ ] **Step 2: Typecheck + build (confirma que three queda en su propio chunk)**

Run:
```bash
npm run typecheck
npm run build
```
Expected: ambos PASAN. En la salida de `vite build` debe aparecer un chunk aparte que contiene three/drei (nombre tipo `GotaTresD-*.js` o un chunk de vendor grande cargado dinámicamente), NO mezclado en el `index-*.js` principal. Si three cae en el bundle principal, revisar que `GotaTresD` se importe solo de forma dinámica (Task 5) y que nada lo importe estáticamente.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/landing/GotaTresD.tsx
git commit -m "feat: gota de agua 3D con react-three-fiber y material de transmision"
```

---

### Task 5: Hero (compone gota 3D con respaldo + mascota + copy + CTAs)

**Files:**
- Create: `src/app/components/landing/HeroGota.tsx`

- [ ] **Step 1: Crear el hero**

Crear `src/app/components/landing/HeroGota.tsx`:
```tsx
import { Suspense, useEffect, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { soporteWebgl } from '../../lib/soporteWebgl';
import { GotaEstatica } from './GotaEstatica';
import { MascotaGota } from './MascotaGota';

const GotaTresD = lazyWithRetry(() => import('./GotaTresD'));

interface HeroGotaProps {
  onNavigate: (view: string) => void;
}

export function HeroGota({ onNavigate }: HeroGotaProps) {
  const reducido = usePrefersReducedMotion();
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    setWebgl(soporteWebgl());
  }, []);
  const usar3d = webgl && !reducido;

  const bajar = () => {
    document.getElementById('landing-proyecto')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  };

  return (
    <header className="relative flex min-h-screen flex-col bg-gradient-to-b from-background to-[#fbf7ee] dark:to-[#15110a]">
      <nav className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-12 w-auto" />
          <span className="text-muted-foreground text-sm">+</span>
          <img src={logoIdeam} alt="IDEAM" className="h-9 w-auto" />
        </div>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#d8c98c] px-4 py-1.5 text-sm font-semibold text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          Entrar <ArrowRight className="h-4 w-4" />
        </button>
      </nav>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-6 py-10 md:grid-cols-2 md:px-10">
        <div className="animate-fade-in-up">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
            Trabajo de grado · Ingeniería Civil
          </p>
          <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Automatización de datos hídricos del <span className="text-primary">IDEAM</span>
          </h2>
          <p className="mt-4 max-w-md text-base text-muted-foreground md:text-lg">
            De millones de registros crudos a datos limpios, curvas IDF y una plataforma viva. En segundos.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:scale-105"
            >
              Entrar a la plataforma <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={bajar}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d8c98c] px-5 py-3 font-semibold text-secondary transition-colors hover:border-primary hover:text-primary"
            >
              Conoce el proyecto <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="relative h-64 w-64 md:h-80 md:w-80">
            {usar3d ? (
              <Suspense fallback={<GotaEstatica />}>
                <GotaTresD />
              </Suspense>
            ) : (
              <GotaEstatica />
            )}
          </div>
          <MascotaGota size={92} className="landing-flota absolute -bottom-2 right-0 md:-right-4" />
        </div>
      </div>

      <button type="button" onClick={bajar} aria-label="Bajar a conocer el proyecto" className="mx-auto mb-6 text-muted-foreground">
        <ChevronDown className="landing-flota h-7 w-7" />
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/landing/HeroGota.tsx
git commit -m "feat: hero de la landing con gota 3D, respaldo y mascota"
```

---

### Task 6: Secciones "problema → solución" y "qué hace"

**Files:**
- Create: `src/app/components/landing/SeccionProblemaSolucion.tsx`
- Create: `src/app/components/landing/SeccionQueHace.tsx`

- [ ] **Step 1: Crear "del problema a la solución"**

Crear `src/app/components/landing/SeccionProblemaSolucion.tsx`:
```tsx
import { Clock, Zap } from 'lucide-react';

export function SeccionProblemaSolucion() {
  return (
    <section id="landing-proyecto" className="bg-[#fbf7ee] px-6 py-16 dark:bg-[#15110a] md:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">
          Del problema a la solución
        </p>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Clock className="mb-3 h-6 w-6 text-muted-foreground" />
            <h3 className="font-bold text-card-foreground">Antes · manual</h3>
            <p className="mt-1 text-sm text-muted-foreground">Flujo de Python a PowerBI, días de trabajo por cada consulta.</p>
          </div>
          <div className="text-center text-3xl font-extrabold text-primary">→</div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Zap className="mb-3 h-6 w-6 text-success" />
            <h3 className="font-bold text-card-foreground">Ahora · automático</h3>
            <p className="mt-1 text-sm text-muted-foreground">Plataforma web y paquete local. Resultados en segundos.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-extrabold leading-none text-success">98%</div>
            <div className="mt-1 text-xs text-muted-foreground">menos tiempo</div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Crear "qué hace la plataforma"**

Crear `src/app/components/landing/SeccionQueHace.tsx`:
```tsx
import { Droplets, LineChart, Map, Terminal, Bot } from 'lucide-react';

const CAPACIDADES = [
  { icon: Droplets, titulo: 'Datos limpios', texto: 'Series del IDEAM saneadas y listas para usar.' },
  { icon: LineChart, titulo: 'Curvas IDF reales', texto: 'Intensidad, duración y frecuencia desde datos sub-horarios.' },
  { icon: Map, titulo: 'Mapa y analítica', texto: 'Explora estaciones, climas y tendencias por región.' },
  { icon: Terminal, titulo: 'Extractor local', texto: 'Paquete de terminal (CLI y TUI) para descargar a tu PC.' },
  { icon: Bot, titulo: 'Asistente de IA', texto: 'Pregúntale a tus datos en lenguaje natural.' },
];

export function SeccionQueHace() {
  return (
    <section className="px-6 py-16 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="mb-10 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
          Qué hace la plataforma
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CAPACIDADES.map(({ icon: Icon, titulo, texto }) => (
            <div key={titulo} className="group rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-1">
              <Icon className="anim-bounce mb-3 h-7 w-7 text-secondary" />
              <h3 className="font-bold text-card-foreground">{titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/landing/SeccionProblemaSolucion.tsx src/app/components/landing/SeccionQueHace.tsx
git commit -m "feat: secciones problema-solucion y que hace de la landing"
```

---

### Task 7: Sección de cifras (contadores animados)

**Files:**
- Create: `src/app/components/landing/SeccionCifras.tsx`

> Nota de datos: las cifras vienen de los números reales del proyecto (precipitación ~282M filas y total del orden de cientos de millones; 569 municipios del gazetteer; ~15 curvas IDF publicables de la validación; costo $0). Confirmar el orden de magnitud al verificar en vivo; no inventar precisión falsa.

- [ ] **Step 1: Crear la sección con contador propio**

Crear `src/app/components/landing/SeccionCifras.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';

const CIFRAS = [
  { valor: 400, sufijo: 'M+', etiqueta: 'registros procesados', color: 'text-primary' },
  { valor: 569, sufijo: '', etiqueta: 'municipios', color: 'text-secondary' },
  { valor: 15, sufijo: '', etiqueta: 'curvas IDF publicables', color: 'text-success' },
  { valor: 0, sufijo: '', etiqueta: 'costo de operación ($)', color: 'text-primary' },
];

function Contador({ valor, sufijo, reducido }: { valor: number; sufijo: string; reducido: boolean }) {
  const [n, setN] = useState(reducido ? valor : 0);
  const ref = useRef<HTMLDivElement | null>(null);
  const hecho = useRef(false);

  useEffect(() => {
    if (reducido) {
      setN(valor);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hecho.current) {
          hecho.current = true;
          const dur = 1100;
          const inicio = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - inicio) / dur);
            setN(Math.round(valor * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [valor, reducido]);

  return (
    <div ref={ref}>
      {n.toLocaleString('es-CO')}
      {sufijo}
    </div>
  );
}

export function SeccionCifras() {
  const reducido = usePrefersReducedMotion();
  return (
    <section className="bg-gradient-to-b from-[#fbf7ee] to-[#fbe9c9] px-6 py-16 dark:from-[#15110a] dark:to-[#1b1407] md:px-10">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
        {CIFRAS.map(({ valor, sufijo, etiqueta, color }) => (
          <div key={etiqueta} className="text-center">
            <div className={`text-4xl font-extrabold md:text-5xl ${color}`}>
              <Contador valor={valor} sufijo={sufijo} reducido={reducido} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{etiqueta}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/landing/SeccionCifras.tsx
git commit -m "feat: seccion de cifras con contadores animados"
```

---

### Task 8: Sección de créditos

**Files:**
- Create: `src/app/components/landing/SeccionCreditos.tsx`

- [ ] **Step 1: Crear la sección de créditos (solo el autor)**

Crear `src/app/components/landing/SeccionCreditos.tsx`:
```tsx
import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';

export function SeccionCreditos() {
  return (
    <section className="px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-8 text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">Créditos</p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-16 w-auto" />
          <img src={logoIdeam} alt="IDEAM, fuente de datos" className="h-12 w-auto" />
        </div>
        <p className="mt-8 text-lg text-foreground">
          Creado por <span className="font-bold">Sergio Beltran Coley</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Universidad de la Costa CUC · Datos abiertos del IDEAM
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/landing/SeccionCreditos.tsx
git commit -m "feat: seccion de creditos de la landing"
```

---

### Task 9: Lógica de celebración (TDD) + botón + cierre lúdico

**Files:**
- Create: `src/app/lib/celebracion.ts`
- Test: `src/app/lib/celebracion.test.ts`
- Create: `src/app/components/landing/BotonCelebracion.tsx`
- Create: `src/app/components/landing/CierreConfeti.tsx`

- [ ] **Step 1: Escribir el test de la lógica de ráfagas (falla primero)**

Crear `src/app/lib/celebracion.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { construirRafagas, COLORES_CUC } from './celebracion';

describe('lib/celebracion', () => {
  it('usa la paleta CUC (rojo, oro, verde, amarillo)', () => {
    expect(COLORES_CUC).toEqual(['#A3161A', '#C9A227', '#078930', '#FCD116']);
  });

  it('modo normal: varias ráfagas anchas con colores CUC', () => {
    const rafagas = construirRafagas(false);
    expect(rafagas.length).toBe(3);
    for (const r of rafagas) {
      expect(r.colors).toEqual(COLORES_CUC);
      expect(r.spread).toBe(360);
      expect(r.particleCount).toBeGreaterThanOrEqual(60);
    }
  });

  it('reducir movimiento: un solo estallido pequeño', () => {
    const rafagas = construirRafagas(true);
    expect(rafagas.length).toBe(1);
    expect(rafagas[0].particleCount).toBeLessThanOrEqual(20);
    expect(rafagas[0].spread).toBeLessThan(360);
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run:
```bash
npx vitest run src/app/lib/celebracion.test.ts
```
Expected: FAIL (`celebracion` no existe).

- [ ] **Step 3: Implementar la lógica pura**

Crear `src/app/lib/celebracion.ts`:
```ts
export interface OpcionesRafaga {
  particleCount: number;
  spread: number;
  startVelocity: number;
  origin: { x: number; y: number };
  colors: string[];
  gravity: number;
  ticks: number;
  scalar: number;
}

// Paleta CUC: rojo institucional, oro, verde y amarillo de apoyo.
export const COLORES_CUC = ['#A3161A', '#C9A227', '#078930', '#FCD116'];

/**
 * Construye las ráfagas tipo fuego artificial para canvas-confetti. Con `reducido`
 * (prefers-reduced-motion) devuelve un único estallido pequeño. Pura y testeable.
 */
export function construirRafagas(reducido: boolean): OpcionesRafaga[] {
  if (reducido) {
    return [
      {
        particleCount: 18,
        spread: 50,
        startVelocity: 18,
        origin: { x: 0.5, y: 0.6 },
        colors: COLORES_CUC,
        gravity: 1,
        ticks: 90,
        scalar: 0.9,
      },
    ];
  }
  return [0.2, 0.5, 0.8].map((x) => ({
    particleCount: 80,
    spread: 360,
    startVelocity: 38,
    origin: { x, y: 0.55 },
    colors: COLORES_CUC,
    gravity: 1.1,
    ticks: 200,
    scalar: 1,
  }));
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run:
```bash
npx vitest run src/app/lib/celebracion.test.ts
```
Expected: PASS.

- [ ] **Step 5: Crear el botón de celebración**

Crear `src/app/components/landing/BotonCelebracion.tsx`:
```tsx
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { construirRafagas } from '../../lib/celebracion';

export function BotonCelebracion() {
  const reducido = usePrefersReducedMotion();
  const [activo, setActivo] = useState(false);

  const celebrar = async () => {
    setActivo(true);
    try {
      const confetti = (await import('canvas-confetti')).default;
      const rafagas = construirRafagas(reducido);
      rafagas.forEach((r, i) => {
        window.setTimeout(() => confetti(r), reducido ? 0 : i * 220);
      });
    } catch {
      /* canvas-confetti no disponible: el botón sigue siendo inocuo */
    } finally {
      window.setTimeout(() => setActivo(false), 1200);
    }
  };

  return (
    <button
      type="button"
      onClick={celebrar}
      aria-label="Celebra los datos abiertos con una animación"
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FCD116] to-[#C9A227] px-5 py-3 font-bold text-[#5a3d00] transition-transform hover:scale-105 active:scale-95"
    >
      <Sparkles className={`h-5 w-5 ${activo ? 'animate-spin' : ''}`} />
      ¡Celebra los datos abiertos!
    </button>
  );
}
```

- [ ] **Step 6: Crear la sección de cierre lúdico**

Crear `src/app/components/landing/CierreConfeti.tsx`:
```tsx
import { ArrowRight, BookOpen } from 'lucide-react';
import { MascotaGota } from './MascotaGota';
import { BotonCelebracion } from './BotonCelebracion';

interface CierreConfetiProps {
  onNavigate: (view: string) => void;
}

export function CierreConfeti({ onNavigate }: CierreConfetiProps) {
  return (
    <section className="relative overflow-hidden bg-[#15110a] px-6 py-20 text-center md:px-10">
      <div className="mx-auto max-w-3xl">
        <MascotaGota size={110} className="landing-flota mx-auto mb-6" />
        <h2 className="text-3xl font-extrabold text-[#f5edda] md:text-4xl">
          Los datos abiertos también se celebran
        </h2>
        <p className="mt-3 text-[#bdb39a]">
          Entra a explorar la plataforma, o lánzate un pequeño festejo.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:scale-105"
          >
            Entrar a la plataforma <ArrowRight className="h-5 w-5" />
          </button>
          <BotonCelebracion />
        </div>
        <button
          type="button"
          onClick={() => onNavigate('historia')}
          className="mx-auto mt-6 inline-flex items-center gap-1.5 text-sm text-[#d8c98c] underline-offset-4 hover:underline"
        >
          <BookOpen className="h-4 w-4" /> Lee la historia completa del dato
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/lib/celebracion.ts src/app/lib/celebracion.test.ts src/app/components/landing/BotonCelebracion.tsx src/app/components/landing/CierreConfeti.tsx
git commit -m "feat: logica de celebracion, boton de confeti y cierre ludico"
```

---

### Task 10: Landing completa + CSS scoped

**Files:**
- Modify: `src/app/components/landing/Landing.tsx` (reemplaza el placeholder)
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Reemplazar el placeholder de Landing por la versión completa**

Reemplazar TODO el contenido de `src/app/components/landing/Landing.tsx` por:
```tsx
import { HeroGota } from './HeroGota';
import { SeccionProblemaSolucion } from './SeccionProblemaSolucion';
import { SeccionQueHace } from './SeccionQueHace';
import { SeccionCifras } from './SeccionCifras';
import { SeccionCreditos } from './SeccionCreditos';
import { CierreConfeti } from './CierreConfeti';

interface LandingProps {
  onNavigate: (view: string) => void;
}

// Portada del proyecto: institucional arriba, más ilustrada y lúdica hacia abajo,
// cerrando con la celebración. Pantalla completa propia (App no monta el chrome
// del panel para la vista 'landing'). Un solo <h1> para toda la página.
export function Landing({ onNavigate }: LandingProps) {
  return (
    <div className="landing h-screen overflow-y-auto bg-background text-foreground scrollbar-thin scrollbar-track-transparent">
      <h1 className="sr-only">Automatización de datos hídricos del IDEAM, trabajo de grado de Sergio Beltran Coley</h1>
      <HeroGota onNavigate={onNavigate} />
      <SeccionProblemaSolucion />
      <SeccionQueHace />
      <SeccionCifras />
      <SeccionCreditos />
      <CierreConfeti onNavigate={onNavigate} />
    </div>
  );
}
```

- [ ] **Step 2: Añadir las animaciones scoped de la landing**

Al FINAL de `src/styles/theme.css`, añadir:
```css
/* ============================================================================
   Landing de bienvenida: animaciones scoped. icono-float ya está definido arriba.
   El bloque global de prefers-reduced-motion neutraliza todas estas.
   ========================================================================== */
.landing-flota {
  animation: icono-float 3.2s ease-in-out infinite;
}
@keyframes mascota-parpadeo {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}
.mascota-ojos {
  transform-origin: center;
  animation: mascota-parpadeo 5s ease-in-out infinite;
}
```

- [ ] **Step 3: Typecheck + build + tests unitarios**

Run:
```bash
npm run typecheck
npm run build
npm run test:unit
```
Expected: los tres PASAN (incluye `navigation.test.ts` y `celebracion.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/app/components/landing/Landing.tsx src/styles/theme.css
git commit -m "feat: ensambla la landing completa y sus animaciones"
```

---

### Task 11: Verificación final y PR

**Files:** ninguno (verificación + integración).

- [ ] **Step 1: Verificación en vivo en dev**

Run:
```bash
npm run dev:web
```
Abrir la URL local y verificar, en claro y oscuro:
- `/` muestra la landing a pantalla completa (sin sidebar), con la gota 3D girando y reaccionando al mouse, y la mascota flotando.
- "Conoce el proyecto" baja con scroll suave a la sección de proyecto.
- Las cifras cuentan hacia arriba al entrar en pantalla.
- El botón "¡Celebra los datos abiertos!" lanza fuegos + confeti en colores CUC y es repetible.
- "Entrar a la plataforma" (hero y cierre) lleva a `/app` con el panel intacto.
- En el panel, el logo CUC del sidebar regresa a `/`.
- "Lee la historia completa del dato" lleva a `/historia`.
- Móvil (DevTools responsive): el hero apila, las tarjetas se reordenan, nada se desborda.
- Con "reducir movimiento" del SO activo: aparece la gota estática (no el canvas), los contadores muestran el valor final directo y la celebración hace solo un estallido pequeño.

Cerrar el dev server.

- [ ] **Step 2: Suite completa**

Run:
```bash
npm run typecheck
npm run test:unit
npm run test
npm run build
```
Expected: todo PASA. (`npm run test` corre los tests del worker con el runner de Node; deben seguir verdes al no haberlos tocado.)

- [ ] **Step 3: Push de la rama y PR**

Run:
```bash
git push -u origin feat/landing-bienvenida
gh pr create --title "Landing de bienvenida en / (panel a /app)" --body "Nueva portada del proyecto a pantalla completa en /, con gota de agua 3D (Three.js, respaldo SVG), arco institucional a lúdico, contadores y botón de fuegos/confeti. El panel se mueve a /app; el logo del sidebar regresa a la portada. Frontend puro; deep-links y panel intactos. Ver spec docs/superpowers/specs/2026-06-24-landing-bienvenida-design.md y plan docs/superpowers/plans/2026-06-24-landing-bienvenida.md."
```
Expected: PR creado contra `main`. El CI (`deploy-ideam.yml`) corre tests y, al mergear, auto-despliega.

- [ ] **Step 4: Verificación en vivo en producción tras el merge/deploy**

Repetir los chequeos del Step 1 contra `https://ideam.sergiobc.com` una vez desplegado. Confirmar que el bundle del panel no creció de forma notable (Three.js debe vivir en el chunk diferido de la landing).

---

## Auto-revisión del plan (hecha)

- **Cobertura de la spec:** enrutado (Task 1, 2), landing a pantalla completa sin chrome (Task 2), logo del sidebar a `/` (Task 2), gota 3D + respaldo (Task 3, 4, 5), mascota (Task 3, 5, 9), 6 secciones del arco (Task 5-10), celebración fuegos+confeti reducible (Task 9), créditos solo autor (Task 8), enlace a `/historia` (Task 9), dark mode + reduced-motion (en cada sección + Task 10 CSS), carga diferida de three y confeti (Task 4 build check, Task 5 import dinámico, Task 9 import dinámico), pruebas (Task 1, 9) y verificación en vivo (Task 11). Sin huecos.
- **Placeholders:** el único "placeholder" deliberado es `Landing.tsx` de la Task 2, reemplazado explícitamente en la Task 10. Ningún paso deja código por definir.
- **Consistencia de tipos:** `onNavigate: (view: string) => void` se usa igual en `Landing`, `HeroGota` y `CierreConfeti`. `GotaTresD` es default export y se importa con `lazyWithRetry(() => import('./GotaTresD'))`. `construirRafagas(reducido: boolean): OpcionesRafaga[]` y `COLORES_CUC` coinciden entre `celebracion.ts`, su test y `BotonCelebracion`. `soporteWebgl(): boolean` coincide entre util y `HeroGota`.
