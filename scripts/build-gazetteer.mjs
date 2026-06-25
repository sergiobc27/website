// Genera src/worker/gazetteerMunicipios.js: tabla determinista municipio -> departamento
// para que el Asistente no dependa de que el modelo sepa geografía colombiana.
//
// Fuente: los endpoints públicos del propio sitio (/api/meta + /api/municipalities),
// así la tabla cubre EXACTAMENTE los municipios que tienen datos en el espejo
// (si no hay datos, no hay nada que mostrar). Municipios homónimos en >1
// departamento se OMITEN: el flujo de ambigüedad del bot ya pide precisar.
//
// Uso:  node scripts/build-gazetteer.mjs   (sin login; usa la API pública)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PROD = process.env.IDEAM_ORIGIN || 'https://ideam.sergiobc.com';
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

const meta = await (await fetch(`${PROD}/api/meta`, { headers: { accept: 'application/json' } })).json();
const departments = meta.departments || [];
if (!departments.length) throw new Error('No se obtuvieron departamentos de /api/meta');

const porMunicipio = new Map(); // normMunicipio -> Set(departamento canónico)
for (const dep of departments) {
  const r = await (await fetch(`${PROD}/api/municipalities?department=${encodeURIComponent(dep)}`, {
    headers: { accept: 'application/json' },
  })).json();
  for (const m of r.municipalities || []) {
    const k = norm(m);
    if (!k) continue;
    if (!porMunicipio.has(k)) porMunicipio.set(k, new Set());
    porMunicipio.get(k).add(dep);
  }
}

const mapa = {};
let ambiguos = 0;
for (const [k, set] of [...porMunicipio.entries()].sort()) {
  if (set.size === 1) mapa[k] = [...set][0];
  else ambiguos++;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const salida = path.resolve(__dirname, '../src/worker/gazetteerMunicipios.js');
const cuerpo = `// AUTOGENERADO por scripts/build-gazetteer.mjs — NO editar a mano.
// Municipio (normalizado: mayúsculas, sin tildes) -> departamento canónico.
// Solo municipios SIN ambigüedad (nombre único en un único departamento).
// Regenerar:  node scripts/build-gazetteer.mjs
export const MUNICIPIO_DEPARTAMENTO = ${JSON.stringify(mapa, null, 0)};
`;
writeFileSync(salida, cuerpo, 'utf8');
console.log(`Municipios únicos: ${Object.keys(mapa).length} · omitidos por homónimos: ${ambiguos}`);
console.log(`Escrito: ${salida}`);
