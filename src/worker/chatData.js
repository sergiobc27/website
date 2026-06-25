/**
 * "Pregúntale a tus datos": pipeline de dos pasadas del Asistente Hídrico.
 * Pasada 1 (extractor LLM) -> resolución determinista -> fetch al box ->
 * Pasada 2 (redactor LLM con los datos como única fuente numérica).
 * Spec: docs/superpowers/specs/2026-06-11-ia-pregunta-datos-design.md
 */

import { MUNICIPIO_DEPARTAMENTO } from "./gazetteerMunicipios.js";

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
    "temperatura", "humedad", "humed", "viento", "presion", "presión", "nivel",
    "cuant", "cuánt", "promedio", "media\\b", "total", "maxim", "máxim", "minim", "mínim",
    "intensidad", "\\btr\\b", "periodo de retorno", "período de retorno", "estacion", "estación",
    "top\\s*\\d", "donde\\s+\\S+\\s+(mas|más|menos)", "dónde", "rank", "compar",
    "actualizado", "frescura", "ultimo dato", "último dato",
    // Formas naturales adicionales (un falso positivo solo cuesta la mini llamada
    // del extractor; un falso negativo pierde la feature en esa pregunta).
    "calor", "calient", "frio", "frío", "grado", "record", "récord",
    "historic", "histórico", "histor", "serie", "evolucion", "evolución", "tendencia",
    "seco", "sequi", "lluev", "cayo", "cayó", "agua", "sopla", "rafaga", "ráfaga", "caudal",
    "\\b(19|20)\\d{2}\\b",
  ].join("|"),
  "i",
);

export function pareceConsultaDatos(text) {
  return DATA_HINTS.test(String(text || ""));
}

// ¿la pregunta se refiere a la ubicación del usuario ("aquí", "mi zona", "donde
// estoy")? Se evalúa sobre texto sin tildes. Para el flujo "dónde estoy".
export function mencionaAqui(text) {
  const t = normalizarTexto(text).toLowerCase();
  return /\baqui\b|\baca\b|mi (zona|ciudad|municipio|pueblo|region|departamento)|donde (estoy|vivo)|por aqui|cerca de mi\b/.test(t);
}

export function normalizarTexto(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

// Geografía DETERMINISTA: departamento de un municipio según la tabla generada
// del propio espejo (scripts/build-gazetteer.mjs). Quita la dependencia de que
// el modelo "sepa" que Barranquilla es del Atlántico. null si no es único/no existe.
export function departamentoDeMunicipio(lugar) {
  if (!lugar) return null;
  return MUNICIPIO_DEPARTAMENTO[normalizarTexto(lugar)] || null;
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

function matchLista(lista, objetivo) {
  const norm = lista.map((m) => ({ m, n: normalizarTexto(m) }));
  const hit =
    norm.find((x) => x.n === objetivo) ||
    norm.find((x) => x.n.startsWith(objetivo)) ||
    norm.find((x) => x.n.includes(objetivo));
  return hit ? hit.m : null;
}

// Resuelve el lugar dicho por el usuario contra los catálogos del espejo.
// OJO: /api/municipalities EXIGE department (sin él responde 400), así que el
// camino exacto necesita el departamento (lo da el usuario o lo infiere el
// extractor por geografía general). Fallback nacional: el catálogo de
// estaciones IDF (GET cacheado, ~770 filas) trae municipio+departamento.
export async function resolverLugar(env, { lugar, departamento }) {
  const out = { municipio: null, departamento: null };
  // Si el modelo no dio el departamento, dedúcelo del municipio con el gazetteer
  // determinista. Así "Barranquilla" resuelve aunque el modelo no sepa geografía.
  const dep = departamento || departamentoDeMunicipio(lugar);
  if (dep) {
    const meta = await boxJson(env, "/api/meta");
    const depN = normalizarTexto(dep);
    out.departamento = ((meta && meta.departments) || []).find((d) => normalizarTexto(d) === depN) || null;
  }
  if (!lugar) return out;
  const objetivo = normalizarTexto(lugar);
  // 1) Con departamento conocido, el catálogo de municipios es exacto y completo.
  if (out.departamento) {
    const cat = await boxJson(env, `/api/municipalities?department=${encodeURIComponent(out.departamento)}`);
    const hit = matchLista((cat && cat.municipalities) || [], objetivo);
    if (hit) {
      out.municipio = hit;
      return out;
    }
  }
  // 2) Fallback nacional: municipios del catálogo IDF (cubre las cabeceras con
  //    estaciones de lluvia, que es donde de verdad hay datos que mostrar).
  const idf = await boxJson(env, "/api/analytics/idf-stations");
  const stations = (idf && idf.stations) || [];
  // Municipio homónimo: el mismo nombre EXACTO en ≥2 departamentos y sin
  // departamento que desempate. No adivinamos: marcamos ambiguo para pedirlo.
  if (!out.departamento) {
    const exactos = stations.filter((s) => normalizarTexto(s.municipio) === objetivo);
    const depsExactos = [...new Set(exactos.map((s) => s.departamento).filter(Boolean))];
    if (exactos.length && depsExactos.length > 1) {
      out.ambiguo = true;
      out.municipio = exactos[0].municipio;
      out.opcionesDepartamento = depsExactos;
      return out;
    }
  }
  const porMunicipio = stations.find((s) => {
    const n = normalizarTexto(s.municipio);
    return n === objetivo || n.startsWith(objetivo);
  });
  if (porMunicipio) {
    out.municipio = porMunicipio.municipio;
    out.departamento = out.departamento || porMunicipio.departamento || null;
    return out;
  }
  // 3) No encontrado: sugerencias por prefijo compartido (4 letras).
  const pref = objetivo.slice(0, 4);
  out.noEncontrado = lugar;
  out.sugerencias = [...new Set(
    stations.map((s) => s.municipio).filter((m) => normalizarTexto(m).startsWith(pref)),
  )].slice(0, 3);
  return out;
}

const RANGO_FIABILIDAD = { verde: 3, amarillo: 2, rojo: 1 };

// En el catálogo real `fiabilidad` puede ser un objeto {level, reasons...}
// (Lote 2.1) o un string en datos antiguos/tests: aceptar ambos.
function nivelFiabilidad(s) {
  const f = s && s.fiabilidad;
  return (f && typeof f === "object" ? f.level : f) || null;
}

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
      (RANGO_FIABILIDAD[nivelFiabilidad(b)] || 0) - (RANGO_FIABILIDAD[nivelFiabilidad(a)] || 0) ||
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

// Bajo este promedio de observaciones/año la cobertura municipal ENGAÑA: un
// año completo de UNA estación de 10 min ronda 52.000 obs; el caso real
// "Barranquilla 2023 = 9 mm" tenía 11.523 (≈22% de un año). Con menos de
// ~60% de una estación-año se amplía al departamento y SE DICE.
const UMBRAL_OBS_ANUAL = 30000;

// El espejo de datos arranca en 2001 (ver DATOS CURIOSOS). Un rango por debajo
// de este piso no tiene observaciones que mostrar.
const ANIO_MIN = 2001;

function resumirSerie(points) {
  return (points || [])
    .filter((p) => p.value !== null)
    .slice(-10)
    .map((p) => ({
      anio: Number(String(p.bucket).slice(0, 4)),
      valor: Math.round(p.value * 10) / 10,
      observaciones: p.n || 0,
    }));
}

async function datoPuntual(env, intent) {
  // #7 — rango de años totalmente fuera de cobertura (2001–actual): avisar en
  // vez de consultar el box y devolver una serie vacía en silencio.
  const anioActual = new Date().getUTCFullYear();
  if (
    (intent.anioHasta != null && intent.anioHasta < ANIO_MIN) ||
    (intent.anioDesde != null && intent.anioDesde > anioActual)
  ) {
    return { ok: false, errorTipo: "rango_fuera_de_cobertura", desde: intent.anioDesde, hasta: intent.anioHasta };
  }
  const lugar = await resolverLugar(env, intent);
  // #10 — municipio homónimo: pedir que precise en vez de elegir uno arbitrario.
  if (lugar.ambiguo) {
    return { ok: false, errorTipo: "municipio_ambiguo", lugar: intent.lugar, opciones: lugar.opcionesDepartamento || [] };
  }
  if (intent.lugar && !lugar.municipio) {
    return { ok: false, errorTipo: "lugar_no_encontrado", lugar: intent.lugar, sugerencias: lugar.sugerencias || [] };
  }
  const v = VARIABLES[intent.variable || "precipitacion"];
  const esPrecip = v.metrica === "sum";
  const body = {
    datasetId: v.id,
    departments: lugar.departamento ? [lugar.departamento] : [],
    interval: "year",
    metric: v.metrica,
  };
  if (intent.anioDesde) body.startDate = `${intent.anioDesde}-01-01`;
  if (intent.anioHasta) body.endDate = `${intent.anioHasta}-12-31`;

  let serie = null;
  let lugarMostrado;
  let nota;
  let estUsada = null; // estación representativa usada (para deep-links de acciones)

  // PRECIPITACIÓN municipal -> SIEMPRE la estación representativa del municipio.
  // Sumar todas las estaciones del municipio sobreestima (más estaciones = total
  // mayor, físicamente imposible: p. ej. Soledad 2018 = 152.191 mm) y promediar
  // tampoco aplica a una lámina. El total anual de UNA estación es la lluvia real
  // de ese punto. (Las curvas IDF ya usaban estación; esto alinea el dato puntual.)
  if (lugar.municipio && esPrecip) {
    const cat = await boxJson(env, "/api/analytics/idf-stations");
    const est = cat ? elegirEstacion(cat.stations || [], lugar.municipio) : null;
    if (est) {
      const rEst = await boxJson(
        env,
        "/api/analytics/timeseries",
        postJson({ ...body, departments: [], catalogFilters: { stations: [est.codigo] } }),
      );
      const serieEst = rEst ? resumirSerie(rEst.points) : [];
      if (serieEst.length) {
        serie = serieEst;
        estUsada = est;
        lugarMostrado = `estación ${est.nombre} (${est.municipio})`;
        nota = `Para "${lugar.municipio}" se muestran los datos de su estación representativa (${est.nombre}): es la precipitación real de un punto, NO la suma de todas las estaciones del municipio (que sobreestima). Menciónalo al responder.`;
      }
    }
  }

  // Resto: variables de PROMEDIO a escala municipal (promediar estaciones SÍ
  // aplica), consultas departamentales/nacionales, o precipitación de un
  // municipio sin estación en el catálogo IDF.
  if (!serie) {
    if (lugar.municipio) body.catalogFilters = { municipalities: [lugar.municipio] };
    const r = await boxJson(env, "/api/analytics/timeseries", postJson(body));
    if (!r) return { ok: false, errorTipo: "espejo_no_disponible" };
    serie = resumirSerie(r.points);
    lugarMostrado = lugar.municipio || lugar.departamento || "Colombia (nacional)";
  }

  if (!serie.length) {
    return { ok: false, errorTipo: "sin_datos", lugar: lugar.municipio || lugar.departamento || "Colombia" };
  }
  // #9 — cobertura parcial garantizada por CÓDIGO (solo precipitación: 10-min,
  // un año-estación completo ≈ 50.000 obs; en promedios el conteo bajo es normal).
  const coberturaParcial = esPrecip && serie.some((p) => (p.observaciones || 0) < UMBRAL_OBS_ANUAL);
  return {
    ok: true,
    datos: {
      tipo: "dato_puntual",
      variable: v.etiqueta,
      agregacion: esPrecip ? "total anual" : "promedio anual",
      unidad: v.unidad,
      lugar: lugarMostrado,
      ...(nota ? { nota } : {}),
      ...(coberturaParcial ? { coberturaParcial: true } : {}),
      serie,
    },
    // Identificadores para los botones de acción (deep-links). Fuera de `datos`
    // para no ensuciar el bloque que ve el redactor.
    ref: {
      departamento: lugar.departamento || (estUsada && estUsada.departamento) || null,
      estacionCodigo: (estUsada && estUsada.codigo) || null,
      estacionNombre: (estUsada && estUsada.nombre) || null,
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
        ? { laminaMaxDiariaMm: quantil.value, ic90: quantil.lower !== undefined ? [quantil.lower, quantil.upper] : null }
        : null,
    },
    ref: {
      departamento: estacion.departamento || null,
      estacionCodigo: estacion.codigo,
      estacionNombre: estacion.nombre,
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

// Vistas a las que un botón de acción puede deep-linkear (whitelist de seguridad).
// "map" se usa en el fallback (buscar el lugar cuando no se pudo resolver).
const ACCION_VIEWS = new Set(["hydro", "analytics", "extractor", "map"]);

function limpiarParams(o) {
  const out = {};
  for (const [k, val] of Object.entries(o)) {
    if (val === undefined || val === null || val === "") continue;
    out[k] = String(val).slice(0, 60);
  }
  return out;
}

// Construye DETERMINISTAMENTE los botones de acción (deep-links) a partir del
// intent resuelto y del resultado de datos. El modelo NO interviene → enlaces y
// params siempre verificados. Devuelve [] si no hubo datos válidos.
export function construirAcciones(intent, resultado) {
  if (!intent || !resultado || !resultado.ok) return [];
  const tipo = (resultado.datos || {}).tipo;
  const ref = resultado.ref || {};
  const v = VARIABLES[intent.variable || "precipitacion"];
  const datasetId = v.id;
  const varParam = datasetId !== "s54a-sgyg" ? datasetId : undefined; // precip es el default
  const years = intent.anioDesde && intent.anioHasta ? `${intent.anioDesde}-${intent.anioHasta}` : undefined;
  const acc = [];
  if (tipo === "idf_tr" && ref.estacionCodigo) {
    acc.push({
      label: `Ver la curva IDF de ${ref.estacionNombre || "la estación"} →`.slice(0, 60),
      view: "hydro",
      params: limpiarParams({ est: ref.estacionCodigo }),
    });
  }
  if (tipo === "dato_puntual" && ref.departamento) {
    acc.push({
      label: "Ver la serie en Analítica →",
      view: "analytics",
      params: limpiarParams({ dep: ref.departamento, var: varParam, years }),
    });
  }
  if ((tipo === "dato_puntual" || tipo === "idf_tr") && (ref.departamento || ref.estacionCodigo)) {
    acc.push({
      label: "Descargar estos datos en el Extractor →",
      view: "extractor",
      // var SIEMPRE explícito: el Extractor no tiene precip como default (su
      // default es el primer dataset del catálogo), a diferencia de Analítica.
      params: limpiarParams({ var: datasetId, dep: ref.departamento || undefined, est: ref.estacionCodigo || undefined, years }),
    });
  }
  return acc.filter((a) => ACCION_VIEWS.has(a.view)).slice(0, 3);
}

// Botones de redirección cuando la consulta de datos NO pudo responder (lugar no
// hallado, sin datos, espejo caído...). El bot igual ofrece DÓNDE verlo en la
// plataforma. Determinista (no lo arma el modelo). [] para conceptual/estado.
export function construirAccionesFallback(intent, _resultado) {
  if (!intent) return [];
  const tipo = intent.intent;
  if (tipo === "ninguno" || tipo === "estado_plataforma") return [];
  if (tipo === "idf_tr") {
    return [{ label: "Búscala en Hidrología →", view: "hydro", params: {} }];
  }
  // dato_puntual / ranking
  const v = VARIABLES[intent.variable || "precipitacion"];
  const varParam = v.id !== "s54a-sgyg" ? v.id : undefined; // precip es el default de Analítica
  const years = intent.anioDesde && intent.anioHasta ? `${intent.anioDesde}-${intent.anioHasta}` : undefined;
  const dep = intent.departamento ? normalizarTexto(intent.departamento) : undefined;
  if (dep) {
    return [{ label: "Explóralo en Analítica →", view: "analytics", params: limpiarParams({ dep, var: varParam, years }) }];
  }
  // Sin departamento que pueda fijar el filtro: que busque el lugar en el mapa.
  return [{ label: "Búscalo en el Mapa de Estaciones →", view: "map", params: {} }];
}

export const SUGERENCIAS_PROMPT = `ÚLTIMA LÍNEA OBLIGATORIA (para la interfaz, invisible al usuario): termina SIEMPRE tu respuesta con una línea EXACTAMENTE así:
>>>SUGERENCIAS: ["pregunta 1", "pregunta 2", "pregunta 3"]
con 2 o 3 preguntas de seguimiento cortas (máximo 80 caracteres cada una) que el usuario podría hacerte a continuación, coherentes con la conversación y SIEMPRE dentro de tu alcance (hidrología, los datos del IDEAM o el uso de la plataforma). No menciones, expliques ni comentes esta línea: solo escríbela al final.`;

// Texto de salida de Workers AI, robusto al modelo: unos devuelven `{response}`
// y otros el estilo OpenAI `{choices:[{message:{content}}]}` (o anidado en
// `{result}` vía REST). Así un cambio de modelo no vuelve a romper el bot.
// Formato es-CO: pasa a coma los decimales de 1-2 dígitos PEGADOS a una unidad
// física (174.6 mm/h → 174,6 mm/h). Dirigido a propósito: no toca separadores de
// miles (3 dígitos: 10.681) ni constantes dentro de fórmulas LaTeX (sin unidad
// pegada), evitando romper números o el render de KaTeX.
export function normalizarDecimalesEsCO(text) {
  return String(text || "").replace(
    /(\d{1,3})\.(\d{1,2})(?=\s?(?:mm\/h|mm|°C|ºC|cm|m\/s|m³\/s|hPa|%))/g,
    "$1,$2",
  );
}

export function textoDeIA(result) {
  if (!result || typeof result !== "object") return "";
  const r = result.result && typeof result.result === "object" ? result.result : result;
  if (typeof r.response === "string") return r.response;
  const choice = Array.isArray(r.choices) ? r.choices[0] : null;
  const content = choice && choice.message && choice.message.content;
  return typeof content === "string" ? content : "";
}

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

// Red de seguridad determinista: si el modelo transcribe el bloque JSON de
// datos en su respuesta (visto en producción: lo citaba como "Referencia"),
// se eliminan esas líneas — el usuario nunca debe ver el JSON interno.
export function limpiarFugasDeJson(reply) {
  return String(reply || "")
    .split("\n")
    .filter((l) => !/\{\s*"tipo"\s*:/.test(l) && !/referencia\s*:\s*\{/i.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

// Vistas válidas para el contexto "qué está mirando el usuario" (whitelist:
// el cliente no puede inyectar texto arbitrario al prompt vía `view`).
export const VISTA_LABELS = {
  dashboard: "Panel general",
  analytics: "Analítica",
  map: "Mapa de Estaciones",
  compare: "Comparador",
  ficha: "Ficha Climática",
  hydro: "Hidrología",
  historia: "La historia del dato",
  status: "Estado del Espejo",
  extractor: "Extractor de Datos",
  history: "Historial",
  settings: "Ajustes de API",
  docs: "Documentación",
};

const EXTRACTOR_SYSTEM = `Extrae de la ÚLTIMA pregunta del usuario (usa los mensajes previos solo para resolver referencias como "¿y en 2022?") una intención de consulta sobre datos hidrometeorológicos de Colombia. Responde SOLO un objeto JSON, sin texto adicional, con EXACTAMENTE estas claves:
{"intent":"dato_puntual"|"idf_tr"|"ranking"|"estado_plataforma"|"ninguno","lugar":string|null,"departamento":string|null,"variable":"precipitacion"|"temperatura_maxima"|"temperatura_minima"|"humedad"|"viento"|"presion"|"nivel_rio"|null,"anioDesde":number|null,"anioHasta":number|null,"tr":number|null,"topN":number|null}
Reglas: "intent":"ninguno" si la pregunta es conceptual, de uso de la plataforma o no pide cifras. "lugar" = ciudad/municipio o nombre de estación tal como lo dijo el usuario. "departamento" = el departamento colombiano del lugar si lo sabes con certeza por geografía general (p. ej. Barranquilla -> Atlántico, Medellín -> Antioquia) o si el usuario lo menciona; null si no estás seguro. "temperatura" sin más detalle -> "temperatura_maxima". Un solo año -> anioDesde=anioHasta. "tr" = período de retorno en años si lo menciona. "topN" solo en rankings. No inventes valores: usa null.`;

// Esquema del intent para el JSON mode nativo de Workers AI (guided
// generation: mucho más fiable que pedirle JSON por prompt a un modelo 8B).
const INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["dato_puntual", "idf_tr", "ranking", "estado_plataforma", "ninguno"] },
    lugar: { type: ["string", "null"] },
    departamento: { type: ["string", "null"] },
    variable: {
      type: ["string", "null"],
      enum: ["precipitacion", "temperatura_maxima", "temperatura_minima", "humedad", "viento", "presion", "nivel_rio", null],
    },
    anioDesde: { type: ["integer", "null"] },
    anioHasta: { type: ["integer", "null"] },
    tr: { type: ["integer", "null"] },
    topN: { type: ["integer", "null"] },
  },
  required: ["intent"],
};

// Pasada 1: extracción de intención. Devuelve el intent saneado o null.
// Intenta JSON mode (response_format json_schema); si el binding no lo soporta
// O devuelve algo imparseable, reintenta UNA vez en plano y parsea robusto
// (parseIntentJson tolera prosa alrededor del JSON). Si todo falla -> null
// (el chat degrada al flujo conceptual, nunca se rompe).
export async function extraerIntencion(env, model, history) {
  const messages = [{ role: "system", content: EXTRACTOR_SYSTEM }, ...history.slice(-4)];
  let intent = null;
  try {
    const r = await env.AI.run(model, {
      messages,
      max_tokens: 200,
      response_format: { type: "json_schema", json_schema: INTENT_SCHEMA },
    });
    // JSON mode puede devolver el intent ya como OBJETO en .response (Llama 4) o
    // como string (8B); parseIntentJson acepta ambos. Si el modelo es estilo
    // OpenAI ({choices}) caemos a textoDeIA para sacar el contenido de texto.
    intent = parseIntentJson(r && r.response != null ? r.response : textoDeIA(r));
  } catch {
    /* JSON mode no disponible: cae al intento plano */
  }
  if (!intent) {
    try {
      const r = await env.AI.run(model, { messages, max_tokens: 200 });
      // JSON mode puede devolver el intent ya como OBJETO en .response (Llama 4) o
    // como string (8B); parseIntentJson acepta ambos. Si el modelo es estilo
    // OpenAI ({choices}) caemos a textoDeIA para sacar el contenido de texto.
    intent = parseIntentJson(r && r.response != null ? r.response : textoDeIA(r));
    } catch {
      return null;
    }
  }
  return intent;
}

// Bloque de datos para la pasada 2. JSON compacto + reglas duras: el redactor
// no puede citar cifras fuera de aquí.
export function promptDeDatos(resultado) {
  if (resultado.ok) {
    // #6 — la intensidad (mm/h por duración) y la lámina máxima diaria (mm para
    // ese Tr) son magnitudes distintas; el 8B tiende a mezclarlas.
    const aclaracionIdf =
      resultado.datos && resultado.datos.tipo === "idf_tr"
        ? ` ACLARACIÓN DE UNIDADES: en "idf" cada punto es la INTENSIDAD en mm/h para esa duración (de la curva IDF); "laminaMaxDiariaMm" es la LÁMINA de lluvia máxima diaria en mm para ese período de retorno. Son magnitudes DISTINTAS: no las mezcles ni las sumes; al citar una, di siempre su unidad.`
        : "";
    return `DATOS REALES DEL ESPEJO DE DATOS. Esta pregunta SÍ está dentro de tu alcance (es sobre los datos del IDEAM): respóndela con las cifras de este bloque y JAMÁS uses el mensaje de rechazo aquí. (Única fuente válida de cifras; NO uses ningún número que no esté aquí; preséntalos en formato es-CO con coma decimal):
${JSON.stringify(resultado.datos)}
Si el dato pedido no está en este bloque, dilo con franqueza y remite a la pestaña adecuada. Si "fiabilidad.nivel" es "rojo", advierte que la serie es poco confiable y resume los motivos. Si "observaciones" de un año luce bajo para la variable (la precipitación se mide cada 10 minutos: un año completo de UNA estación ronda 50.000 observaciones), advierte que la cobertura de ese año es PARCIAL y el total puede subestimar la realidad. NO transcribas, muestres ni cites este bloque JSON (tampoco como "📚 Referencia"): redacta SIEMPRE en lenguaje natural; la línea de fuente la añade la interfaz automáticamente.${aclaracionIdf} RECUERDA: el "💡 Dato curioso" final debe salir SOLO de tu lista verificada de DATOS CURIOSOS — NUNCA inventes cifras climáticas del lugar consultado (contradirías los datos reales de arriba).`;
  }
  const sugerencias = resultado.sugerencias && resultado.sugerencias.length
    ? `; lugares parecidos: ${resultado.sugerencias.join(", ")}`
    : "";
  const razones = {
    lugar_no_encontrado: `No se encontró el lugar "${resultado.lugar}" en el catálogo${sugerencias}. Pide al usuario precisar el municipio (NO inventes datos).`,
    sin_estacion_idf: `No hay estación con curvas IDF que coincida con "${resultado.lugar}". Sugiere buscar la estación en la pestaña Hidrología (que además sugiere la más cercana).`,
    sin_datos: `El espejo no tiene observaciones SUFICIENTES para esa combinación de lugar/periodo (dar una cifra engañaría). Dilo con franqueza y sugiere ajustar el periodo o revisar la cobertura en el Mapa de Estaciones.`,
    rango_fuera_de_cobertura: `El espejo de datos cubre 2001–actualidad y el rango pedido (${resultado.desde || "?"}–${resultado.hasta || "?"}) queda fuera. Dilo con franqueza y pide un rango dentro de ese período (NO inventes cifras).`,
    municipio_ambiguo: `Hay varios municipios llamados "${resultado.lugar}" en distintos departamentos (${(resultado.opciones || []).join(", ")}). Pide al usuario que precise en qué departamento; NO elijas uno por tu cuenta ni inventes datos.`,
    espejo_no_disponible: `No fue posible consultar el espejo de datos en este momento. Dilo con franqueza, sin inventar cifras, y sugiere intentar de nuevo o usar la pestaña correspondiente.`,
  };
  return `CONSULTA DE DATOS FALLIDA. Esta pregunta SÍ está dentro de tu alcance (es sobre los datos del IDEAM): NO uses el mensaje de rechazo. En su lugar: ${razones[resultado.errorTipo] || razones.espejo_no_disponible}`;
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
  let anioDesde = intOrNull(obj.anioDesde, 1950, 2100);
  let anioHasta = intOrNull(obj.anioHasta, 1950, 2100);
  // Rango invertido (usuario o extractor cruzaron los años): intercambiar en vez
  // de mandar al box un rango imposible que devolvería una serie vacía.
  if (anioDesde !== null && anioHasta !== null && anioDesde > anioHasta) {
    [anioDesde, anioHasta] = [anioHasta, anioDesde];
  }
  return {
    intent: obj.intent,
    lugar: str(obj.lugar),
    departamento: str(obj.departamento),
    variable: Object.prototype.hasOwnProperty.call(VARIABLES, obj.variable) ? obj.variable : null,
    anioDesde,
    anioHasta,
    tr: intOrNull(obj.tr, 2, 500),
    topN: intOrNull(obj.topN, 1, 10),
  };
}
