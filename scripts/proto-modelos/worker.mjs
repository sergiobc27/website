// PROTOTIPO LOCAL (no se despliega): compara modelos de Workers AI en la tarea
// que más le cuesta al bot —extraer la intención de una pregunta de datos, con
// inferencia de geografía— y mide tokens -> neuronas por modelo. Reusa el MISMO
// system prompt y JSON schema del extractor real (copiados aquí para que el
// prototipo sea autónomo y no toque el código de producción).
//
// Correr (tras `wrangler login`):
//   cd scripts/proto-modelos && npx wrangler dev
//   # en otra terminal:  curl -s http://localhost:8787 | jq .
//
// El binding AI siempre corre contra Workers AI real (remoto). El gasto del
// banco completo (~6 casos x 4 modelos) es de unas pocas decenas de neuronas.

// Tarifas oficiales (neuronas por millón de tokens) — docs Cloudflare 2026-06.
const MODELOS = {
  "@cf/meta/llama-4-scout-17b-16e-instruct": { in: 24545, out: 77273, alias: "scout (actual)" },
  "@cf/qwen/qwen3-30b-a3b-fp8": { in: 4625, out: 30475, alias: "qwen3-30b (barato)" },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { in: 26668, out: 204805, alias: "llama-3.3-70b" },
  "@cf/openai/gpt-oss-120b": { in: 31818, out: 68182, alias: "gpt-oss-120b" },
};

const EXTRACTOR_SYSTEM = `Extrae de la ÚLTIMA pregunta del usuario una intención de consulta sobre datos hidrometeorológicos de Colombia. Responde SOLO un objeto JSON con EXACTAMENTE estas claves: {"intent":"dato_puntual"|"idf_tr"|"ranking"|"estado_plataforma"|"ninguno","lugar":string|null,"departamento":string|null,"variable":"precipitacion"|"temperatura_maxima"|"temperatura_minima"|"humedad"|"viento"|"presion"|"nivel_rio"|null,"anioDesde":number|null,"anioHasta":number|null,"tr":number|null,"topN":number|null}
Reglas: "ninguno" si es conceptual o de uso de la plataforma. "departamento" = el departamento colombiano del lugar si lo sabes con certeza por geografía general (Barranquilla -> Atlántico, Medellín -> Antioquia) o si el usuario lo menciona; null si no. "temperatura" sin más -> "temperatura_maxima". Un solo año -> anioDesde=anioHasta. No inventes valores: usa null.`;

const INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["dato_puntual", "idf_tr", "ranking", "estado_plataforma", "ninguno"] },
    lugar: { type: ["string", "null"] },
    departamento: { type: ["string", "null"] },
    variable: { type: ["string", "null"], enum: ["precipitacion", "temperatura_maxima", "temperatura_minima", "humedad", "viento", "presion", "nivel_rio", null] },
    anioDesde: { type: ["integer", "null"] },
    anioHasta: { type: ["integer", "null"] },
    tr: { type: ["integer", "null"] },
    topN: { type: ["integer", "null"] },
  },
  required: ["intent"],
};

// Banco de casos con la respuesta esperada (para puntuar acierto de intención +
// geografía). El ejemplo de Sergio (Barranquilla, rango de años) va primero.
const CASOS = [
  { q: "oye, ¿cuánto llovió en Barranquilla entre 2018 y 2022?", esperado: { intent: "dato_puntual", departamento: "Atlántico", variable: "precipitacion", anioDesde: 2018, anioHasta: 2022 } },
  { q: "¿cuál fue el año más caluroso en Medellín?", esperado: { intent: "dato_puntual", departamento: "Antioquia", variable: "temperatura_maxima" } },
  { q: "dame el top 5 de estaciones más lluviosas de Antioquia", esperado: { intent: "ranking", departamento: "Antioquia", topN: 5 } },
  { q: "¿cuál es la curva IDF de Soledad para un período de retorno de 25 años?", esperado: { intent: "idf_tr", tr: 25 } },
  { q: "¿qué tan actualizado está el espejo de datos?", esperado: { intent: "estado_plataforma" } },
  { q: "¿qué es un período de retorno?", esperado: { intent: "ninguno" } },
];

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function parseIntent(raw) {
  let o = raw;
  if (typeof raw === "string") {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { o = JSON.parse(m[0]); } catch { return null; }
  }
  return o && typeof o === "object" ? o : null;
}

function puntuar(got, esp) {
  if (!got) return { intentOk: false, geoOk: false, detalle: "no parseó JSON" };
  const intentOk = got.intent === esp.intent;
  // Geografía/campos clave: solo evaluamos los que el caso espera.
  let geoOk = true;
  for (const k of ["departamento", "variable", "anioDesde", "anioHasta", "tr", "topN"]) {
    if (esp[k] === undefined) continue;
    if (k === "departamento") geoOk = geoOk && norm(got[k]) === norm(esp[k]);
    else geoOk = geoOk && String(got[k] ?? "") === String(esp[k]);
  }
  return { intentOk, geoOk };
}

const neuronas = (usage, tarifa) => {
  const pin = (usage?.prompt_tokens ?? 0) * tarifa.in / 1e6;
  const pout = (usage?.completion_tokens ?? 0) * tarifa.out / 1e6;
  return Math.round((pin + pout) * 100) / 100;
};

export default {
  async fetch(_req, env) {
    const reporte = [];
    for (const [modelo, tarifa] of Object.entries(MODELOS)) {
      const fila = { modelo, alias: tarifa.alias, casos: [], aciertosIntent: 0, aciertosGeo: 0, neuronasTotal: 0, errores: 0 };
      for (const caso of CASOS) {
        const messages = [{ role: "system", content: EXTRACTOR_SYSTEM }, { role: "user", content: caso.q }];
        let out = null, usage = null, err = null;
        try {
          const r = await env.AI.run(modelo, { messages, max_tokens: 200, response_format: { type: "json_schema", json_schema: INTENT_SCHEMA } });
          out = r && r.response != null ? r.response : r;
          usage = r && r.usage;
        } catch (e1) {
          // Reintento en modo plano si el modelo no soporta json_schema.
          try {
            const r = await env.AI.run(modelo, { messages, max_tokens: 200 });
            out = r && r.response != null ? r.response : r;
            usage = r && r.usage;
          } catch (e2) { err = String(e2?.message || e2); }
        }
        const got = err ? null : parseIntent(out);
        const score = puntuar(got, caso.esperado);
        if (err) fila.errores++;
        if (score.intentOk) fila.aciertosIntent++;
        if (score.geoOk) fila.aciertosGeo++;
        const n = neuronas(usage, tarifa);
        fila.neuronasTotal += n;
        fila.casos.push({ q: caso.q, got, ...score, neuronas: n, usage, err });
      }
      fila.neuronasTotal = Math.round(fila.neuronasTotal * 100) / 100;
      fila.neuronasPorCaso = Math.round((fila.neuronasTotal / CASOS.length) * 100) / 100;
      reporte.push(fila);
    }
    // Resumen ordenado por aciertos de intención y luego costo.
    const resumen = reporte
      .map((f) => ({ modelo: f.alias, intent: `${f.aciertosIntent}/${CASOS.length}`, geo: `${f.aciertosGeo}/${CASOS.length}`, neuronas_por_msg: f.neuronasPorCaso, errores: f.errores }))
      .sort((a, b) => parseInt(b.intent) - parseInt(a.intent) || a.neuronas_por_msg - b.neuronas_por_msg);
    return Response.json({ resumen, detalle: reporte }, { headers: { "content-type": "application/json; charset=utf-8" } });
  },
};
