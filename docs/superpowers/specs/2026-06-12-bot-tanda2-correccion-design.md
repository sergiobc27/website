# Asistente Hídrico — Tanda 2: corrección

**Fecha:** 2026-06-12
**Ámbito:** `src/worker/chatData.js`, `src/worker/index.js`, `tests/chat-data.test.mjs`, `tests/worker.test.mjs`
**Origen:** auditoría multiagente del bot (2026-06-12), Tanda 2 (6 hallazgos).
**Depende de:** Tanda 1 (`2026-06-12-bot-tanda1-defendibilidad-design.md`).

## Hallazgos y fixes

### #6 — Confusión de unidades IDF/Tr (`chatData.js` `idfTr`)
`idfTr` entrega `idf[].intensidadMmH` (intensidad mm/h por duración, de la curva
IDF) y, bajo `tr<N>`, `lluviaDiariaMm` (lámina mm para ese período de retorno):
magnitudes distintas que el 8B mezcla.

**Fix:** renombrar `lluviaDiariaMm` → `laminaMaxDiariaMm`. En `promptDeDatos`
(rama ok, tipo `idf_tr`) añadir una instrucción que distinga "intensidad (mm/h)
por duración" de "lámina máxima diaria (mm) para ese Tr — no las mezcles ni
sumes". Actualizar el test `consultarDatos idf_tr…` al nuevo nombre de clave.

### #7 — Rango de años sin validar
`parseIntentJson` (`chatData.js`) permite `anioDesde > anioHasta` y años fuera
de 2001–actual → el box devuelve una serie vacía en silencio.

**Fix:**
- `parseIntentJson`: si `anioDesde` y `anioHasta` están y `anioDesde > anioHasta`,
  **intercambiarlos** (puro, testeable).
- `datoPuntual`: si el rango cae totalmente fuera de cobertura
  (`anioHasta < ANIO_MIN` con `ANIO_MIN = 2001`, o `anioDesde > añoActual` vía
  `new Date().getUTCFullYear()`), devolver
  `{ ok:false, errorTipo:"rango_fuera_de_cobertura", desde, hasta }` antes de
  consultar el box.

### #8 — Grounding no verificado post-hoc (verificación anclada a unidades)
El bloque "DATOS REALES" no impide que el redactor escriba una cifra inventada.

**Fix (alta precisión, anclado a unidades):** función pura
`cifrasConUnidadFueraDe(reply, numerosPermitidos)`:
- Detecta en el cuerpo números con **unidad física pegada**: `mm/h`, `mm`,
  `°C`/`ºC`, `m/s`, `hPa`, `cm`. Ignora años, Tr y porcentajes.
- Parsea el número en formato es-CO (`1.234,5` → `1234.5`; `823,4` → `823.4`)
  y plano.
- `numerosPermitidos` = todos los números del bloque
  `JSON.stringify(resultado.datos)` (parseados a float).
- Una cifra del cuerpo "coincide" si hay un número permitido dentro de
  tolerancia de redondeo: `|a−b| ≤ max(0.5, 0.01·|b|)` o redondeos iguales.
- Si alguna cifra con unidad NO coincide con ninguna permitida → hay cifra sin
  respaldo.

`handleChat`: cuando `dataUsed`, si `cifrasConUnidadFueraDe(reply, …)` es cierto
y el texto no lo advierte ya, anexar (vía `insertarAntesDelCierre`) un caveat
suave: *"ℹ️ Confirma las cifras exactas en la pestaña correspondiente; algún
número podría no provenir directamente de los datos consultados."* No reescribe
ni borra: solo advierte (la acción es de bajo riesgo ante falsos positivos).

### #9 — Cobertura parcial confiada al modelo (`chatData.js` `datoPuntual`)
El aviso "pocos datos" lo redacta el 8B. Debe garantizarlo el código.

**Fix:** en `datoPuntual` (solo precipitación, `v.metrica === "sum"`, donde el
conteo de 10-min tiene sentido: un año-estación completo ≈ 50.000 obs) marcar
`datos.coberturaParcial = true` si algún año de la serie mostrada trae
`observaciones < UMBRAL_OBS_ANUAL` (30.000). `handleChat`: si `dataUsed` y
`datos.coberturaParcial` y el texto no menciona ya "parcial", anexar un caveat
determinista de cobertura.

### #10 — Municipios homónimos (`chatData.js` `resolverLugar`)
El fallback nacional (paso 2) toma la primera estación que coincide por
municipio, aunque el nombre exista en varios departamentos.

**Fix:** en el paso 2, reunir las estaciones cuyo municipio coincide
**exactamente** con el objetivo; si abarcan **≥2 departamentos distintos**,
devolver `{ ambiguo:true, municipio:<primero>, opcionesDepartamento:[…] }`.
`datoPuntual` (y `ranking`): si `lugar.ambiguo`, devolver
`{ ok:false, errorTipo:"municipio_ambiguo", lugar, opciones }`. El caso de match
único conserva el comportamiento actual (no rompe los deepEqual existentes).

### #11 — Tests sin red
Añadir cobertura a `extraerIntencion` (las 2 pasadas: JSON mode y fallback
plano) y a `promptDeDatos` (bloque ok + cada `errorTipo`, incluidos
`rango_fuera_de_cobertura` y `municipio_ambiguo`).

## `promptDeDatos` — nuevas razones

- `rango_fuera_de_cobertura`: explicar que el espejo cubre 2001–actualidad y
  pedir un rango dentro de ese período (sin inventar cifras).
- `municipio_ambiguo`: indicar que hay varios municipios con ese nombre en
  distintos departamentos (listarlos) y pedir al usuario que precise cuál.

## Tests

- **chat-data.test.mjs:** actualizar `idf_tr` a `laminaMaxDiariaMm`; nuevos:
  `parseIntentJson` intercambia rango invertido; `datoPuntual`
  `rango_fuera_de_cobertura`; `datoPuntual` `coberturaParcial`; `resolverLugar`
  ambigüedad → `ambiguo`; `consultarDatos` `municipio_ambiguo`; `promptDeDatos`
  (ok idf_tr con aclaración de unidades + cada errorTipo); `extraerIntencion`
  (JSON mode ok; fallback plano cuando el JSON mode falla).
- **worker.test.mjs:** `cifrasConUnidadFueraDe` (cifra con unidad ausente →
  true; presente con redondeo → false; año/Tr/porcentaje → ignorados);
  integración: respuesta con dato real y cifra-mm fuera del bloque → lleva el
  caveat.

## Gate antes de push (obligatorio)

```
npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build
```

Deploy por push a `main` junto con la Tanda 1 (decisión de Sergio: desplegar las
dos tandas en un solo push). Sin firmas en commits.

## Fuera de alcance (Tanda 2)

Tandas 3 (a11y del panel flotante, 429, Reintentar/Copiar) y 4 (Origin, DoS del
cupo global, tope de llamadas IA/mensaje).
