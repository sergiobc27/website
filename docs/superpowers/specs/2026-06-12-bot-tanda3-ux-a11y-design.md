# Asistente Hídrico — Tanda 3: UX / accesibilidad

**Fecha:** 2026-06-12
**Ámbito:** `src/app/lib/chatUi.ts` (nuevo), `src/app/lib/chatUi.test.ts` (nuevo),
`src/app/components/Asistente.tsx`, `src/app/components/AsistenteFlotante.tsx`.
**Origen:** auditoría del bot (2026-06-12), Tanda 3 (4 hallazgos). Importa para
la demo de sustentación.

## Contexto

No hay `@radix-ui/react-dialog` ni React Testing Library en el proyecto. El
focus-trap se implementa a mano; los tests unitarios (vitest) cubren solo la
**lógica pura** extraída a `chatUi.ts`. Los cambios de DOM/foco se verifican por
`typecheck` + `build` y lectura. `apiJson`/`ApiError` (en `ideamApi.ts`) ya
manejan 429 + `Retry-After`, respuesta HTML y JSON corrupto.

## Hallazgos y fixes

### #12 — CRÍTICO a11y: foco y trap en el panel `role="dialog"` (`AsistenteFlotante.tsx`)
El panel no mueve el foco al abrir, no atrapa Tab ni devuelve el foco al cerrar.

**Fix:** al pasar `open` a true, guardar el elemento con foco previo, mover el
foco al **campo de texto** del panel (fallback: primer focusable). Atrapar Tab:
Shift+Tab en el primer focusable → último; Tab en el último → primero. Al cerrar
(Escape o botón X), devolver el foco al botón flotante. Añadir
`aria-modal="true"`. No se vuelve el fondo `inert` (la conversación debe
sobrevivir al cerrar/abrir y cambiar de pestaña).

### #13 — `fetch` crudo ignora `ApiError`/429 (`Asistente.tsx`)
**Fix:** enrutar el POST `/api/chat` por `apiJson` (pasando el `signal` del
timeout). El `catch` traduce la causa con `formatChatError`, respetando 429 +
`retryAfterSeconds` y el caso HTML.

### #14 — Sin live region (`Asistente.tsx`)
**Fix:** el contenedor de mensajes lleva `role="log" aria-live="polite"
aria-relevant="additions"` para que el lector anuncie las respuestas nuevas. El
indicador "escribiendo" incluye texto `sr-only` ("El asistente está escribiendo
una respuesta…").

### #15 — Reintentar, Copiar, auto-scroll, break-words (`Asistente.tsx`)
- **Reintentar:** guardar la última pregunta fallida; el cuadro de error muestra
  un botón "Reintentar" que la reenvía.
- **Copiar:** cada respuesta del asistente tiene un botón "Copiar"
  (`navigator.clipboard.writeText`) con feedback breve ("Copiado").
- **Auto-scroll:** solo desplazar al fondo si el usuario ya estaba cerca del
  fondo (`cercaDelFondo`), para no pisar un scroll-up manual.
- **break-words:** las burbujas añaden `break-words` para no desbordar a 420px.

No se toca el pulso del botón flotante (ya respeta `prefers-reduced-motion`,
`theme.css:310`).

## Lógica pura (TDD) — `src/app/lib/chatUi.ts`

- `formatChatError(cause: unknown): string`
  - `ApiError` con `status===429`: mensaje de límite; si hay `retryAfterSeconds`,
    incluir "Intenta de nuevo en N s".
  - `ApiError` (otro status): usar `cause.message`.
  - `DOMException`/`Error` con `name==="AbortError"`: mensaje de timeout.
  - Resto: mensaje genérico de no disponible.
- `cercaDelFondo(m: { scrollTop; scrollHeight; clientHeight }, umbral = 120): boolean`
  - `scrollHeight - (scrollTop + clientHeight) <= umbral`.

### Tests (`chatUi.test.ts`, vitest)
- `formatChatError`: 429 con/sin retryAfter; AbortError; ApiError genérico;
  causa desconocida.
- `cercaDelFondo`: al fondo → true; muy arriba → false; justo en el umbral → true.

## Gate antes de push (obligatorio)

```
npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build
```

Deploy por push a `main` junto con Tandas 1, 2 (y 4 si se hace). Sin firmas.

## Fuera de alcance (Tanda 3)

Tanda 4 (Origin en `/api/chat`, DoS del cupo global, tope de llamadas IA/mensaje,
guardrail sobre historial assistant).
