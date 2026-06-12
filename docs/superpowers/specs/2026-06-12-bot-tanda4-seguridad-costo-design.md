# Asistente Hídrico — Tanda 4: seguridad / costo

**Fecha:** 2026-06-12
**Ámbito:** `src/worker/index.js`, `tests/worker.test.mjs`.
**Origen:** auditoría del bot (2026-06-12), Tanda 4 (4 hallazgos).

## Hallazgos y fixes

### #16 — El historial `assistant` no pasa por el guardrail (`handleChat`)
El guardrail solo evalúa `looksLikeManipulation` sobre los turnos `role:"user"`
(`history.some((m) => m.role === "user" && …)`). Un cliente puede fabricar un
turno `assistant` con un jailbreak para envenenar el contexto.

**Fix:** evaluar `looksLikeManipulation` sobre TODOS los turnos entrantes
(`history.some((m) => looksLikeManipulation(m.content))`). El contenido legítimo
del asistente (dominio hídrico) no dispara los patrones (combinaciones de
jailbreak), así que no introduce falsos positivos.

### #17 — Sin validación de `Origin` en `/api/chat`
Otro sitio puede consumir la cuota de Workers AI desde el navegador.

**Fix:** `originPermitido(request)`: si hay header `Origin` y su hostname no es
`ideam.sergiobc.com` / `sergiobc.com` / `localhost` / `127.0.0.1` → 403 antes de
gastar IA. **Origin ausente se permite** (clientes no-browser / same-origin), de
modo que no rompe a los clientes legítimos; el objetivo es atajar el robo de
cuota desde otro sitio en el navegador (que sí envía `Origin`).

### #18 + #19 — DoS del cupo global y llamadas IA no contadas
El tope global diario (`CHAT_GLOBAL_PER_DAY = 250`) cuenta MENSAJES, pero cada
mensaje gasta hasta 3 llamadas IA (extractor + reintento + redactor); además 250
está muy por debajo de la cuota de neuronas y un atacante rotando IP lo agota.

**Fix:** el contador global diario pasa a representar **LLAMADAS IA**
(proxy de neuronas). `kvRateLimited` acepta un `pesoGlobal`; el chat lo consume
con **peso 3** por mensaje (peor caso del pipeline, "descontar al entrar"). El
tope sube a `CHAT_GLOBAL_CALLS_PER_DAY = 1500` (backstop holgado; la protección
real por usuario sigue siendo el límite por IP de 30/hora). Al alcanzarlo, se
degrada con el 429 amable ya existente. *Nota operativa:* para una defensa más
fuerte contra rotación de IP, configurar un rate-limit por IP en el WAF de
Cloudflare (tarea manual del dashboard, fuera de este cambio).

## Tests (`tests/worker.test.mjs`)

- **#16:** un turno `assistant` fabricado con jailbreak + último turno `user`
  limpio → `blocked:true` y 0 llamadas IA.
- **#17:** `Origin` de otro sitio → 403 sin gastar IA; `Origin` propio → no 403.
  (El caso "sin Origin → permitido" ya lo cubren los tests existentes, que no
  envían Origin y reciben 200.)
- **#18/#19:** tras un mensaje exitoso, `rlc:global:day` aumenta en **3** (peso),
  no en 1.

## Gate antes de push (obligatorio)

```
npm run check && npm run typecheck && npm test && node --test tests/chat-data.test.mjs && npm run test:unit && npm run build
```

Deploy por push a `main` con las 4 tandas en un solo push. Sin firmas.
