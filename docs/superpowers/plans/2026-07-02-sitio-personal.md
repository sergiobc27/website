# Portafolio sergiobc.com Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir y desplegar el portafolio bilingüe y animado de sergiobc.com descrito en `docs/superpowers/specs/2026-07-02-sitio-personal-design.md`, reemplazando el Worker `website`.

**Architecture:** Sitio estático de una sola página en `sitio-personal/` (Vite + TypeScript vanilla, CSS plano, SVG inline). El HTML/CSS/JS de referencia ya existe y está validado por el usuario: es el mockup v3 del brainstorming (`Github/.superpowers/brainstorm/1722-1783041708/content/mockup-home-v3.html`); se porta a módulos, se le añade i18n con overlay iridiscente y se despliega como Workers Assets al Worker `website` con ruta `sergiobc.com/*`.

**Tech Stack:** Vite 6 (vanilla-ts), TypeScript, CSS nativo, Cloudflare Workers Assets, wrangler.

**Regla del proyecto:** el texto visible no lleva raya larga (usar coma, dos puntos o punto). Commits sin firmas de IA.

---

### Task 1: Andamiaje de `sitio-personal/`

**Files:**
- Create: `sitio-personal/package.json`
- Create: `sitio-personal/tsconfig.json`
- Create: `sitio-personal/vite.config.ts`
- Create: `sitio-personal/wrangler.jsonc`
- Create: `sitio-personal/index.html` (esqueleto mínimo, se completa en Task 3)
- Create: `sitio-personal/src/main.ts` (vacío por ahora: `export {}`)
- Create: `sitio-personal/src/styles.css` (vacío por ahora)

- [ ] **Step 1: package.json**

```json
{
  "name": "sitio-personal",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler deploy"
  },
  "devDependencies": {
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vite.config.ts**

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: { outDir: 'dist', assetsInlineLimit: 8192 },
})
```

- [ ] **Step 4: wrangler.jsonc** (mismo patrón que el `wrangler.jsonc` de la raíz del repo, que sirve de referencia de zona)

```jsonc
{
  "name": "website",
  "compatibility_date": "2026-06-01",
  "assets": { "directory": "./dist" },
  "routes": [
    { "pattern": "sergiobc.com/*", "zone_name": "sergiobc.com" },
    { "pattern": "www.sergiobc.com/*", "zone_name": "sergiobc.com" }
  ]
}
```

Nota: el Worker `website` ya existe en la cuenta; `wrangler deploy` lo actualiza. Sin `main`, wrangler publica un Worker de solo assets.

- [ ] **Step 5: instalar dependencias y verificar que el build vacío pasa**

Run: `cd sitio-personal && npm install && npm run build`
Expected: `vite build` termina con `dist/index.html` generado.

- [ ] **Step 6: Commit**

```bash
git add sitio-personal
git commit -m "Sitio personal: andamiaje Vite + wrangler para el Worker website"
```

### Task 2: PDFs del CV como assets

**Files:**
- Create: `sitio-personal/public/cv/sergio-beltran-coley-es.pdf` (copia de `C:\Users\Sergio\OneDrive\Desktop\(CV) Sergio Beltrán Coley - Español.pdf`)
- Create: `sitio-personal/public/cv/sergio-beltran-coley-en.pdf` (copia de `C:\Users\Sergio\OneDrive\Desktop\(CV) Sergio Beltrán Coley - English.pdf`)

- [ ] **Step 1: copiar los archivos**

```bash
mkdir -p sitio-personal/public/cv
cp "C:/Users/Sergio/OneDrive/Desktop/(CV) Sergio Beltrán Coley - Español.pdf" sitio-personal/public/cv/sergio-beltran-coley-es.pdf
cp "C:/Users/Sergio/OneDrive/Desktop/(CV) Sergio Beltrán Coley - English.pdf" sitio-personal/public/cv/sergio-beltran-coley-en.pdf
```

- [ ] **Step 2: Commit**

```bash
git add sitio-personal/public
git commit -m "Sitio personal: PDFs de la hoja de vida (ES y EN)"
```

### Task 3: Estructura HTML

**Files:**
- Modify: `sitio-personal/index.html`

Portar la estructura del mockup v3 (nav, hero con escena SVG de capas, marquee, cuatro mundos, trayectoria, proyectos, hoja de vida con libro, footer, modal del visor). Cambios respecto al mockup:

- Todo texto visible sale de `data-i18n="clave"` (el TS lo rellena desde el diccionario); el HTML trae el español por defecto para SEO y no-JS.
- `<html lang="es">`, `<title>Sergio Beltrán Coley · Ingeniería, datos e IA</title>`, meta description y Open Graph.
- El selector de idioma son dos botones con banderas SVG inline (España y Estados Unidos):

```html
<div class="lang" role="group" aria-label="Idioma">
  <button class="flag active" data-lang="es" aria-label="Español">
    <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/></svg>
  </button>
  <button class="flag" data-lang="en" aria-label="English">
    <svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#B22234"/><g fill="#fff"><rect y="2.3" width="30" height="1.5"/><rect y="5.4" width="30" height="1.5"/><rect y="8.5" width="30" height="1.5"/><rect y="11.6" width="30" height="1.5"/><rect y="14.7" width="30" height="1.5"/><rect y="17.8" width="30" height="1.5"/></g><rect width="12" height="10.8" fill="#3C3B6E"/><g fill="#fff"><circle cx="2" cy="2" r=".7"/><circle cx="6" cy="2" r=".7"/><circle cx="10" cy="2" r=".7"/><circle cx="4" cy="4.5" r=".7"/><circle cx="8" cy="4.5" r=".7"/><circle cx="2" cy="7" r=".7"/><circle cx="6" cy="7" r=".7"/><circle cx="10" cy="7" r=".7"/><circle cx="4" cy="9.3" r=".7"/><circle cx="8" cy="9.3" r=".7"/></g></svg>
  </button>
</div>
```

- Overlay del cambio de idioma antes de cerrar `</body>`: `<div class="iris" id="iris" aria-hidden="true"></div>`.
- Enlaces reales: LinkedIn `https://www.linkedin.com/in/sergiobeltrancoley`, GitHub `https://github.com/sergiobc27`, plataforma `https://ideam.sergiobc.com`, PyPI `https://pypi.org/project/ideam-data-automator/`, correo `mailto:sergiobeltrancoley@gmail.com`.
- El botón "Descargar PDF" del visor apunta a `/cv/sergio-beltran-coley-es.pdf` o `-en.pdf` según el idioma activo.

- [ ] **Step 1: escribir `index.html` completo** (portando el mockup con los cambios de arriba)
- [ ] **Step 2: `npm run dev` y revisar en el navegador que la estructura carga**
- [ ] **Step 3: Commit** `git commit -m "Sitio personal: estructura HTML de la página"`

### Task 4: Estilos

**Files:**
- Modify: `sitio-personal/src/styles.css`

Portar el CSS del mockup v3 completo (variables, cursor, ripple/chispas, progreso, nav, hero, escena, marquee, mundos, timeline, tarjetas tilt, stats, libro CV, modal, footer, zonas de color) más:

- [ ] **Step 1: bloque de accesibilidad y táctil al final del CSS**

```css
@media (hover: none), (pointer: coarse) {
  body, a, .hover-target { cursor: auto; }
  .cursor-dot, .cursor-ring { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
  body, a, .hover-target { cursor: auto; }
  .cursor-dot, .cursor-ring, .iris { display: none; }
  .reveal, .clip-title > span { opacity: 1; transform: none; }
}
```

- [ ] **Step 2: estilos del selector de banderas y del overlay iridiscente**

```css
.lang { display: flex; gap: 8px; }
.flag { width: 40px; height: 28px; border-radius: 6px; overflow: hidden; border: 2px solid transparent; padding: 0; background: none; transition: transform .25s, border-color .25s; }
.flag svg { display: block; width: 100%; height: 100%; }
.flag.active { border-color: var(--accent); transform: scale(1.08); }
.flag:not(.active) { opacity: .55; }
.flag:hover { opacity: 1; transform: scale(1.12); }

/* Apple Intelligence: anillo iridiscente en el perímetro */
.iris { position: fixed; inset: 0; z-index: 800; pointer-events: none; opacity: 0; padding: 10px;
  background: conic-gradient(from var(--iris-angle, 0deg), #3a7bd5, #7c3aed, #ec4899, #f59e0b, #10b981, #3a7bd5);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  filter: blur(14px) saturate(1.6); }
.iris.on { animation: irisrun 1.3s ease-in-out forwards; }
@keyframes irisrun {
  0% { opacity: 0; --iris-angle: 0deg; padding: 4px; }
  20% { opacity: 1; }
  80% { opacity: 1; --iris-angle: 300deg; padding: 26px; }
  100% { opacity: 0; --iris-angle: 360deg; padding: 10px; }
}
@property --iris-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
main.lang-fade { animation: langfade 1.3s ease-in-out; }
@keyframes langfade { 0% { opacity: 1; } 45% { opacity: 0; filter: blur(6px); } 60% { opacity: 0; } 100% { opacity: 1; filter: none; } }
```

- [ ] **Step 3: revisar visualmente en dev y Commit** `git commit -m "Sitio personal: estilos completos con accesibilidad"`

### Task 5: i18n con banderas y overlay

**Files:**
- Create: `sitio-personal/src/i18n.ts`
- Modify: `sitio-personal/src/main.ts`

- [ ] **Step 1: diccionario completo** en `i18n.ts` con la forma:

```ts
export type Lang = 'es' | 'en'
export const textos: Record<string, { es: string; en: string }> = {
  'nav.mundos': { es: 'Mundos', en: 'Worlds' },
  'hero.titulo.1': { es: 'Ingeniería,', en: 'Engineering,' },
  // ... una clave por cada texto visible de la página y del visor de CV
}
```

Cubre: nav (5 enlaces), hero (titular 4 palabras, kicker, sub, 2 botones), marquee (6 términos), mundos (título de sección + 4 tarjetas), trayectoria (título + 3 items con meta/título/texto), proyectos (título + 3 tarjetas + tags), hoja de vida (título, 4 stats, texto del libro, botón), footer (kicker, título, enlaces), visor (pestañas, secciones Perfil/Experiencia/Educación/Certificaciones con las 12 certificaciones, enlace de descarga).

- [ ] **Step 2: función de aplicación y cambio con overlay** en `main.ts`:

```ts
import { textos, type Lang } from './i18n'

let lang: Lang = (localStorage.getItem('lang') as Lang)
  ?? (navigator.language.startsWith('es') ? 'es' : 'en')

function aplicarIdioma(l: Lang) {
  lang = l
  document.documentElement.lang = l
  localStorage.setItem('lang', l)
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const t = textos[el.dataset.i18n!]
    if (t) el.innerHTML = t[l]
  })
  document.querySelectorAll('.flag').forEach(f =>
    f.classList.toggle('active', (f as HTMLElement).dataset.lang === l))
  const pdf = document.getElementById('cv-pdf') as HTMLAnchorElement | null
  if (pdf) pdf.href = `/cv/sergio-beltran-coley-${l}.pdf`
}

function cambiarIdioma(l: Lang) {
  if (l === lang) return
  const iris = document.getElementById('iris')!
  const main = document.querySelector('main')!
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) { aplicarIdioma(l); return }
  iris.classList.add('on')
  main.classList.add('lang-fade')
  setTimeout(() => aplicarIdioma(l), 600)
  setTimeout(() => { iris.classList.remove('on'); main.classList.remove('lang-fade') }, 1350)
}
```

- [ ] **Step 3: probar en dev** los dos sentidos del cambio y la persistencia al recargar.
- [ ] **Step 4: Commit** `git commit -m "Sitio personal: i18n ES/EN con banderas y transición iridiscente"`

### Task 6: Interacciones (cursor, clics, scroll, tilt, visor)

**Files:**
- Modify: `sitio-personal/src/main.ts`

- [ ] **Step 1: portar del mockup v3** (adaptado a TS estricto y con guardia `matchMedia('(pointer: fine)')` para cursor/parallax/tilt): cursor punto+anillo, ripple+chispas en clic, barra de progreso, zonas de color por sección, reveals/clip-titles/contadores con IntersectionObserver, línea de tiempo pintándose, tilt 3D.
- [ ] **Step 2: visor de CV accesible**: abrir/cerrar con animación, cierre con Escape y clic fuera, foco atrapado:

```ts
function atraparFoco(modal: HTMLElement) {
  const focusables = modal.querySelectorAll<HTMLElement>('button, a[href], [tabindex]')
  const primero = focusables[0], ultimo = focusables[focusables.length - 1]
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarCV()
    if (e.key !== 'Tab') return
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
  })
}
```

- [ ] **Step 3: probar todo en dev** (cursor, clic en cualquier parte, scroll completo, visor, idiomas).
- [ ] **Step 4: Commit** `git commit -m "Sitio personal: interacciones de mouse, scroll, clic y visor de CV"`

### Task 7: Build, deploy y verificación en vivo

- [ ] **Step 1: build de producción**

Run: `cd sitio-personal && npm run build`
Expected: sin errores TS, `dist/` con index, CSS, JS y `cv/*.pdf`.

- [ ] **Step 2: deploy**

Run: `npx wrangler deploy` (en `sitio-personal/`)
Expected: publica el Worker `website` con las rutas de sergiobc.com.

- [ ] **Step 3: smoke en vivo**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sergiobc.com          # 200
curl -s https://sergiobc.com | grep -o "Sergio Beltrán Coley" | head -1 # contenido nuevo
curl -s -o /dev/null -w "%{http_code}\n" https://sergiobc.com/cv/sergio-beltran-coley-es.pdf # 200
curl -s -o /dev/null -w "%{http_code}\n" https://ideam.sergiobc.com     # 200, intacto
```

- [ ] **Step 4: commit final y PR**

```bash
git add -A && git commit -m "Sitio personal: portafolio animado en vivo en sergiobc.com"
git push -u origin feat/sitio-personal
gh pr create --title "Portafolio personal animado para sergiobc.com" --body "..."
```
