# Asistente Hídrico — "Dónde estoy" (ubicación del usuario)

**Fecha:** 2026-06-12
**Ámbito:** `src/app/lib/geo.ts` (nuevo) + `geo.test.ts`, `src/app/components/Asistente.tsx`,
`src/worker/index.js`, `src/worker/chatData.js`, tests del worker.
**Origen:** el usuario quiere preguntar "¿cuánto llueve aquí / donde estoy?" y que
el bot responda sin tener que nombrar el lugar. Hoy no funciona porque el bot no
recibe ninguna ubicación.

## Decisión

Ubicación por **geolocalización del navegador** (la pidió el usuario). El cálculo
de la **estación más cercana** se hace **en el frontend** con `stations.geojson`
(ya cacheado en el edge; 17.972 estaciones con coords + municipio + departamento).
Al Worker se le manda **solo el lugar resuelto** (`{municipio, departamento,
estacion}`), NO las coordenadas → las coordenadas nunca salen del navegador
(privacidad) y el Worker no descarga MBs por mensaje.

## Arquitectura

### Frontend
- **`src/app/lib/geo.ts`** (puro, testeable con vitest):
  - `estacionMasCercana(coords: {lat, lng}, features): { nombre, municipio, departamento } | null`
    — distancia equirectangular (corrigiendo lng por cos(lat)); recorre las
    features `{geometry:{coordinates:[lng,lat]}, properties:{nombre,municipio,departamento}}`
    y devuelve la propiedad de la más cercana; `null` si no hay features o coords inválidas.
- **`Asistente.tsx`**:
  - Botón **"📍 Usar mi ubicación"**. Al pulsarlo: `geoEstado='pidiendo'` →
    `navigator.geolocation.getCurrentPosition`.
    - Éxito → fetch `apiUrl('/api/stations.geojson')` (cacheado) UNA vez →
      `estacionMasCercana` → guarda `ubicacion {municipio, departamento, estacion}` →
      `geoEstado='activa'`; muestra un chip "📍 {municipio}" con una "x" para quitarla.
    - Error/negado/sin soporte → `geoEstado='error'` + mensaje inline ("no pudimos
      obtener tu ubicación; nombra el lugar").
  - Mientras `ubicacion` esté activa, `ejecutarConsulta` incluye `ubicacion` en el
    body de `/api/chat`.

### Worker
- **Validación/saneo** de `body.ubicacion`: objeto con `municipio`/`departamento`/
  `estacion` string; cada campo `String(...).replace(/\s+/g,' ').trim().slice(0,80)`;
  si falta municipio y departamento → se ignora. (Viene del cliente: se trata como
  no confiable; al inyectarlo se sanea longitud y saltos de línea para no abrir
  inyección de prompt, y de todos modos `resolverLugar` lo coteja contra el catálogo.)
- **Contexto:** si hay `ubicacion`, añadir a `systemParts` una línea
  `CONTEXTO DE UBICACIÓN: el usuario está cerca de {estacion} en {municipio}, {departamento}. Si pregunta por "aquí", "mi zona" o "donde estoy", usa ese lugar.`
- **`mencionaAqui(text)`** (en `chatData.js`, puro/testeable): detecta
  `aquí/acá/mi (zona|ciudad|municipio|región)/donde (estoy|vivo)/por aquí/cerca de mí`
  (sobre texto sin tildes).
- **Sustitución en el pipeline:** tras `extraerIntencion`, si hay `ubicacion`, el
  intent es de datos y (`mencionaAqui(últimoMensaje)` **o** el intent no trae
  `lugar` ni `departamento`), rellenar `intent.lugar = ubicacion.municipio` e
  `intent.departamento = ubicacion.departamento` ANTES de `consultarDatos`. Así
  "¿cuánto llueve aquí?" resuelve al municipio del usuario y el pipeline existente
  responde con datos reales.

## Degradación y errores
- Sin permiso / sin soporte / geojson caído → no se activa la ubicación; el bot
  pide nombrar el lugar (comportamiento actual). Nada se rompe.
- `ubicacion` inválida en el body → el Worker la ignora.

## Privacidad
Las coordenadas GPS solo se usan en el navegador para hallar el municipio; al
servidor solo viaja el municipio/departamento/estación resueltos. No se almacenan.

## Tests
- **vitest (`geo.test.ts`)**: `estacionMasCercana` elige la más cercana entre varias;
  catálogo vacío → null; coords inválidas → null.
- **node (`chat-data` / `worker`)**: `mencionaAqui` (positivos: "llueve aquí",
  "mi zona", "donde estoy"; negativos: "aquí está el dato" no debe forzar — ver
  nota); sustitución "aquí → ubicación" rellena el intent; integración: body con
  `ubicacion` + pregunta "¿cuánto llueve aquí?" → el prompt del redactor lleva el
  CONTEXTO DE UBICACIÓN y la consulta usa ese municipio.

> Nota sobre falsos positivos de `mencionaAqui`: se evalúa sobre la PREGUNTA del
> usuario (no sobre respuestas), y la sustitución solo aplica a intents de datos;
> el peor caso de un falso positivo es resolver al municipio del usuario en vez de
> pedirlo, que es justo el comportamiento deseado.

## Gate antes de push (obligatorio)
```
npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build
```
Deploy por push a `main`. Sin firmas.

## Fuera de alcance
Reverse-geocoding por servicio externo (usamos el catálogo propio); recordar la
ubicación entre sesiones; mostrar un mapa en el asistente.
