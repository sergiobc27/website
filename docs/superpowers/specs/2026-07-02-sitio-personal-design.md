# Diseño: portafolio personal en sergiobc.com

Fecha: 2026-07-02
Estado: aprobado en brainstorming visual (3 iteraciones de mockup en el acompañante de navegador)

## Objetivo

Reemplazar la página estática actual de sergiobc.com (Worker `website`, sin tocar desde abril) por un portafolio moderno, muy animado e interactivo, que una los cuatro mundos de Sergio: workforce, ingeniería civil, análisis de datos e hidrología. Bilingüe español/inglés.

## Decisiones ya tomadas con el usuario

1. Dirección visual C, "editorial moderno claro": fondo crema, tipografía serif grande estilo revista, acentos terracota, movimiento elegante.
2. Ilustraciones generales que unan los cuatro mundos, sin referencias hiperespecíficas (nada de "curvas IDF" como protagonista).
3. Nombre completo "Sergio Beltrán Coley" arriba a la izquierda, con subtítulo "Ingeniería · Datos · IA".
4. Botones, ilustraciones y tipografía grandes.
5. Animación en tres frentes: scroll, mouse y todos los clics.
6. Hoja de vida en visor interactivo dentro de la página (la descarga PDF queda secundaria dentro del visor).
7. Selector de idioma con banderas de España y Estados Unidos; al cambiar, animación de pantalla completa estilo Apple Intelligence (resplandor iridiscente que recorre el borde de la pantalla mientras el contenido hace crossfade).
8. Repo: carpeta nueva `sitio-personal/` dentro de `sergiobc27/website`, desplegando al Worker existente `website` (ruta `sergiobc.com/*`). La webapp IDEAM no se toca.

## Paleta y tipografía

- Fondo `#faf7f2` (crema), tinta `#1c1a17`, gris `#6b645c`.
- Acentos: terracota `#b0483b`, ocre `#d98e42`, verde `#46695c`, azul agua `#2e6f8e`.
- Titulares: serif (Georgia o similar del sistema; opcional una variable tipo Fraunces si el peso lo justifica). Cuerpo: sans del sistema.
- El fondo cambia de tono por sección (crema → arena → tierra) con transición de 1.2 s.

## Estructura de la página (una sola página, 7 bloques)

1. **Nav fija**: nombre completo + subtítulo a la izquierda; enlaces Mundos, Trayectoria, Proyectos, Hoja de vida, Contacto; selector de idioma con banderas ES/US. Subrayado animado en hover.
2. **Hero**: titular "Ingeniería, datos y personas en movimiento." con palabras que entran una a una; escena SVG ilustrada a pantalla casi completa con capas en parallax al mouse: curvas de terreno, puente que se dibuja solo, río fluyendo (dasharray animado), nodos de datos pulsando conectados al puente, mini dashboard flotante y píldora con tres personas (workforce). Botones grandes "Explorar" y "Hoja de vida".
3. **Marquee**: cinta infinita con los términos Workforce, Ingeniería civil, Análisis de datos, Hidrología, Automatización, IA.
4. **Los cuatro mundos**: 4 tarjetas ilustradas con SVG animados (red de personas, grúa con carga que balancea, barras vivas con curva, gota que cae sobre ondas). Hover con elevación.
5. **Trayectoria**: línea de tiempo vertical que se pinta con el scroll. Foundever (2022-hoy), CUC (2021-hoy, con el trabajo de grado), Uninorte (2020-2021, sismogramas con la Universidad Veracruzana).
6. **Proyectos**: 3 tarjetas con tilt 3D siguiendo el cursor: plataforma hidrológica (enlace a ideam.sergiobc.com), automatizador open source (enlace a PyPI), analítica workforce en Foundever.
7. **Hoja de vida**: contadores animados (3 años en datos, 300 personas, 12 certificaciones, 2 idiomas) + "libro" de páginas apiladas que se abren en abanico al hover y lanzan el visor al clic.
8. **Footer contacto** (oscuro): correo gigante subrayado, LinkedIn, GitHub, plataforma IDEAM, teléfono. Onda animada en el borde superior.

## Interacción global

- **Cursor personalizado**: punto + anillo que persigue con easing; el anillo crece sobre elementos interactivos. En dispositivos táctiles o `prefers-reduced-motion` se usa el cursor nativo y se desactiva.
- **Clic en cualquier parte**: onda expansiva + 9 chispas de los 4 colores de la paleta.
- **Scroll**: barra de progreso superior, reveals escalonados, títulos con efecto cortina (clip), contadores que suben desde 0, línea de tiempo que se pinta, cambio de tono del fondo por sección.
- **Mouse**: parallax multicapa en el hero, tilt 3D en tarjetas de proyectos, botones que saltan levemente.

## Cambio de idioma (ES/EN)

- Toggle en la nav con banderas de España y Estados Unidos (SVG inline, sin dependencias).
- Al cambiar: overlay `position: fixed` con borde iridiscente estilo Apple Intelligence: gradiente cónico animado (azul → violeta → rosa → naranja) con blur y máscara que deja solo el perímetro visible; el resplandor recorre los bordes ~1.2 s mientras el contenido hace crossfade al otro idioma. Con `prefers-reduced-motion`, cambio instantáneo sin overlay.
- Implementación: diccionario i18n (objeto TS con claves ES/EN) que cubre el 100% del texto visible, incluido el contenido del visor de CV. Idioma persistido en `localStorage`, detección inicial por `navigator.language`. Atributo `lang` del documento actualizado.

## Visor de hoja de vida (modal)

- Se abre desde el "libro" o el botón; animación de entrada (translate + scale).
- Pestañas Español/English con banderas; secciones (Perfil, Experiencia, Educación, Certificaciones) que entran escalonadas.
- Las 12 certificaciones en cuadrícula de dos columnas con chulos verdes.
- Enlace secundario "Descargar PDF" que sirve el PDF del idioma activo desde `/cv/sergio-beltran-coley-es.pdf` y `/cv/sergio-beltran-coley-en.pdf` (copiados a `public/`).
- Cierre con ✕, clic fuera o Escape. Foco atrapado dentro del modal mientras está abierto.

## Contenido (fuente: CV ES/EN del usuario, julio 2026)

- Perfil, experiencia Foundever (automatización de reportes con ahorro >50%, dashboards, planificación, liderazgo de cuenta 300+), educación CUC y Uninorte, 12 certificaciones, habilidades, inglés C1.
- Contacto: sergiobeltrancoley@gmail.com, linkedin.com/in/sergiobeltrancoley, github.com/sergiobc27, +57 313 672 64 14 (datos ya públicos en el CV que el propio sitio ofrece).
- SEO: title y meta description bilingües, Open Graph básico.

## Tecnología

- **Stack**: Vite + TypeScript vanilla (sin React; la página es un solo documento y el peso importa). CSS plano con variables. Todo SVG inline.
- **Carpeta**: `sitio-personal/` en la raíz del repo `website`, con su propio `package.json`, `vite.config.ts` y `wrangler.jsonc`.
- **Deploy**: Worker `website` con assets estáticos (Workers Assets), ruta `sergiobc.com/*` en la zona sergiobc.com. Primer despliegue manual con `wrangler deploy` desde `sitio-personal/`; el auto-deploy por push puede configurarse después sin afectar al Worker `ideam`.
- **Presupuesto de rendimiento**: sin librerías de animación (todo CSS + IntersectionObserver + rAF), objetivo Lighthouse ≥ 90 en móvil, JS total < 30 KB gzip.

## Accesibilidad

- `prefers-reduced-motion`: desactiva cursor custom, parallax, marquee, chispas y la animación de idioma.
- Navegación por teclado completa (nav, botones, modal con foco atrapado y Escape).
- Contraste AA en textos sobre crema y sobre tinta.
- HTML semántico (nav, main, section con encabezados, footer).

## Pruebas y verificación

- `npm run build` sin errores y revisión visual local con el dev server.
- Verificación de los dos idiomas, el visor de CV, los enlaces externos y los dos PDFs.
- Tras el deploy: smoke HTTP a sergiobc.com (200, contenido nuevo) y verificación de que ideam.sergiobc.com sigue intacto.

## Fuera de alcance (por ahora)

- Blog o páginas adicionales.
- Formulario de contacto con backend (el correo es mailto).
- Analítica.
- Firma animada como logo (idea anotada de la carpeta "Website Inspiration"; puede añadirse después si el usuario consigue o dibuja su firma en SVG).
