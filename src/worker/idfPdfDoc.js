// Genera el PDF formal de curvas IDF EN EL WORKER (pdf-lib, JS puro) a partir de
// datos de confianza traídos del box por código de estación. El cliente nunca
// aporta el archivo: así el endpoint de correo no puede usarse para colar PDFs
// arbitrarios (cierre del "open relay" / phishing).
//
// El Worker no tiene DOM, así que la gráfica se dibuja vectorialmente aquí (no
// es una captura de la de recharts). Fuente estándar Helvetica con codificación
// WinAnsi: los acentos y la ñ SÍ se pueden escribir; lo que no entra es la raya
// larga (—), que además está prohibida en texto visible del proyecto.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LOGO_CUC_B64, LOGO_IDEAM_B64, logoBytes } from "./logosPdf.js";

// Paleta CUC.
const WINE = rgb(0xa3 / 255, 0x16 / 255, 0x1a / 255);
const GOLD = rgb(0xc9 / 255, 0xa2 / 255, 0x27 / 255);
const INK = rgb(0x1a / 255, 0x1a / 255, 0x1a / 255);
const MUTED = rgb(0x59 / 255, 0x59 / 255, 0x59 / 255);
const FAINT = rgb(0.62, 0.62, 0.62);
const WHITE = rgb(1, 1, 1);
const CREAM = rgb(250 / 255, 247 / 255, 238 / 255);
const AVISO_FONDO = rgb(1, 0.976, 0.925);
const AVISO_TINTA = rgb(0.3, 0.25, 0.1);
const AVISO_TITULO = rgb(0.55, 0.42, 0.05);
const LINE = rgb(0.87, 0.87, 0.87);
const GRID = rgb(0.92, 0.92, 0.92);

// Colores de las curvas por período de retorno (mismos que la web).
const CURVE_HEX = ["#2f6fb5", "#1f9d76", "#C9A227", "#e07a1f", "#A3161A", "#6b1216"];
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Formato es-CO (miles con punto, decimales con coma). Implementado a mano para
// no depender de datos de locale en el runtime del Worker.
function fmt(v, decimals = 1) {
  if (typeof v !== "number" || !isFinite(v)) return "-";
  const neg = v < 0;
  const r = Math.round(Math.abs(v) * 10 ** decimals) / 10 ** decimals;
  const parts = String(r).split(".");
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = parts[1] ? `${int},${parts[1]}` : int;
  return neg ? "-" + out : out;
}

// Igual que fmt pero conservando los decimales pedidos (147 -> "147,0"): con
// decimales variables las columnas de la tabla no alinean por la coma.
function fmtFijo(v, decimals = 1) {
  if (typeof v !== "number" || !isFinite(v)) return "-";
  const [ent, dec] = Math.abs(v).toFixed(decimals).split(".");
  const int = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (v < 0 ? "-" : "") + (dec ? `${int},${dec}` : int);
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
  return durs.map((d) => ({ dur: d, vals: trs.map((tr) => byDur.get(d)?.[tr]) }));
}

// Marcas 1-2-5 por década para etiquetar un eje logarítmico como en papel
// milimetrado (5, 10, 20, 50, 100, 200...). Sin esto el eje quedaba con tres
// etiquetas sueltas.
function ticksLog(min, max) {
  const out = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
    }
  }
  return out;
}

// Parte un texto en líneas que caben en `ancho`.
function envolver(texto, f, size, ancho) {
  const lineas = [];
  let actual = "";
  for (const palabra of String(texto).split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (f.widthOfTextAtSize(prueba, size) > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

const W = 595.28; // A4
const H = 841.89;
const M = 40;

export async function buildIdfPdf(idf, station) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Curvas IDF · ${station.nombre}`);
  doc.setAuthor("Sergio Beltrán Coley · Universidad de la Costa (CUC)");
  doc.setSubject("Curvas Intensidad-Duración-Frecuencia con datos abiertos del IDEAM");
  doc.setCreator("ideam.sergiobc.com");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([W, H]);

  // Helpers en coordenadas "desde arriba", que es como se piensa una hoja.
  const text = (s, x, top, size, f = font, color = INK) => {
    page.drawText(String(s), { x, y: H - top - size, size, font: f, color });
    return f.widthOfTextAtSize(String(s), size);
  };
  const textRight = (s, xRight, top, size, f = font, color = INK) => {
    text(s, xRight - f.widthOfTextAtSize(String(s), size), top, size, f, color);
  };
  const textCenter = (s, xCenter, top, size, f = font, color = INK) => {
    text(s, xCenter - f.widthOfTextAtSize(String(s), size) / 2, top, size, f, color);
  };
  const rect = (x, top, w, h, color, borderColor, borderWidth) => {
    page.drawRectangle({ x, y: H - top - h, width: w, height: h, color, borderColor, borderWidth });
  };
  const line = (x1, top1, x2, top2, thickness, color) => {
    page.drawLine({ start: { x: x1, y: H - top1 }, end: { x: x2, y: H - top2 }, thickness, color });
  };

  // --- Encabezado -------------------------------------------------------------
  const cuc = await doc.embedPng(logoBytes(LOGO_CUC_B64));
  const ideam = await doc.embedPng(logoBytes(LOGO_IDEAM_B64));
  const altoBanda = 74;
  rect(0, 0, W, altoBanda, WINE);
  rect(0, altoBanda, W, 4, GOLD);
  // Los logos van sobre tarjeta blanca: sobre el vino, una tinta oscura ensucia.
  const ponerLogo = (img, xIzq, h) => {
    const w = (img.width / img.height) * h;
    const pad = 5;
    const top = (altoBanda - h) / 2 - pad;
    rect(xIzq - pad, top, w + pad * 2, h + pad * 2, WHITE);
    page.drawImage(img, { x: xIzq, y: H - top - pad - h, width: w, height: h });
    return w;
  };
  ponerLogo(cuc, M + 5, 30);
  const wIdeam = (ideam.width / ideam.height) * 26;
  ponerLogo(ideam, W - M - wIdeam - 5, 26);
  textCenter("Curvas IDF", W / 2, 20, 21, bold, WHITE);
  textCenter("Intensidad · Duración · Frecuencia", W / 2, 46, 9.5, font, rgb(1, 0.9, 0.9));

  // --- Estación ---------------------------------------------------------------
  let y = altoBanda + 4 + 20;
  text("ESTACIÓN", M, y, 7.5, bold, GOLD);
  text(station.nombre, M, y + 11, 15, bold, INK);
  text(`${station.municipio}, ${station.departamento}`, M, y + 30, 10, font, MUTED);
  textRight(`Código ${station.codigo}`, W - M, y + 11, 9.5, font, MUTED);
  textRight(`Generado el ${station.fecha}`, W - M, y + 24, 8.5, font, FAINT);

  const nYears = idf.nYears;
  const chips = [
    `${nYears} ${nYears === 1 ? "año" : "años"} de registro`,
    "Datos cada 10 minutos",
    `${(idf.durations || []).length} duraciones`,
    `${(idf.returnPeriods || []).length} períodos de retorno`,
  ];
  let xChip = M;
  const topChips = y + 48;
  for (const c of chips) {
    const w = font.widthOfTextAtSize(c, 7.5) + 14;
    rect(xChip, topChips, w, 15, CREAM, LINE, 0.5);
    text(c, xChip + 7, topChips + 4.2, 7.5, font, MUTED);
    xChip += w + 6;
  }
  y = topChips + 15;

  // --- Avisos del propio cálculo ---------------------------------------------
  // El dato trae advertencias (registro corto, curvas no monótonas). Un informe
  // que se cita no puede esconderlas.
  const listaAvisos = (idf.warnings || []).filter((w) => typeof w === "string" && w.trim());
  if (listaAvisos.length) {
    const anchoTexto = W - 2 * M - 34;
    const lineas = envolver(listaAvisos[0], font, 7.5, anchoTexto);
    if (listaAvisos.length > 1) {
      lineas.push(`(+${listaAvisos.length - 1} aviso${listaAvisos.length > 2 ? "s" : ""} más en la plataforma)`);
    }
    const alto = 22 + lineas.length * 10;
    y += 12;
    rect(M, y, W - 2 * M, alto, AVISO_FONDO, GOLD, 0.6);
    rect(M, y, 3, alto, GOLD);
    text("LEER ANTES DE USAR", M + 12, y + 5, 7, bold, AVISO_TITULO);
    lineas.forEach((l, i) => text(l, M + 12, y + 16 + i * 10, 7.5, font, AVISO_TINTA));
    y += alto;
  }

  // --- Gráfica ----------------------------------------------------------------
  const altoPlot = 182;
  const plotL = M + 34;
  const plotR = W - M;
  const plotW = plotR - plotL;
  const plotTop = y + 30;
  const plotBot = plotTop + altoPlot;

  const durs = (idf.durations || []).slice().sort((a, b) => a - b);
  let iMin = Infinity;
  let iMax = 0;
  for (const c of idf.curves || []) {
    for (const q of c.points || []) {
      if (q.intensityMmH > 0) {
        iMin = Math.min(iMin, q.intensityMmH);
        iMax = Math.max(iMax, q.intensityMmH);
      }
    }
  }

  if (durs.length && isFinite(iMin) && iMax > 0) {
    // Holgura vertical: sin esto la curva de Tr alto se pega al marco superior.
    const iTop = iMax * 1.12;
    const iBot = iMin / 1.08;
    const lgD = Math.log10(durs[0]);
    const lgDr = Math.log10(durs[durs.length - 1]) - lgD || 1;
    const lgI = Math.log10(iBot);
    const lgIr = Math.log10(iTop) - lgI || 1;
    const xOf = (d) => plotL + ((Math.log10(d) - lgD) / lgDr) * plotW;
    const yOf = (i) => plotBot - ((Math.log10(i) - lgI) / lgIr) * altoPlot;

    rect(plotL, plotTop, plotW, altoPlot, WHITE, LINE, 0.6);
    for (const d of durs) {
      const x = xOf(d);
      line(x, plotTop, x, plotBot, 0.25, GRID);
      textCenter(String(d), x, plotBot + 4, 7, font, MUTED);
    }
    for (const i of ticksLog(iBot, iTop)) {
      const yy = yOf(i);
      if (yy < plotTop - 0.5 || yy > plotBot + 0.5) continue;
      line(plotL, yy, plotR, yy, 0.25, GRID);
      textRight(fmt(i, 0), plotL - 4, yy - 3.5, 7, font, MUTED);
    }
    textCenter("Duración (min, escala logarítmica)", plotL + plotW / 2, plotBot + 16, 8, font, MUTED);
    text("Intensidad (mm/h)", M - 6, plotTop - 12, 8, font, MUTED);

    (idf.returnPeriods || []).forEach((tr, idx) => {
      const curve = (idf.curves || []).find((c) => c.returnPeriod === tr);
      if (!curve) return;
      const color = hexRgb(CURVE_HEX[idx % CURVE_HEX.length]);
      const pts = (curve.points || [])
        .filter((q) => q.intensityMmH > 0)
        .sort((a, b) => a.durMin - b.durMin)
        .map((q) => ({ x: xOf(q.durMin), y: yOf(q.intensityMmH) }));
      for (let k = 1; k < pts.length; k++) {
        page.drawLine({
          start: { x: pts[k - 1].x, y: H - pts[k - 1].y },
          end: { x: pts[k].x, y: H - pts[k].y },
          thickness: 1.4,
          color,
        });
      }
    });

    // Leyenda horizontal FUERA del plot (antes tapaba las curvas).
    const topLeg = plotBot + 30;
    const items = (idf.returnPeriods || []).map((tr) => `Tr ${tr} años`);
    const anchoItem = 78;
    let lx = plotL + Math.max(0, (plotW - items.length * anchoItem) / 2);
    items.forEach((label, idx) => {
      line(lx, topLeg + 4, lx + 14, topLeg + 4, 1.8, hexRgb(CURVE_HEX[idx % CURVE_HEX.length]));
      text(label, lx + 18, topLeg, 7.5, font, INK);
      lx += anchoItem;
    });
    y = topLeg + 14;
  } else {
    y = plotTop;
  }

  // --- Ecuación en formato libro ---------------------------------------------
  // Regla del proyecto: fracción apilada (no lineal) y cada variable definida.
  const eq = idf.equation || {};
  const altoCaja = 92;
  y += 14;
  rect(M, y, W - 2 * M, altoCaja, CREAM, LINE, 0.6);
  text("ECUACIÓN AJUSTADA", M + 12, y + 10, 7.5, bold, GOLD);

  const yBase = y + 34;
  let xEq = M + 14;
  xEq += text("I", xEq, yBase, 13, italic, INK) + 4;
  xEq += text("=", xEq, yBase, 12, font, INK) + 8;

  const num = "K · T";
  const den = "D";
  const wNum = italic.widthOfTextAtSize(num, 11) + 6;
  const wDen = italic.widthOfTextAtSize(den, 11) + 6;
  const wFrac = Math.max(wNum, wDen) + 6;
  let xn = xEq + (wFrac - wNum) / 2;
  xn += text(num, xn, yBase - 8, 11, italic, INK);
  text("m", xn, yBase - 12, 7, italic, INK);
  line(xEq, yBase + 7, xEq + wFrac, yBase + 7, 0.9, INK);
  let xd = xEq + (wFrac - wDen) / 2;
  xd += text(den, xd, yBase + 12, 11, italic, INK);
  text("n", xd, yBase + 8, 7, italic, INK);

  let xv = xEq + wFrac + 22;
  for (const [k, v, dec] of [["K", eq.K, 1], ["m", eq.m, 3], ["n", eq.n, 3]]) {
    xv += text(k, xv, yBase - 2, 9, italic, MUTED) + 2;
    xv += text(`= ${fmt(v, dec)}`, xv, yBase - 2, 9, bold, INK) + 14;
  }
  const r2 = eq.r2;
  if (typeof r2 === "number" && isFinite(r2)) {
    const wR = text("R", xv, yBase - 2, 9, italic, MUTED);
    text("2", xv + wR, yBase - 5, 6, font, MUTED);
    text(`= ${fmt(r2, 3)}`, xv + wR + 5, yBase - 2, 9, bold, INK);
  }

  const defs = [
    "I: intensidad de la lluvia (mm/h)",
    "T: período de retorno (años)",
    "D: duración de la lluvia (min)",
    "K, m, n: parámetros del ajuste",
  ];
  const colW = (W - 2 * M - 28) / 2;
  defs.forEach((d, i) => {
    text(d, M + 14 + (i % 2) * colW, y + 62 + Math.floor(i / 2) * 12, 7.5, font, MUTED);
  });
  y += altoCaja;

  // --- Tabla ------------------------------------------------------------------
  const rows = tableRows(idf);
  const trs = idf.returnPeriods || [];
  y += 14;
  if (rows.length && trs.length) {
    const colDur = 74;
    const colW2 = (W - 2 * M - colDur) / trs.length;
    const hHead = 20;
    const hRow = 17;
    rect(M, y, W - 2 * M, hHead, WINE);
    text("Duración (min)", M + 8, y + 6.5, 8, bold, WHITE);
    trs.forEach((tr, i) => textRight(`Tr ${tr} años`, M + colDur + colW2 * (i + 1) - 8, y + 6.5, 8, bold, WHITE));
    rows.forEach((r, i) => {
      const yy = y + hHead + i * hRow;
      if (i % 2 === 1) rect(M, yy, W - 2 * M, hRow, CREAM);
      text(String(r.dur), M + 8, yy + 5, 8.5, bold, INK);
      r.vals.forEach((v, j) => textRight(fmtFijo(v, 1), M + colDur + colW2 * (j + 1) - 8, yy + 5, 8.5, font, INK));
    });
    const fin = y + hHead + rows.length * hRow;
    line(M, fin, W - M, fin, 0.6, LINE);
    text("Intensidades en milímetros por hora (mm/h).", M, fin + 6, 7.5, font, FAINT);
  }

  // --- Pie --------------------------------------------------------------------
  const topPie = H - 62;
  line(M, topPie, W - M, topPie, 0.8, GOLD);
  const usadas = [...new Set(Object.values(idf.chosenByDuration || {}))].filter(Boolean);
  const ajuste = usadas.length === 1
    ? `Ajuste: ${usadas[0]} en las ${(idf.durations || []).length} duraciones, elegido por AIC.`
    : "Ajuste por duración (Gumbel, GEV o Log-Pearson III), elegido por AIC en cada una.";
  text(`${ajuste} Datos cada 10 minutos del IDEAM.`, M, topPie + 8, 7.5, font, MUTED);
  text("Datos abiertos del IDEAM (datos.gov.co). Uso académico e investigativo.", M, topPie + 19, 7.5, font, MUTED);
  text("Sergio Beltrán Coley · Ingeniería Civil · Universidad de la Costa (CUC)", M, topPie + 33, 7.5, bold, INK);
  textRight("ideam.sergiobc.com", W - M, topPie + 33, 7.5, bold, WINE);
  textRight(station.fecha, W - M, topPie + 19, 7.5, font, FAINT);

  return await doc.save();
}
