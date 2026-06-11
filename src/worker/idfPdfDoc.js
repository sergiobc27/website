// Genera el PDF formal de curvas IDF EN EL WORKER (pdf-lib, JS puro) a partir de
// datos de confianza traídos del box por código de estación. El cliente nunca
// aporta el archivo: así el endpoint de correo no puede usarse para colar PDFs
// arbitrarios (cierre del "open relay" / phishing).
//
// Sin logos raster (decodificar PNG es caro en CPU del Worker): marca por texto
// con la paleta CUC. Texto vectorial nítido. Fuente estándar Helvetica → solo
// caracteres Latin-1 (evitar em-dash —, usar guion normal y "·"/acentos sí).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Paleta CUC.
const WINE = rgb(0xa3 / 255, 0x16 / 255, 0x1a / 255);
const GOLD = rgb(0xc9 / 255, 0xa2 / 255, 0x27 / 255);
const INK = rgb(0x1a / 255, 0x1a / 255, 0x1a / 255);
const MUTED = rgb(0x59 / 255, 0x59 / 255, 0x59 / 255);
const WHITE = rgb(1, 1, 1);
const ROWALT = rgb(248 / 255, 244 / 255, 232 / 255);

// Colores de las curvas por período de retorno (mismos que la web).
const CURVE_HEX = ["#60a5fa", "#34d399", "#C9A227", "#f59e0b", "#A3161A", "#7f1d1d"];
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Formato es-CO (miles con punto, decimales con coma, minFractionDigits 0).
// Implementado a mano para no depender de datos de locale en el runtime del Worker.
function fmt(v, decimals = 1) {
  if (typeof v !== "number" || !isFinite(v)) return "-";
  const neg = v < 0;
  const r = Math.round(Math.abs(v) * 10 ** decimals) / 10 ** decimals;
  const parts = String(r).split(".");
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = parts[1] ? `${int},${parts[1]}` : int;
  return neg ? "-" + out : out;
}

// Construye filas de la tabla: una por duración, columna de intensidad por Tr.
function tableRows(idf) {
  const byDur = new Map();
  for (const curve of idf.curves || []) {
    for (const p of curve.points || []) {
      if (!(p.intensityMmH > 0)) continue;
      const row = byDur.get(p.durMin) || {};
      row[curve.returnPeriod] = p.intensityMmH;
      byDur.set(p.durMin, row);
    }
  }
  const durs = Array.from(byDur.keys()).sort((a, b) => a - b);
  const trs = idf.returnPeriods || [];
  return durs.map((d) => ({
    dur: d,
    vals: trs.map((tr) => byDur.get(d)?.[tr]),
  }));
}

export async function buildIdfPdf(idf, station) {
  const doc = await PDFDocument.create();
  const W = 595.28;
  const H = 841.89;
  const M = 40;
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const text = (s, x, top, size, f, color) =>
    page.drawText(String(s), { x, y: H - top - size, size, font: f, color });
  const textRight = (s, xRight, top, size, f, color) => {
    const w = f.widthOfTextAtSize(String(s), size);
    text(s, xRight - w, top, size, f, color);
  };

  // --- Encabezado: franja vino + barra dorada ---
  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: WINE });
  text("Curvas IDF", M, 16, 22, bold, WHITE);
  text("Intensidad-Duracion-Frecuencia", M, 42, 11, font, WHITE);
  textRight("UNIVERSIDAD DE LA COSTA (CUC)", W - M, 26, 10, bold, WHITE);
  page.drawRectangle({ x: 0, y: H - 68, width: W, height: 4, color: GOLD });

  // --- Estación ---
  text("ESTACION", M, 84, 9, bold, MUTED);
  text(`${station.nombre} · ${station.codigo}`, M, 96, 14, bold, INK);
  text(`${station.municipio}, ${station.departamento}`, M, 114, 10, font, MUTED);

  const chips = [
    idf.nYears != null ? `${idf.nYears} anios` : null,
    "datos 10-min",
    `Generado ${station.fecha}`,
  ].filter(Boolean);
  text(chips.join("    ·    "), M, 134, 9, font, INK);

  // --- Gráfica IDF (vectorial, log-log) ---
  const plotL = 78;
  const plotR = W - M;
  const plotTop = H - 165; // y (pdf) del borde superior
  const plotBot = H - 380; // y (pdf) del borde inferior
  const plotW = plotR - plotL;
  const plotH = plotTop - plotBot;

  // Rango de datos.
  let dmin = Infinity, dmax = -Infinity, imin = Infinity, imax = -Infinity;
  for (const c of idf.curves || []) {
    for (const p of c.points || []) {
      if (!(p.intensityMmH > 0) || !(p.durMin > 0)) continue;
      dmin = Math.min(dmin, p.durMin); dmax = Math.max(dmax, p.durMin);
      imin = Math.min(imin, p.intensityMmH); imax = Math.max(imax, p.intensityMmH);
    }
  }
  const hasData = isFinite(dmin) && isFinite(imin) && dmax > dmin && imax > imin;

  // Marco del plot.
  page.drawRectangle({ x: plotL, y: plotBot, width: plotW, height: plotH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });

  if (hasData) {
    const lgD = Math.log10(dmin), lgDr = Math.log10(dmax) - lgD;
    const lgI = Math.log10(imin), lgIr = Math.log10(imax) - lgI;
    const xOf = (d) => plotL + ((Math.log10(d) - lgD) / lgDr) * plotW;
    const yOf = (i) => plotBot + ((Math.log10(i) - lgI) / lgIr) * plotH;

    // Ticks X (duraciones típicas dentro de rango).
    for (const d of [10, 20, 30, 60, 120, 180, 360, 720, 1440]) {
      if (d < dmin || d > dmax) continue;
      const x = xOf(d);
      page.drawLine({ start: { x, y: plotBot }, end: { x, y: plotTop }, thickness: 0.25, color: rgb(0.9, 0.9, 0.9) });
      textRight(String(d), x + font.widthOfTextAtSize(String(d), 7) / 2, H - (plotBot - 4), 7, font, MUTED);
    }
    text("Duracion (min, escala log)", plotL + plotW / 2 - 45, H - (plotBot - 16), 8, font, MUTED);

    // Ticks Y (min, medio geométrico, max).
    for (const i of [imin, Math.sqrt(imin * imax), imax]) {
      const y = yOf(i);
      page.drawLine({ start: { x: plotL, y }, end: { x: plotR, y }, thickness: 0.25, color: rgb(0.9, 0.9, 0.9) });
      textRight(fmt(i, 0), plotL - 3, H - (y + 3), 7, font, MUTED);
    }
    text("mm/h", plotL - 20, H - (plotTop + 8), 8, font, MUTED);

    // Curvas por período de retorno.
    const trs = idf.returnPeriods || [];
    trs.forEach((tr, idx) => {
      const curve = (idf.curves || []).find((c) => c.returnPeriod === tr);
      if (!curve) return;
      const pts = (curve.points || [])
        .filter((p) => p.intensityMmH > 0 && p.durMin > 0)
        .sort((a, b) => a.durMin - b.durMin)
        .map((p) => ({ x: xOf(p.durMin), y: yOf(p.intensityMmH) }));
      const color = hexRgb(CURVE_HEX[idx % CURVE_HEX.length]);
      for (let k = 1; k < pts.length; k++) {
        page.drawLine({ start: pts[k - 1], end: pts[k], thickness: 1.2, color });
      }
      // Leyenda (arriba-derecha, dentro del plot).
      const ly = plotTop - 10 - idx * 11;
      page.drawLine({ start: { x: plotR - 70, y: ly }, end: { x: plotR - 58, y: ly }, thickness: 1.5, color });
      text(`Tr ${tr}`, plotR - 54, H - (ly + 3.5), 7, font, INK);
    });
  } else {
    text("Sin datos suficientes para graficar.", plotL + 10, H - (plotBot + plotH / 2), 9, font, MUTED);
  }

  // --- Ecuación ---
  let top = 400;
  if (idf.equation) {
    const eq = idf.equation;
    text("Ecuacion ajustada:   I = (K * T^m) / D^n", M, top, 10, bold, INK);
    top += 14;
    text(`K=${fmt(eq.K, 1)}    m=${fmt(eq.m, 2)}    n=${fmt(eq.n, 2)}    ·    R2_log = ${fmt(eq.r2, 3)}`, M, top, 9, font, MUTED);
    top += 18;
  } else {
    text("Ecuacion ajustada: no disponible (registro corto).", M, top, 9, font, MUTED);
    top += 18;
  }

  // --- Tabla de intensidades ---
  const trs = idf.returnPeriods || [];
  const rows = tableRows(idf);
  const tableL = M;
  const tableW = W - 2 * M;
  const col0 = 70;
  const colW = trs.length ? (tableW - col0) / trs.length : tableW - col0;
  const rowH = 15;
  const colX = (c) => (c === 0 ? tableL : tableL + col0 + (c - 1) * colW); // borde izq de la col
  const colRight = (c) => (c === 0 ? tableL + col0 : tableL + col0 + c * colW);

  // Cabecera.
  const tableStartTop = top;
  page.drawRectangle({ x: tableL, y: H - top - rowH, width: tableW, height: rowH, color: WINE });
  text("Dur. (min)", tableL + 4, top + 3.5, 8, bold, WHITE);
  trs.forEach((tr, c) => {
    const label = `Tr ${tr}a`;
    const w = bold.widthOfTextAtSize(label, 8);
    text(label, colX(c + 1) + colW / 2 - w / 2, top + 3.5, 8, bold, WHITE);
  });
  top += rowH;

  // Filas (cap defensivo por si hubiera muchísimas duraciones).
  const maxRows = Math.min(rows.length, 18);
  for (let r = 0; r < maxRows; r++) {
    const row = rows[r];
    if (r % 2 === 1) {
      page.drawRectangle({ x: tableL, y: H - top - rowH, width: tableW, height: rowH, color: ROWALT });
    }
    text(String(row.dur), tableL + 4, top + 3.5, 8, bold, INK);
    row.vals.forEach((v, c) => {
      textRight(v != null ? fmt(v, 1) : "-", colRight(c + 1) - 4, top + 3.5, 8, font, INK);
    });
    top += rowH;
  }
  // Borde exterior de la tabla.
  page.drawRectangle({ x: tableL, y: H - top, width: tableW, height: top - tableStartTop, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });
  text("Intensidades en mm/h.", tableL, top + 12, 7, font, MUTED);

  // --- Pie ---
  const footTop = H - 70; // 70 pt desde abajo
  page.drawLine({ start: { x: M, y: 70 }, end: { x: W - M, y: 70 }, thickness: 0.5, color: GOLD });
  text("Metodos: Gumbel (momentos) · datos 10-min IDEAM.", M, footTop, 8, font, MUTED);
  text("Ingeniero Civil Sergio Beltran Coley · Universidad de la Costa (CUC)", M, footTop + 11, 8, font, MUTED);
  text("ideam.sergiobc.com", M, footTop + 22, 8, font, MUTED);
  textRight(station.fecha, W - M, footTop + 22, 8, font, MUTED);

  return doc.save(); // Uint8Array
}
