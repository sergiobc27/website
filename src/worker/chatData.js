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
