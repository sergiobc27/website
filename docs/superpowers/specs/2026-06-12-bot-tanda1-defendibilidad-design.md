# Asistente Hídrico — Tanda 1: defendibilidad académica

**Fecha:** 2026-06-12
**Ámbito:** `src/worker/index.js`, `src/worker/chatData.js`, `tests/worker.test.mjs`
**Origen:** auditoría multiagente del bot (2026-06-12), Tanda 1 (5 hallazgos deterministas).

## Problema

El asistente usa Workers AI Llama 3.1 8B. El diseño es sólido (guardrail
determinista pre-LLM, rechazo + fuente por código, listas blancas, grounding,
costo \$0). Pero hay cinco fallos que erosionan la **defendibilidad académica**
de la tesis: el bot puede presentar como autoritativa una cifra/constante que
el 8B inventó, en algunos casos blindada con una cita APA real.

1. **CRÍTICO — `ensureReferencia` blinda cifras inventadas con cita APA real**
   (`index.js:265`). Detecta "Kirpich"/"RAS"/"Manning" en el texto y anexa la
   cita verificada aunque la constante de la fórmula sea alucinada → alucinación
   con sello bibliográfico.
2. **Dato curioso inventado se respeta** (`index.js:230`). `ensureDatoCurioso`
   solo añade uno si falta; no valida el que escribió el modelo.
3. **Sin red para constantes en fórmulas.** Limitación del 8B; hoy sin
   mitigación determinista.
4. **"Dashboard" no existe en la UI.** El prompt (`index.js:137`, `:146`) y
   `VISTA_LABELS` (`chatData.js:401`) dicen "Dashboard"; la pestaña real se
   llama **"Panel general"** (`Sidebar.tsx:19`, `Dashboard.tsx:56`, breadcrumb
   `App.tsx:115`). El `id` interno (`dashboard`) y el componente (`Dashboard`)
   no cambian: solo la etiqueta visible al usuario.
5. **Sin `ensureDisclaimer`.** La nota "orientativo, no sustituye diseño
   normado" está en el system prompt pero el 8B la omite.

## Decisión de diseño

Para #1, #3 y #5 (el mismo problema de fondo: constantes/fórmulas que pueden
estar alucinadas) se eligió **disclaimer unificado y escalado** por código, en
vez de neutralizar constantes con regex sobre LaTeX (frágil: rompería los
exponentes 2/3 y 1/2 de Manning o la forma IDF) o de dejar de auto-citar los
métodos (pierde la cita en menciones conceptuales legítimas).

La cita APA **se conserva** (apunta a dónde verificar), pero **nunca queda sin
caveat**: cuando hay una constante numérica de un método dependiente de
unidades, el disclaimer escala a "verifica las constantes y unidades en la
fuente". Eso convierte el riesgo (#1) en una práctica académicamente honesta.

## Diseño

### Pipeline de post-proceso (`handleChat`)

Orden nuevo:

```
limpiarFugasDeJson → ensureDisclaimer → ensureReferencia → ensureDatoCurioso → (📊 Fuente)
```

Helper compartido nuevo, `insertarAntesDelCierre(text, bloque)`: inserta
`bloque` justo antes de la primera línea que empiece por `💡`/`📚` (o las
etiquetas "Dato curioso:"/"Referencia:"); si no hay ninguna, lo añade al final.
Lo usan `ensureDisclaimer` y `ensureReferencia`, de modo que el orden de lectura
queda **body → ⚠️ disclaimer → 📚 Referencia → 💡 Dato curioso**. Esto también
corrige el quirk previo por el que la referencia auto-añadida caía DESPUÉS del
dato curioso.

### `ensureDisclaimer(reply)` — nueva, determinista (#1, #3, #5)

Reglas:
- No toca el mensaje de rechazo (`/solo puedo ayudarte con esta plataforma/i`).
- **Detección de fórmula** (`hasFormula`): `$$…$$`, o `$…\cmd…$` con un comando
  LaTeX dentro, o presencia de `\dfrac|\frac|\sqrt|\cdot`.
- **Términos de diseño** (`terminosDiseno`): acciones de diseño —
  `dimension`, `pre-?dimensionamiento`, `dise[ñn]o de`, `caudal de dise[ñn]o`,
  `periodo de retorno de dise[ñn]o`. (Lista corta y orientada a acción para no
  dispararse en explicaciones conceptuales.)
- **Métodos con constantes dependientes de unidades** (`metodoConstantes`):
  `Kirpich`, `Témez`, `Manning`, `SCS`, `número de curva`, `método racional`.
- **Constante numérica presente** (`tieneNumero`): hay fórmula con dígitos, o un
  decimal tipo `\d+[.,]\d+` en el texto.

Comportamiento:
- `baseNeeded = hasFormula || terminosDiseno`
- `escalado = metodoConstantes && (hasFormula || decimal)`
- Si ni base ni escalado → devuelve el texto sin cambios.
- Antiduplicado: si el texto ya contiene `/no\s+sustituy|no\s+reemplaz|orientativ/i`
  no se añade la base; si ya contiene `/verifi.*(constante|unidad)/i` no se
  añade la escalada.
- Línea(s) a insertar (vía `insertarAntesDelCierre`):
  - **Escalada** (una sola línea combinada que cubre ambos casos):
    > ⚠️ Verifica las constantes y sus unidades directamente en la fuente citada;
    > este resultado es orientativo y no sustituye el diseño normado (RAS 0330 /
    > INVÍAS) ni el criterio de un ingeniero.
  - **Base** (solo si no hubo escalada):
    > ⚠️ Esto es orientativo y no sustituye el diseño normado (RAS 0330 / INVÍAS)
    > ni el criterio de un ingeniero.

### `ensureReferencia(reply)` — ajuste de inserción (#1)

Misma detección de la lista `REFERENCIAS`. Cambio: cuando auto-añade la(s)
línea(s) `📚 Referencia:`, lo hace con `insertarAntesDelCierre` (antes del dato
curioso) en vez de concatenar al final. Sigue: no toca el rechazo, no duplica si
ya hay `📚`, máximo 2.

### `ensureDatoCurioso(reply)` — validación (#2)

Tras `colapsarDatoCurioso`:
- No toca el rechazo.
- Localiza la etiqueta `💡 Dato curioso:` (tolerando `**`).
- **Si existe:** extrae el texto que la sigue, lo normaliza (minúsculas, sin
  tildes) y lo compara con `FIRMAS_DATO_CURIOSO` (subcadenas distintivas, una o
  más por dato verificado). Si **coincide alguna** → se respeta. Si **no
  coincide ninguna** → es inventado → se reemplaza esa línea por un dato
  verificado al azar (se conserva el cuerpo de la respuesta).
- **Si no existe:** se añade uno verificado al final (comportamiento actual).

`FIRMAS_DATO_CURIOSO` (normalizadas): `"760 millones"`, `"10 minutos"`,
`"vargas"`, `"diaz-granados"`, `"universidad de la costa"`,
`"tesis de ingenieria civil"`, `"alcantarillado"`, `"igualado o superado"`,
`"1% de probabilidad"`.

### Fix #4 — "Panel general"

- `chatData.js` `VISTA_LABELS.dashboard`: `"Dashboard"` → `"Panel general"`.
- `index.js` system prompt línea de pestañas: `Dashboard,` → `Panel general,`.
- `index.js` system prompt mapa exacto: `- "Dashboard": resumen general del
  espejo de datos.` → `- "Panel general": resumen general del espejo de datos.`

### Exports

`index.js` pasa a exportar también `ensureDisclaimer`, `ensureDatoCurioso`,
`ensureReferencia` (hoy solo exporta `looksLikeManipulation`) para poder
testearlas como unidades.

## Tests (TDD, `tests/worker.test.mjs`)

Nuevos casos unitarios:
- **ensureDisclaimer:** fórmula `$$Q = C \cdot I \cdot A$$` → línea base
  presente; `Kirpich` + decimal `Tc = 0.0195·…` → línea escalada ("verifica las
  constantes") presente; texto conceptual sin fórmula/método → sin cambios;
  rechazo → sin cambios; texto que ya dice "no sustituye" → no duplica.
- **ensureDatoCurioso:** inventado (p. ej. "💡 Dato curioso: En Bogotá llovió
  999 mm en 2050") → reemplazado por uno verificado; verificado (contiene
  "760 millones") → intacto; ausente → añadido; rechazo → intacto.
- **ensureReferencia:** reply con `💡 Dato curioso` del modelo y mención de
  "Kirpich" sin `📚` → la `📚 Referencia` queda ANTES del `💡`.
- **VISTA_LABELS.dashboard === "Panel general"** (importado en el test).

Regresión: el test de integración `POST /api/chat` actual (respuesta
"Hola, soy el tutor.", sin fórmula ni método) sigue verde: `ensureDisclaimer`
no dispara, `ensureReferencia` no dispara, `ensureDatoCurioso` añade uno → la
respuesta sigue empezando por "Hola, soy el tutor." y conteniendo
`💡 Dato curioso:`.

## Gate antes de push (obligatorio)

```
npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build
```

Deploy por push a `main` (GitHub Actions). Sin firmas en commits.

## Fuera de alcance (Tanda 1)

Tandas 2–4 de la auditoría (corrección de unidades IDF/Tr, validación de rango
de años, a11y del panel flotante, manejo de 429, Origin, DoS del cupo global).
