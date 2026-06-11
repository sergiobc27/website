// Genera src/app/data/historiaIdf.ts con los datos REALES de la estación demo
// del scrollytelling "La historia del dato". Correr manualmente (necesita red):
//   node scripts/generar-historia-idf.mjs
// Elige la estación por criterio técnico: fiabilidad 🟢 con más años válidos.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.IDEAM_BASE_URL || "https://ideam.sergiobc.com";
const PRECIP = "s54a-sgyg";

async function getJson(path, body) {
  const r = await fetch(`${BASE}${path}`, body ? {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}
const porEstacion = (codigo) => ({ datasetId: PRECIP, departments: [], catalogFilters: { stations: [codigo] } });

// 1) Estación demo: la de MEJOR fiabilidad disponible con más años válidos.
// (En el espejo actual ninguna estación IDF alcanza 🟢 — la red de 10 min es
// joven; eso es parte de la historia, no un defecto del script.)
const RANGO = { verde: 3, amarillo: 2, rojo: 1 };
// OJO: en el catálogo real `fiabilidad` es un objeto {level, reasons...}, no un string.
const nivel = (s) => (s.fiabilidad && typeof s.fiabilidad === "object" ? s.fiabilidad.level : s.fiabilidad) || null;
const cat = await getJson("/api/analytics/idf-stations");
const candidatas = (cat.stations || []).filter((s) => s.aniosValidos >= 5);
if (!candidatas.length) throw new Error("Catálogo IDF vacío.");
const est = candidatas.sort(
  (a, b) => (RANGO[nivel(b)] || 0) - (RANGO[nivel(a)] || 0)
    || (b.aniosValidos - a.aniosValidos) || a.codigo.localeCompare(b.codigo),
)[0];
console.log("Fiabilidad de la elegida:", nivel(est) || "sin calcular");
console.log("Estación demo:", est.codigo, est.nombre, `(${est.municipio}, ${est.departamento})`, est.aniosValidos, "años");

// 2) Análisis de frecuencia + curvas.
const rp = await getJson("/api/analytics/return-periods", porEstacion(est.codigo));
const idf = await getJson("/api/analytics/idf", porEstacion(est.codigo));
if (!idf.available || !idf.curves?.length) throw new Error("La estación no tiene curvas IDF disponibles.");
if (!rp.stationYears?.length) throw new Error("return-periods sin stationYears.");

// 3) Día de la tormenta: el día de mayor lámina del año con el máximo más alto.
const peorAnio = [...rp.stationYears].sort((a, b) => b.maximum - a.maximum)[0];
const serieDiaria = await getJson("/api/analytics/timeseries", {
  ...porEstacion(est.codigo), interval: "day", metric: "sum",
  startDate: `${peorAnio.year}-01-01`, endDate: `${peorAnio.year}-12-31`,
});
const dias = (serieDiaria.points || []).filter((p) => p.value !== null);
if (!dias.length) throw new Error(`Sin serie diaria para ${peorAnio.year}.`);
const diaTormenta = [...dias].sort((a, b) => b.value - a.value)[0];
const fecha = String(diaTormenta.bucket).slice(0, 10);
console.log("Tormenta:", fecha, `${diaTormenta.value} mm en el día`);

// 4) Pulsos de 10 minutos de ese día (preview devuelve filas crudas, ≤200).
// preview exige departments (validación del box).
const prev = await getJson("/api/preview", {
  ...porEstacion(est.codigo), departments: [est.departamento], startDate: fecha, endDate: fecha,
});
const filas = (prev.rows || [])
  .map((r) => ({ t: String(r.fechaobservacion ?? r.fechaObservacion ?? ""), mm: Number(r.valorobservado ?? r.valorObservado) }))
  .filter((r) => r.t && Number.isFinite(r.mm))
  .sort((a, b) => a.t.localeCompare(b.t));
if (filas.length < 6) {
  throw new Error(`Preview devolvió ${filas.length} filas para ${fecha}: no alcanza para un hietograma. NO degradar: revisar a mano.`);
}
const puntos = filas.map((r) => ({ hora: r.t.slice(11, 16), mm: Math.round(r.mm * 100) / 100 }));
const totalMm = Math.round(puntos.reduce((s, p) => s + p.mm, 0) * 10) / 10;
const maxPulso = Math.max(...puntos.map((p) => p.mm));

// 5) Armar y validar el dataset.
const r1 = (x) => Math.round(x * 10) / 10;
const data = {
  generadoEl: new Date().toISOString().slice(0, 10),
  fuente: "IDEAM vía espejo de datos ideam.sergiobc.com (precipitación 10 min, dataset s54a-sgyg)",
  estacion: { codigo: est.codigo, nombre: est.nombre, municipio: est.municipio, departamento: est.departamento, aniosValidos: est.aniosValidos, fiabilidad: nivel(est) || "sin calcular" },
  tormenta: { fecha, puntos, totalMm, maxIntensidadMmH: r1(maxPulso * 6) },
  maximosAnuales: rp.stationYears.map((y) => ({ anio: y.year, mm: r1(y.maximum) })),
  gumbel: rp.gumbel || null,
  empiricos: (rp.empirical || []).map((q) => ({ tr: q.returnPeriod, mm: r1(q.value) })),
  cuantiles: (rp.quantiles || []).map((q) => ({
    tr: q.returnPeriod, mm: r1(q.value),
    ...(q.lower !== undefined ? { lower: r1(q.lower) } : {}),
    ...(q.upper !== undefined ? { upper: r1(q.upper) } : {}),
  })),
  curvas: idf.curves.map((c) => ({
    tr: c.returnPeriod,
    puntos: c.points.map((p) => ({
      durMin: p.durMin, mmH: r1(p.intensityMmH),
      ...(p.lowerMmH !== undefined ? { lowerMmH: r1(p.lowerMmH) } : {}),
      ...(p.upperMmH !== undefined ? { upperMmH: r1(p.upperMmH) } : {}),
    })),
  })),
  ecuacion: idf.equation || null,
  nAnios: idf.nYears || rp.n,
};
for (const k of ["estacion", "tormenta", "maximosAnuales", "cuantiles", "curvas"]) {
  if (!data[k] || (Array.isArray(data[k]) && !data[k].length)) throw new Error(`Dataset inválido: falta ${k}`);
}

// 6) Escribir el módulo TS.
const ts = `// GENERADO por scripts/generar-historia-idf.mjs el ${data.generadoEl} — NO editar a mano.
// Datos reales de la estación ${data.estacion.codigo} (${data.estacion.nombre}).
// Regenerar con: node scripts/generar-historia-idf.mjs
import type { HistoriaIdfData } from '../lib/historia';

export const HISTORIA_IDF: HistoriaIdfData = ${JSON.stringify(data, null, 2)};
`;
mkdirSync(new URL("../src/app/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/app/data/historiaIdf.ts", import.meta.url), ts);
console.log(`OK -> src/app/data/historiaIdf.ts (${puntos.length} pulsos, ${data.maximosAnuales.length} años, ${data.curvas.length} curvas)`);
