# Spec: "La historia del dato" — Scrollytelling IDF

**Fecha:** 2026-06-11 · **Estado:** aprobada por Sergio (audiencia, ubicación, mecánica y diseño; nombre y estación delegados)

## Objetivo

Vista narrativa guiada por scroll (`/historia`) que cuenta, para **jurados y público general**,
cómo la lluvia cruda de 10 minutos del IDEAM se convierte en curvas IDF reales — el
diferenciador científico de la tesis. Espectacular para la sustentación, didáctica para
cualquiera; el rigor técnico va en el texto, no en jerga. Costo cero: sin dependencias
nuevas, sin llamadas a la API durante el scroll.

## Decisiones aprobadas

- **Audiencia:** jurados + público general (didáctico; nada de jerga sin explicar).
- **Ubicación:** vista nueva `historia` ("La historia del dato") en el sidebar (grupo
  Explorar), ruta compartible `/historia`.
- **Datos:** estación demo FIJA con datos **embebidos** en un módulo commiteado;
  la elige un script generador por criterio técnico: fiabilidad 🟢 con más `aniosValidos`
  (desempate: más observaciones). Cero red durante la narrativa.
- **Mecánica:** gráfica sticky que se TRANSFORMA al avanzar el texto (IntersectionObserver
  nativo; estilo NYT). Móvil: gráfica sticky arriba, texto debajo.

## Las 8 escenas (una sola `GraficaViva` que muta)

| # | Escena | Gráfica | Texto clave |
|---|---|---|---|
| 1 | Gancho | Portada con metadatos de la estación (nombre, municipio, 🟢, años) | "¿Qué tan fuerte puede llover aquí? De esa respuesta depende el tamaño de cada alcantarillado, cuneta y puente." |
| 2 | El pulso de la lluvia | Hietograma real de 10 min de una tormenta memorable | "El IDEAM registra la lluvia cada 10 minutos. Esto es una tormenta real vista de cerca." |
| 3 | El diferenciador | La misma tormenta: 1 barra diaria vs sus pulsos de 10 min | "La práctica común estima desagregando el dato diario; esta plataforma usa los pulsos reales." (argumento de la tesis) |
| 4 | Décadas de tormentas | Serie de máximos anuales de 24 h (scatter por año, `stationYears`) | "De cada año guardamos su peor tormenta de 24 horas." |
| 5 | Domar el azar | Los máximos ordenados + ajuste Gumbel → probabilidad/Tr | "Tr=25 años NO es 'cada 25 años': es 4% de probabilidad cada año." |
| 6 | Nacen las curvas | Curvas IDF dibujándose por Tr, con bandas IC 90% | "Lo que antes tomaba semanas de cálculo manual sale aquí de los datos reales." |
| 7 | La fórmula | Ecuación ajustada I=K·T^m/D^n con valores reales + R² (`Formula.tsx`) | "Una sola expresión resume décadas de lluvia." (Vargas & Díaz-Granados, 1998) |
| 8 | De la curva al diseño | Mini método racional Q=C·I·A con una intensidad de la curva | Advertencia normativa (RAS 0330/INVÍAS, orientativo) + CTA "Explora tu estación →" (Hidrología) y "Pregúntale al asistente 💬" (abre el widget). |

Barra de progreso de lectura fija arriba. Pie con cita de la fuente y fecha de generación
del dataset embebido.

## Datos embebidos

- `scripts/generar-historia-idf.mjs` (se corre manualmente UNA vez, requiere red):
  1. `GET /api/analytics/idf-stations` → elige la estación (🟢, máx `aniosValidos`).
  2. `POST /api/analytics/idf` y `/return-periods` → curvas, ecuación, bandas, máximos
     anuales (`stationYears`), Gumbel (`gumbel.mu/beta`), fiabilidad.
  3. Tormenta de 10 min: localiza el año del máximo anual más alto y trae las
     observaciones crudas de ese día (`POST /api/preview` con estación+fecha; un día =
     ≤144 filas, bajo el límite de 200). Si preview no lo permite, fallback documentado:
     usar el día completo del `stationYears` con mayor `maximum` y construir el
     hietograma con `/api/analytics/timeseries` (interval day) NO sirve para 10 min →
     en ese caso el script falla con mensaje claro (no degradar en silencio).
  4. Valida el shape y escribe `src/app/data/historiaIdf.ts` (objeto tipado exportado,
     ~30-60 KB) con `generadoEl` (fecha ISO) y `fuente`.
- La vista consume SOLO ese módulo. Si en el futuro se regenera, mismo script.

## Arquitectura frontend

| Pieza | Responsabilidad |
|---|---|
| `src/app/data/historiaIdf.ts` | Dataset embebido tipado (generado, commiteado) |
| `src/app/lib/historia.ts` | Lógica pura testeable: tipos de escena, derivaciones de datos por escena (hietograma agregado, puntos Gumbel, etc.) |
| `src/app/components/HistoriaIdf.tsx` | Vista: layout sticky (texto izquierda / gráfica derecha; móvil apilado), 8 `<section>` con los textos, barra de progreso, CTA final |
| `src/app/components/historia/GraficaViva.tsx` | Recharts único que recibe `escena` (1-8) y rinde la variante con transición 550ms (convención del repo) |
| Hook `useEscenaActiva` (en `lib/historia.ts` o el componente) | IntersectionObserver: sección más visible → escena activa |
| `App.tsx` / `Sidebar.tsx` / `navigation.ts` | Vista `historia` en VIEWS (lazy), entrada del sidebar grupo Explorar (icono `BookOpenText`), breadcrumb "La historia del dato" |

## Accesibilidad

- `prefers-reduced-motion`: el cambio de escena intercambia la gráfica SIN animar (el
  neutralizador global de theme.css ya cubre las animaciones de Recharts/CSS).
- Las gráficas llevan `aria-hidden`; el contenido equivalente vive en el texto de cada
  escena (la narrativa ES la alternativa textual).
- Texto real seleccionable, tokens de contraste existentes, scroll por teclado natural.
- El asistente flotante sigue disponible encima (z-index ya resuelto).

## Testing y verificación

- Vitest (`src/app/lib/historia.test.ts`): selección de escena activa (lógica del
  observer extraída pura), derivaciones de datos (hietograma, puntos de Gumbel,
  ordenación de máximos), y validación del shape del dataset embebido.
- El script generador valida contra los contratos antes de escribir el archivo.
- Verificación: typecheck + build + suite completa; Playwright contra producción con
  screenshots de las escenas 1, 2-3, 6 y 8 en desktop y móvil para aprobación visual.

## Fuera de alcance (YAGNI)

Narración por audio, estación elegible en vivo, i18n, exportar la historia a PDF,
scroll-snap obligatorio (scroll libre).
