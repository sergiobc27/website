/**
 * "Pregúntale a tus datos": pipeline de dos pasadas del Asistente Hídrico.
 * Pasada 1 (extractor LLM) -> resolución determinista -> fetch al box ->
 * Pasada 2 (redactor LLM con los datos como única fuente numérica).
 * Spec: docs/superpowers/specs/2026-06-11-ia-pregunta-datos-design.md
 */

// Variables consultables -> dataset del espejo. La agregación típica define la
// métrica del cagg: precipitación se SUMA (lámina total), el resto se PROMEDIA.
export const VARIABLES = {
  precipitacion: { id: "s54a-sgyg", etiqueta: "Precipitación", unidad: "mm", metrica: "sum" },
  temperatura_maxima: { id: "ccvq-rp9s", etiqueta: "Temperatura máxima del aire", unidad: "°C", metrica: "avg" },
  temperatura_minima: { id: "afdg-3zpb", etiqueta: "Temperatura mínima del aire", unidad: "°C", metrica: "avg" },
  humedad: { id: "uext-mhny", etiqueta: "Humedad del aire", unidad: "%", metrica: "avg" },
  viento: { id: "sgfv-3yp8", etiqueta: "Velocidad del viento", unidad: "m/s", metrica: "avg" },
  presion: { id: "62tk-nxj5", etiqueta: "Presión atmosférica", unidad: "hPa", metrica: "avg" },
  nivel_rio: { id: "vfth-yucv", etiqueta: "Nivel máximo del río", unidad: "cm", metrica: "avg" },
};

const INTENTS = new Set(["dato_puntual", "idf_tr", "ranking", "estado_plataforma", "ninguno"]);

// Pre-filtro barato: si no huele a datos, el chat queda idéntico a hoy (1 sola
// llamada IA). Generoso a propósito: un falso positivo solo cuesta la mini
// llamada del extractor; un falso negativo pierde la feature en esa pregunta.
const DATA_HINTS = new RegExp(
  [
    "lluvi", "llovi", "llov", "lluev", "precipitaci",
    "temperatura", "humedad", "viento", "presion", "presión", "nivel",
    "cuant", "cuánt", "promedio", "media\\b", "total", "maxim", "máxim", "minim", "mínim",
    "intensidad", "\\btr\\b", "periodo de retorno", "período de retorno", "estacion", "estación",
    "top\\s*\\d", "donde\\s+\\S+\\s+(mas|más|menos)", "dónde", "rank", "compar",
    "actualizado", "frescura", "ultimo dato", "último dato",
    "\\b(19|20)\\d{2}\\b",
  ].join("|"),
  "i",
);

export function pareceConsultaDatos(text) {
  return DATA_HINTS.test(String(text || ""));
}

export function normalizarTexto(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

const NF = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
export function formatearNumero(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "N/D";
  return NF.format(Number(n));
}

function intOrNull(v, min, max) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Llama al box (API propia) con el secreto del proxy. Devuelve null si falla.
// (Vive aquí para compartirlo entre el correo IDF y el chat de datos.)
export async function boxJson(env, path, init) {
  const headers = { accept: "application/json", ...(init && init.headers) };
  if (env.IDEAM_PROXY_SECRET) headers["x-ideam-proxy-secret"] = env.IDEAM_PROXY_SECRET;
  try {
    const r = await fetch(new URL(path, env.API_ORIGIN), { ...init, headers });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function postJson(body) {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

// Resuelve el lugar dicho por el usuario contra los catálogos del espejo.
// Orden: match exacto -> empieza-por -> contiene. Departamento aparte.
export async function resolverLugar(env, { lugar, departamento }) {
  const out = { municipio: null, departamento: null };
  if (departamento) {
    const meta = await boxJson(env, "/api/meta");
    const dep = normalizarTexto(departamento);
    out.departamento = ((meta && meta.departments) || []).find((d) => normalizarTexto(d) === dep) || null;
  }
  if (!lugar) return out;
  const cat = await boxJson(env, "/api/municipalities");
  const lista = (cat && cat.municipalities) || [];
  const objetivo = normalizarTexto(lugar);
  const norm = lista.map((m) => ({ m, n: normalizarTexto(m) }));
  const hit =
    norm.find((x) => x.n === objetivo) ||
    norm.find((x) => x.n.startsWith(objetivo)) ||
    norm.find((x) => x.n.includes(objetivo));
  if (hit) {
    out.municipio = hit.m;
    return out;
  }
  // No encontrado: sugiere por prefijo compartido (4 letras) — barato y útil.
  const pref = objetivo.slice(0, 4);
  out.noEncontrado = lugar;
  out.sugerencias = norm.filter((x) => x.n.startsWith(pref)).slice(0, 3).map((x) => x.m);
  return out;
}

const RANGO_FIABILIDAD = { verde: 3, amarillo: 2, rojo: 1 };

// Estación IDF para un lugar: match por NOMBRE de estación primero (más
// específico), luego por municipio. Desempata por fiabilidad y años válidos.
export function elegirEstacion(stations, lugar) {
  const objetivo = normalizarTexto(lugar);
  if (!objetivo) return null;
  const porNombre = stations.filter((s) => normalizarTexto(s.nombre).includes(objetivo));
  const porMunicipio = stations.filter(
    (s) => normalizarTexto(s.municipio) === objetivo || normalizarTexto(s.municipio).startsWith(objetivo),
  );
  const candidatas = porNombre.length ? porNombre : porMunicipio;
  if (!candidatas.length) return null;
  return [...candidatas].sort(
    (a, b) =>
      (RANGO_FIABILIDAD[b.fiabilidad] || 0) - (RANGO_FIABILIDAD[a.fiabilidad] || 0) ||
      (b.aniosValidos || 0) - (a.aniosValidos || 0),
  )[0];
}

// Ejecuta la consulta del intent contra el box y devuelve un RESUMEN COMPACTO
// (claves en español) que la pasada 2 inyecta como única fuente numérica.
// {ok:false, errorTipo} alimenta la respuesta honesta del redactor.
export async function consultarDatos(env, intent) {
  try {
    switch (intent.intent) {
      case "dato_puntual": return await datoPuntual(env, intent);
      case "idf_tr": return await idfTr(env, intent);
      case "ranking": return await ranking(env, intent);
      case "estado_plataforma": return await estadoPlataforma(env);
      default: return null;
    }
  } catch {
    return { ok: false, errorTipo: "espejo_no_disponible" };
  }
}

async function datoPuntual(env, intent) {
  const lugar = await resolverLugar(env, intent);
  if (intent.lugar && !lugar.municipio) {
    return { ok: false, errorTipo: "lugar_no_encontrado", lugar: intent.lugar, sugerencias: lugar.sugerencias || [] };
  }
  const v = VARIABLES[intent.variable || "precipitacion"];
  const body = {
    datasetId: v.id,
    departments: lugar.departamento ? [lugar.departamento] : [],
    interval: "year",
    metric: v.metrica,
  };
  if (lugar.municipio) body.catalogFilters = { municipalities: [lugar.municipio] };
  if (intent.anioDesde) body.startDate = `${intent.anioDesde}-01-01`;
  if (intent.anioHasta) body.endDate = `${intent.anioHasta}-12-31`;
  const r = await boxJson(env, "/api/analytics/timeseries", postJson(body));
  if (!r) return { ok: false, errorTipo: "espejo_no_disponible" };
  const serie = (r.points || [])
    .filter((p) => p.value !== null)
    .slice(-10)
    .map((p) => ({ anio: Number(String(p.bucket).slice(0, 4)), valor: Math.round(p.value * 10) / 10 }));
  if (!serie.length) {
    return { ok: false, errorTipo: "sin_datos", lugar: lugar.municipio || lugar.departamento || "Colombia" };
  }
  return {
    ok: true,
    datos: {
      tipo: "dato_puntual",
      variable: v.etiqueta,
      agregacion: v.metrica === "sum" ? "total anual" : "promedio anual",
      unidad: v.unidad,
      lugar: lugar.municipio || lugar.departamento || "Colombia (nacional)",
      serie,
    },
  };
}

async function idfTr(env, intent) {
  const cat = await boxJson(env, "/api/analytics/idf-stations");
  if (!cat) return { ok: false, errorTipo: "espejo_no_disponible" };
  const estacion = elegirEstacion(cat.stations || [], intent.lugar || "");
  if (!estacion) return { ok: false, errorTipo: "sin_estacion_idf", lugar: intent.lugar || "" };
  const body = postJson({ datasetId: "s54a-sgyg", departments: [], catalogFilters: { stations: [estacion.codigo] } });
  const [idf, rp] = await Promise.all([
    boxJson(env, "/api/analytics/idf", body),
    boxJson(env, "/api/analytics/return-periods", body),
  ]);
  if (!idf || !idf.available) return { ok: false, errorTipo: "sin_estacion_idf", lugar: intent.lugar || "" };
  const tr = intent.tr || 25;
  // Curva y cuantil del Tr pedido (o los más cercanos disponibles).
  const masCercano = (lista) =>
    (lista || []).reduce(
      (mejor, x) => (!mejor || Math.abs(x.returnPeriod - tr) < Math.abs(mejor.returnPeriod - tr) ? x : mejor),
      null,
    );
  const curva = masCercano(idf.curves);
  const quantil = masCercano(rp && rp.quantiles);
  return {
    ok: true,
    datos: {
      tipo: "idf_tr",
      estacion: { codigo: estacion.codigo, nombre: estacion.nombre, municipio: estacion.municipio, departamento: estacion.departamento },
      aniosDeSerie: idf.nYears || estacion.aniosValidos,
      fiabilidad: rp && rp.reliability ? { nivel: rp.reliability.level, motivos: (rp.reliability.reasons || []).slice(0, 3) } : null,
      trPedido: intent.tr,
      trUsado: curva ? curva.returnPeriod : null,
      idf: curva ? curva.points.map((p) => ({ duracionMin: p.durMin, intensidadMmH: Math.round(p.intensityMmH * 10) / 10 })) : [],
      [`tr${curva ? curva.returnPeriod : tr}`]: quantil
        ? { lluviaDiariaMm: quantil.value, ic90: quantil.lower !== undefined ? [quantil.lower, quantil.upper] : null }
        : null,
    },
  };
}

async function ranking(env, intent) {
  const v = VARIABLES[intent.variable || "precipitacion"];
  const topN = intent.topN || 5;
  if (intent.departamento || intent.lugar) {
    const lugar = await resolverLugar(env, intent);
    const dep = lugar.departamento || null;
    if (!dep) {
      return { ok: false, errorTipo: "lugar_no_encontrado", lugar: intent.departamento || intent.lugar, sugerencias: lugar.sugerencias || [] };
    }
    const r = await boxJson(env, "/api/analytics/by-station", postJson({ datasetId: v.id, departments: [dep] }));
    if (!r) return { ok: false, errorTipo: "espejo_no_disponible" };
    const filas = (r.stations || [])
      .filter((s) => s.mean !== null)
      .sort((a, b) => b.mean - a.mean)
      .slice(0, topN)
      .map((s) => ({ nombre: `${s.code} (${s.municipality || "N/D"})`, promedio: Math.round(s.mean * 10) / 10 }));
    if (!filas.length) return { ok: false, errorTipo: "sin_datos", lugar: dep };
    return { ok: true, datos: { tipo: "ranking", alcance: dep, variable: v.etiqueta, unidad: v.unidad, ranking: filas } };
  }
  const r = await boxJson(env, "/api/analytics/by-region", postJson({ datasetId: v.id, departments: [] }));
  if (!r) return { ok: false, errorTipo: "espejo_no_disponible" };
  const filas = (r.regions || [])
    .filter((x) => x.mean !== null)
    .sort((a, b) => b.mean - a.mean)
    .slice(0, topN)
    .map((x) => ({ nombre: x.department, promedio: Math.round(x.mean * 10) / 10, estaciones: x.stationCount }));
  return {
    ok: true,
    datos: { tipo: "ranking", alcance: "nacional (por departamento)", variable: v.etiqueta, unidad: `${v.unidad} (promedio por observación)`, ranking: filas },
  };
}

async function estadoPlataforma(env) {
  const meta = await boxJson(env, "/api/meta");
  if (!meta) return { ok: false, errorTipo: "espejo_no_disponible" };
  return {
    ok: true,
    datos: {
      tipo: "estado_plataforma",
      datasetsDisponibles: (meta.datasets || []).length,
      departamentosCubiertos: (meta.departments || []).length,
      ultimaObservacion: (meta.dataFreshness && meta.dataFreshness.latestObservation) || null,
      ultimaSincronizacion: (meta.dataFreshness && meta.dataFreshness.lastSync) || null,
      totalObservacionesAprox: "más de 760 millones",
    },
  };
}

export const SUGERENCIAS_PROMPT = `ÚLTIMA LÍNEA OBLIGATORIA (para la interfaz, invisible al usuario): termina SIEMPRE tu respuesta con una línea EXACTAMENTE así:
>>>SUGERENCIAS: ["pregunta 1", "pregunta 2", "pregunta 3"]
con 2 o 3 preguntas de seguimiento cortas (máximo 80 caracteres cada una) que el usuario podría hacerte a continuación, coherentes con la conversación y SIEMPRE dentro de tu alcance (hidrología, los datos del IDEAM o el uso de la plataforma). No menciones, expliques ni comentes esta línea: solo escríbela al final.`;

// Quita la(s) línea(s) ">>>..." del final del reply y devuelve las sugerencias
// saneadas. Robusto ante un modelo desobediente: sin marker -> [], JSON roto -> [].
export function extraerSugerencias(raw) {
  const text = String(raw || "");
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trim().startsWith(">>>"));
  if (idx === -1) return { reply: text.trim(), suggestions: [] };
  const reply = lines.slice(0, idx).join("\n").trim();
  let suggestions = [];
  const m = lines.slice(idx).join("\n").match(/\[[\s\S]*?\]/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim().slice(0, 80))
          .slice(0, 3);
      }
    } catch {
      /* JSON roto -> sin sugerencias; el fallback decide */
    }
  }
  return { reply, suggestions };
}

const FALLBACKS = {
  dato_puntual: ["¿Y cómo se compara con el año anterior?", "¿Cuál es la estación más cercana con curvas IDF?", "¿Dónde veo la serie completa en la plataforma?"],
  idf_tr: ["¿Qué tan confiable es la serie de esa estación?", "¿Cómo uso esa intensidad en el método racional?", "¿Qué advierte la norma RAS sobre el Tr de diseño?"],
  ranking: ["¿Y el top de estaciones de un departamento?", "¿Por qué llueve tanto en el Pacífico?", "¿Cómo exporto esos datos?"],
  estado_plataforma: ["¿Cada cuánto se actualizan los datos?", "¿Cuántas estaciones tienen curvas IDF?", "¿De dónde vienen los datos?"],
  conceptual: ["¿Qué es un período de retorno?", "¿Cómo interpreto una curva IDF?", "¿Cuánto llovió en mi ciudad el año pasado?"],
};

export function sugerenciasFallback(intent) {
  return FALLBACKS[(intent && intent.intent) || "conceptual"] || FALLBACKS.conceptual;
}

// Acepta el resultado del extractor venga como venga (objeto, JSON string o
// JSON embebido en prosa) y lo reduce a un intent SANEADO o null.
export function parseIntentJson(raw) {
  let obj = raw;
  if (typeof raw === "string") {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || !INTENTS.has(obj.intent)) return null;
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
  return {
    intent: obj.intent,
    lugar: str(obj.lugar),
    departamento: str(obj.departamento),
    variable: Object.prototype.hasOwnProperty.call(VARIABLES, obj.variable) ? obj.variable : null,
    anioDesde: intOrNull(obj.anioDesde, 1950, 2100),
    anioHasta: intOrNull(obj.anioHasta, 1950, 2100),
    tr: intOrNull(obj.tr, 2, 500),
    topN: intOrNull(obj.topN, 1, 10),
  };
}
