// Tests del pipeline "pregúntale a tus datos" (src/worker/chatData.js).
// node:test, sin red: fetch y env.AI se mockean por test.
import test from "node:test";
import assert from "node:assert/strict";
import {
  pareceConsultaDatos,
  parseIntentJson,
  formatearNumero,
  normalizarTexto,
} from "../src/worker/chatData.js";

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
