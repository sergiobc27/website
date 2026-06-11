# Spec: "Pregúntale a tus datos" — Asistente Hídrico v2

**Fecha:** 2026-06-11 · **Estado:** aprobada por Sergio (diseño + 2 añadidos UX)

## Objetivo

Extender el Asistente Hídrico (Workers AI, llama-3.1-8b) para que responda preguntas con
**datos reales del espejo** (764M observaciones, PostgreSQL/TimescaleDB vía la API del box),
y convertirlo en un **widget flotante** disponible en toda la app con **chips de preguntas
de seguimiento**. Restricción dura: **costo cero** (sin recursos nuevos, dentro de las cuotas
free de Workers AI / Workers / KV).

## Alcance aprobado

Capacidades (las 4): consultas puntuales (lluvia/temperatura de un lugar y periodo),
hidrología técnica (IDF/Tr con semáforo de fiabilidad), comparaciones/rankings, y estado de
la plataforma. UX: mismo chat, transparente (el asistente decide cuándo consultar datos).

**Fuera de alcance (YAGNI):** memoria entre sesiones, gráficas generadas por el bot,
consultas multi-paso encadenadas, command palette.

## Arquitectura: dos pasadas estructuradas (Worker, edge)

Módulo nuevo `src/worker/chatData.js`; `handleChat` en `index.js` lo orquesta.
El contrato HTTP de `/api/chat` se EXTIENDE (compatible hacia atrás):

- Request: `{ messages, view? }` — `view` opcional, validado contra whitelist de vistas,
  para que el asistente sepa qué pestaña mira el usuario ("estás viendo Hidrología").
- Response: `{ reply, suggestions?: string[], dataUsed?: boolean, usage }`.

### Flujo de un mensaje

1. **Guardrail anti-manipulación actual** (`looksLikeManipulation`) — sin cambios, corre primero.
2. **Rate-limit actual** — sin cambios (1 mensaje = 1 unidad, KV).
3. **Pre-filtro determinista (gratis):** regex/keywords generosas (llovió, cuánto, temperatura,
   intensidad, Tr, estación, promedio, top, dónde, años de 4 dígitos, …). Si no matchea →
   flujo actual de 1 sola llamada (costo idéntico a hoy para preguntas conceptuales).
4. **Pasada 1 — extractor:** llamada corta a llama-3.1-8b (prompt propio, `max_tokens` bajo,
   `response_format` JSON) → `{ intent, lugar, departamento, variable, anio|periodo, tr, topN }`.
   Intents: `dato_puntual | idf_tr | ranking | estado_plataforma | ninguno`.
   JSON inválido o `ninguno` → degrada al flujo actual.
5. **Resolución determinista (sin IA):** normaliza lugar (tildes/case) y resuelve contra
   `/api/municipalities` o `/api/analytics/idf-stations` (GETs ya cacheados en el edge).
   Varias estaciones → elige la de mejor fiabilidad y LO DICE en la respuesta.
   No encontrado → prepara hasta 3 sugerencias parecidas (sin llamar al modelo a adivinar).
6. **Consulta al box** (`boxJson()`, el mismo helper del correo): mapeo fijo intent→endpoint:
   - `dato_puntual` → `/api/analytics/summary-stats` para agregados de un periodo ("¿cuánto
     llovió en X en 2023?"); `/timeseries` (interval year/month) solo si piden evolución
     ("¿cómo ha cambiado…?")
   - `idf_tr` → `/api/analytics/idf` + `/api/analytics/return-periods` (1 estación; incluye
     `reliability` y bandas IC — el asistente DEBE mencionar el semáforo si es 🔴)
   - `ranking` → `/api/analytics/by-region` o `/by-station` (topN ≤ 10)
   - `estado_plataforma` → `/api/meta` (+ `datasets-overview`)
   Payloads acotados, números formateados es-CO (punto miles, coma decimal) por código.
7. **Pasada 2 — redactor:** `CHAT_SYSTEM` actual + bloque
   `DATOS REALES DEL ESPEJO (única fuente válida de cifras; si falta algo, dilo y remite a la pestaña): {json compacto}`.
   Post-proceso existente (`ensureReferencia`, `ensureDatoCurioso`) intacto. Cuando hubo datos,
   el CÓDIGO (no el modelo) anexa la línea final
   `📊 Fuente: espejo de datos IDEAM (consulta en vivo)` y marca `dataUsed: true`.

### Errores (siempre degradan, nunca rompen)

| Falla | Respuesta |
|---|---|
| Pre-filtro no matchea | Chat conceptual idéntico a hoy |
| Pasada 1 inválida / intent `ninguno` | Chat conceptual idéntico a hoy |
| Lugar no resuelto | Pide precisión con ≤3 sugerencias; no inventa |
| Box caído / timeout | "No pude consultar el espejo ahora" + remite a la pestaña |
| Pasada 2 falla | Mismo 502 actual |

## Chips de preguntas de seguimiento

- El system prompt instruye terminar SIEMPRE con una última línea
  `>>>SUGERENCIAS: ["…","…","…"]` (2-3 preguntas de seguimiento coherentes con la conversación).
- El Worker **extrae y elimina** esa línea del `reply` (regex robusta: cualquier línea final que
  empiece con `>>>`), parsea el JSON, sanea (máx 3, ≤80 chars c/u, strings planos) y lo devuelve
  en `suggestions`.
- **Fallback determinista** si el modelo no cumplió: sugerencias por intent (p. ej. tras un
  `dato_puntual`: "¿Y cómo se compara con el año anterior?", "¿Curvas IDF de la estación más
  cercana?") o lista rotativa por defecto en preguntas conceptuales.
- **Excepción:** respuestas bloqueadas por el guardrail o que sean el mensaje de rechazo exacto
  NO llevan sugerencias (`suggestions` vacío) — el rechazo se mantiene literal, sin añadidos.
  La línea `>>>` se elimina del reply SIEMPRE, cumpla o no el modelo.
- Frontend: chips bajo el último mensaje del asistente; click = enviar esa pregunta. Los chips
  de bienvenida actuales (estado vacío) se mantienen.

## Widget flotante (frontend)

- **Botón flotante** abajo a la derecha en TODAS las vistas: gradiente de marca + icono Sparkles,
  animación sutil de pulso/glow (token `shadow-glow`), **deshabilitada bajo
  `prefers-reduced-motion`** (convención TANDA 1). `aria-label`, focus-visible.
- Click → **panel flotante** anclado abajo-derecha (~400px, max-height ~70vh; en móvil ocupa
  el ancho). Reusa el componente de chat actual (se extrae el contenido de `Asistente.tsx` a
  un panel). Esc y botón ✕ cierran. El estado del chat vive a nivel `App` → **la conversación
  sobrevive** al navegar entre pestañas y al cerrar/abrir el panel.
- El panel envía `view` (vista actual) en cada mensaje para el contexto "qué estoy viendo".
- **Navegación:** la entrada "Asistente" del sidebar deja de ser vista y pasa a ABRIR el panel.
  `asistente` sale de `VIEWS`; shim de compatibilidad: URL vieja con `view=asistente` →
  dashboard + panel abierto (mismo patrón del shim de Ficha).
- El botón flotante no debe tapar contenido interactivo (offset y `z-index` cuidadosos;
  en vistas con mapa, revisar solape con controles de zoom).

## Seguridad y costo

- Guardrail y rate-limit actuales sin cambios; `view` validado por whitelist; valores del box
  truncados antes de inyectar al prompt (los nombres de estación son datos propios, riesgo bajo).
- Neurons: ~2x solo en preguntas de datos; pico real actual ≈ 90 msgs/semana vs tope 250/día
  → <5% de la cuota free. Sin KV/bindings/recursos nuevos. Latencia extra aceptada (~1-3s) solo
  en preguntas de datos.

## Testing (TDD)

- `tests/chat-data.test.mjs` (node:test, `env.AI`/`fetch` mockeados): pre-filtro (±),
  parseo/validación del intent JSON, resolución de lugares (tildes, "Bogotá D.C.", municipio
  sin estación, ambigüedad), mapeo intent→endpoint, los caminos de error de la tabla,
  extracción/sanitización de `>>>SUGERENCIAS` (incluye modelo desobediente), línea de fuente,
  y red-team (lugar malicioso con instrucciones inyectadas).
- Los 20 tests actuales del worker pasan sin tocar. Vitest para la lógica de frontend extraíble.
- Verificación visual final con Playwright (botón flotante, panel, chips) para aprobación de Sergio.

## Componentes tocados

| Pieza | Cambio |
|---|---|
| `src/worker/chatData.js` | NUEVO: pre-filtro, extractor, resolución, fetch, formato es-CO, sugerencias |
| `src/worker/index.js` | `handleChat` orquesta; system prompt + instrucción de sugerencias |
| `src/app/components/Asistente.tsx` | Se convierte en panel reutilizable + chips de seguimiento |
| `src/app/components/AsistenteFlotante.tsx` | NUEVO: botón flotante + contenedor del panel |
| `src/app/App.tsx`, `Sidebar.tsx`, `lib/navigation.ts` | Estado del panel a nivel App; sidebar abre panel; quitar vista `asistente` + shim URL |
| `tests/chat-data.test.mjs` | NUEVO |
