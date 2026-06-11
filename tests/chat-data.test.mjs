// Tests del pipeline "pregúntale a tus datos" (src/worker/chatData.js).
// node:test, sin red: fetch y env.AI se mockean por test.
import test from "node:test";
import assert from "node:assert/strict";
import {
  pareceConsultaDatos,
  parseIntentJson,
  formatearNumero,
  normalizarTexto,
  resolverLugar,
  elegirEstacion,
  consultarDatos,
  extraerSugerencias,
  sugerenciasFallback,
  SUGERENCIAS_PROMPT,
} from "../src/worker/chatData.js";

const CATALOGO = {
  municipalities: ["BARRANQUILLA", "MEDELLIN", "BOGOTA, D.C.", "SOLEDAD", "SABANALARGA"],
};
const META = { departments: ["ATLANTICO", "ANTIOQUIA", "CHOCO"] };

function fetchMock(rutas) {
  return async (url) => {
    const path = new URL(url, "https://x").pathname;
    for (const [k, v] of Object.entries(rutas)) {
      if (path === k) return new Response(JSON.stringify(v), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };
}

test("pareceConsultaDatos detecta preguntas de datos", () => {
  assert.equal(pareceConsultaDatos("¿Cuánto llovió en Barranquilla en 2023?"), true);
  assert.equal(pareceConsultaDatos("intensidad para Tr=25 en la estación Socha"), true);
  assert.equal(pareceConsultaDatos("¿dónde llueve más, Chocó o Atlántico?"), true);
  assert.equal(pareceConsultaDatos("¿qué tan actualizados están los datos?"), true);
  assert.equal(pareceConsultaDatos("temperatura promedio en Medellín"), true);
});

test("pareceConsultaDatos NO se activa con preguntas conceptuales", () => {
  assert.equal(pareceConsultaDatos("¿Qué es una curva IDF?"), false);
  assert.equal(pareceConsultaDatos("explícame el método racional"), false);
  assert.equal(pareceConsultaDatos("hola, ¿qué haces?"), false);
});

test("parseIntentJson acepta objeto, string JSON y JSON embebido en texto", () => {
  const obj = { intent: "dato_puntual", lugar: "Barranquilla", variable: "precipitacion", anioDesde: 2023, anioHasta: 2023 };
  assert.deepEqual(parseIntentJson(obj).lugar, "Barranquilla");
  assert.equal(parseIntentJson(JSON.stringify(obj)).intent, "dato_puntual");
  assert.equal(parseIntentJson(`Claro: ${JSON.stringify(obj)} listo`).intent, "dato_puntual");
});

test("parseIntentJson sanea valores inválidos", () => {
  assert.equal(parseIntentJson({ intent: "hackear" }), null);
  assert.equal(parseIntentJson("no es json"), null);
  const i = parseIntentJson({ intent: "ranking", topN: 999, lugar: "x".repeat(500), variable: "magia" });
  assert.equal(i.topN, 10); // cap
  assert.equal(i.lugar.length <= 80, true); // truncado
  assert.equal(i.variable, null); // variable desconocida -> null
  const tr = parseIntentJson({ intent: "idf_tr", tr: 100000 });
  assert.equal(tr.tr, 500); // cap Tr
});

test("formatearNumero usa formato es-CO", () => {
  assert.equal(formatearNumero(1234.5), "1.234,5");
  assert.equal(formatearNumero(0.25), "0,3");
  assert.equal(formatearNumero(null), "N/D");
});

test("normalizarTexto quita tildes y sube a mayúsculas", () => {
  assert.equal(normalizarTexto("Bogotá D.C."), "BOGOTA D.C.");
  assert.equal(normalizarTexto("  Chocó "), "CHOCO");
});

test("resolverLugar encuentra municipio con tildes y match parcial", async () => {
  const env = { API_ORIGIN: "https://box" };
  globalThis.fetch = fetchMock({ "/api/municipalities": CATALOGO, "/api/meta": META });
  const r1 = await resolverLugar(env, { lugar: "Medellín", departamento: null });
  assert.deepEqual(r1, { municipio: "MEDELLIN", departamento: null });
  const r2 = await resolverLugar(env, { lugar: "Bogotá", departamento: null });
  assert.equal(r2.municipio, "BOGOTA, D.C.");
  const r3 = await resolverLugar(env, { lugar: null, departamento: "Chocó" });
  assert.deepEqual(r3, { municipio: null, departamento: "CHOCO" });
});

test("resolverLugar no encontrado devuelve sugerencias parecidas", async () => {
  const env = { API_ORIGIN: "https://box" };
  globalThis.fetch = fetchMock({ "/api/municipalities": CATALOGO, "/api/meta": META });
  const r = await resolverLugar(env, { lugar: "Sabanagrande", departamento: null });
  assert.equal(r.municipio, null);
  assert.equal(r.noEncontrado, "Sabanagrande");
  assert.equal(r.sugerencias.includes("SABANALARGA"), true);
});

test("consultarDatos dato_puntual arma timeseries y resume por año", async () => {
  const env = { API_ORIGIN: "https://box" };
  let captured = null;
  globalThis.fetch = async (url, init) => {
    const path = new URL(url, "https://x").pathname;
    if (path === "/api/municipalities") return new Response(JSON.stringify(CATALOGO));
    if (path === "/api/analytics/timeseries") {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ points: [{ bucket: "2023-01-01", value: 823.4, n: 50000 }] }));
    }
    return new Response("{}", { status: 404 });
  };
  const r = await consultarDatos(env, {
    intent: "dato_puntual", lugar: "Barranquilla", departamento: null,
    variable: "precipitacion", anioDesde: 2023, anioHasta: 2023, tr: null, topN: null,
  });
  assert.equal(r.ok, true);
  assert.equal(captured.datasetId, "s54a-sgyg");
  assert.equal(captured.metric, "sum");
  assert.deepEqual(captured.catalogFilters, { municipalities: ["BARRANQUILLA"] });
  assert.equal(captured.startDate, "2023-01-01");
  assert.equal(captured.endDate, "2023-12-31");
  assert.equal(r.datos.serie[0].valor, 823.4);
  assert.equal(r.datos.unidad, "mm");
});

test("consultarDatos lugar no encontrado degrada con sugerencias", async () => {
  const env = { API_ORIGIN: "https://box" };
  globalThis.fetch = fetchMock({ "/api/municipalities": CATALOGO, "/api/meta": META });
  const r = await consultarDatos(env, { intent: "dato_puntual", lugar: "Atlantis", departamento: null, variable: null, anioDesde: null, anioHasta: null, tr: null, topN: null });
  assert.equal(r.ok, false);
  assert.equal(r.errorTipo, "lugar_no_encontrado");
});

test("consultarDatos box caído devuelve error de espejo", async () => {
  const env = { API_ORIGIN: "https://box" };
  globalThis.fetch = async () => new Response("err", { status: 500 });
  const r = await consultarDatos(env, { intent: "estado_plataforma", lugar: null, departamento: null, variable: null, anioDesde: null, anioHasta: null, tr: null, topN: null });
  assert.equal(r.ok, false);
  assert.equal(r.errorTipo, "espejo_no_disponible");
});

test("consultarDatos idf_tr resuelve estación y reporta semáforo", async () => {
  const env = { API_ORIGIN: "https://box" };
  globalThis.fetch = async (url) => {
    const path = new URL(url, "https://x").pathname;
    if (path === "/api/analytics/idf-stations") {
      return new Response(JSON.stringify({ stations: [{ codigo: "0024", nombre: "LAS FLORES", municipio: "BARRANQUILLA", departamento: "ATLANTICO", aniosValidos: 18, fiabilidad: "amarillo" }] }));
    }
    if (path === "/api/analytics/idf") {
      return new Response(JSON.stringify({ available: true, nYears: 18, curves: [{ returnPeriod: 25, points: [{ durMin: 15, intensityMmH: 120.3 }, { durMin: 60, intensityMmH: 60.1 }] }], equation: { K: 1, m: 0.2, n: 0.6, r2: 0.98 } }));
    }
    if (path === "/api/analytics/return-periods") {
      return new Response(JSON.stringify({ quantiles: [{ returnPeriod: 25, value: 95.2, lower: 80.1, upper: 112.4 }], reliability: { level: "amarillo", reasons: ["serie de 18 años"] }, n: 18 }));
    }
    return new Response("{}", { status: 404 });
  };
  const r = await consultarDatos(env, { intent: "idf_tr", lugar: "Barranquilla", departamento: null, variable: null, anioDesde: null, anioHasta: null, tr: 25, topN: null });
  assert.equal(r.ok, true);
  assert.equal(r.datos.estacion.codigo, "0024");
  assert.equal(r.datos.fiabilidad.nivel, "amarillo");
  assert.equal(r.datos.idf[0].intensidadMmH, 120.3);
  assert.equal(r.datos.tr25.lluviaDiariaMm, 95.2);
});

test("consultarDatos ranking nacional usa by-region", async () => {
  const env = { API_ORIGIN: "https://box" };
  globalThis.fetch = async (url) => {
    const path = new URL(url, "https://x").pathname;
    if (path === "/api/analytics/by-region") {
      return new Response(JSON.stringify({ regions: [
        { department: "CHOCO", mean: 11.2, rowCount: 100, stationCount: 30 },
        { department: "ATLANTICO", mean: 2.1, rowCount: 90, stationCount: 25 },
      ] }));
    }
    return new Response("{}", { status: 404 });
  };
  const r = await consultarDatos(env, { intent: "ranking", lugar: null, departamento: null, variable: "precipitacion", anioDesde: null, anioHasta: null, tr: null, topN: 2 });
  assert.equal(r.ok, true);
  assert.equal(r.datos.ranking[0].nombre, "CHOCO");
});

test("extraerSugerencias separa la línea >>> y la elimina del reply", () => {
  const raw = 'La lluvia fue de 823 mm.\n\n>>>SUGERENCIAS: ["¿Y en 2022?", "¿Top 5 de estaciones?"]';
  const { reply, suggestions } = extraerSugerencias(raw);
  assert.equal(reply, "La lluvia fue de 823 mm.");
  assert.deepEqual(suggestions, ["¿Y en 2022?", "¿Top 5 de estaciones?"]);
});

test("extraerSugerencias sanea: máx 3, ≤80 chars, solo strings, y tolera basura", () => {
  const raw = `ok\n>>>SUGERENCIAS: ["a","b","c","d", 5, "${"x".repeat(200)}"]`;
  const { suggestions } = extraerSugerencias(raw);
  assert.equal(suggestions.length, 3);
  const malo = "ok\n>>>SUGERENCIAS: esto no es json";
  assert.deepEqual(extraerSugerencias(malo), { reply: "ok", suggestions: [] });
  assert.deepEqual(extraerSugerencias("sin marker"), { reply: "sin marker", suggestions: [] });
});

test("sugerenciasFallback varía por intent y siempre devuelve 2-3", () => {
  assert.equal(sugerenciasFallback({ intent: "dato_puntual" }).length >= 2, true);
  assert.equal(sugerenciasFallback({ intent: "idf_tr" }).length >= 2, true);
  assert.equal(sugerenciasFallback(null).length >= 2, true);
});

test("SUGERENCIAS_PROMPT existe y menciona el formato", () => {
  assert.equal(SUGERENCIAS_PROMPT.includes(">>>SUGERENCIAS"), true);
});

test("elegirEstacion prefiere fiabilidad verde y más años", () => {
  const stations = [
    { codigo: "1", nombre: "AEROPUERTO", municipio: "SOLEDAD", fiabilidad: "rojo", aniosValidos: 30 },
    { codigo: "2", nombre: "LAS FLORES", municipio: "SOLEDAD", fiabilidad: "verde", aniosValidos: 12 },
    { codigo: "3", nombre: "OTRA", municipio: "SOLEDAD", fiabilidad: "verde", aniosValidos: 20 },
  ];
  assert.equal(elegirEstacion(stations, "Soledad").codigo, "3");
  assert.equal(elegirEstacion(stations, "las flores").codigo, "2"); // match por nombre gana
  assert.equal(elegirEstacion(stations, "Cali"), null);
});
