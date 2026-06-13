import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { IdfResponse, FiabilidadNivel } from '../../../shared/ideamContracts';
import { fmt } from '../format';
import { slugify } from '../chartExport';

export interface IdfPdfStation {
  nombre: string;
  codigo: string;
  municipio: string;
  departamento: string;
}

export interface IdfPdfModel {
  titulo: string;
  subtitulo: string;
  estacionNombre: string;
  estacionUbicacion: string;
  chips: string[];
  ecuacion: string;
  ecuacionParams: string;
  cabecera: string[];
  filas: string[][];
  credito: string;
  pie: string;
  fechaTexto: string;
  filename: string;
}

const NIVEL_TEXTO: Record<FiabilidadNivel, string> = {
  verde: 'Alta',
  amarillo: 'Media',
  rojo: 'Baja',
};

export function buildIdfPdfModel(
  idf: IdfResponse,
  station: IdfPdfStation,
  nivel: FiabilidadNivel | null,
  now: Date,
): IdfPdfModel {
  const fecha = now.toLocaleDateString('es-CO');

  // Tabla: una fila por duración, una columna de intensidad (mm/h) por Tr.
  // Mismo criterio que idfChartData en Hidrologia: intensidades > 0.
  const byDur = new Map<number, Record<number, number>>();
  for (const curve of idf.curves) {
    for (const p of curve.points) {
      if (!(p.intensityMmH > 0)) continue;
      const row = byDur.get(p.durMin) || {};
      row[curve.returnPeriod] = p.intensityMmH;
      byDur.set(p.durMin, row);
    }
  }
  const durs = Array.from(byDur.keys()).sort((a, b) => a - b);
  const trs = idf.returnPeriods;
  const filas = durs.map((d) => [
    String(d),
    ...trs.map((tr) => {
      const v = byDur.get(d)?.[tr];
      return v != null ? fmt(v, 1) : '—';
    }),
  ]);

  const chips = [
    idf.nYears != null ? `${idf.nYears} años` : null,
    'datos 10-min',
    nivel ? `Fiabilidad: ${NIVEL_TEXTO[nivel]}` : null,
    `Generado ${fecha}`,
  ].filter(Boolean) as string[];

  const eq = idf.equation;
  const ecuacionParams = eq
    ? `K=${fmt(eq.K, 1)}  m=${fmt(eq.m, 2)}  n=${fmt(eq.n, 2)}  ·  R2_log = ${fmt(eq.r2, 3)}`
    : '';

  return {
    titulo: 'Curvas IDF',
    subtitulo: 'Intensidad-Duracion-Frecuencia',
    estacionNombre: `${station.nombre} · ${station.codigo}`,
    estacionUbicacion: `${station.municipio}, ${station.departamento}`,
    chips,
    ecuacion: 'I = (K · T^m) / D^n',
    ecuacionParams,
    cabecera: ['Dur. (min)', ...trs.map((tr) => `Tr ${tr}a`)],
    filas,
    credito: 'Ingeniero Civil Sergio Beltrán Coley · Universidad de la Costa (CUC)',
    pie: 'Ajuste por duración: Gumbel/GEV/Log-Pearson III (mejor por AIC) · datos 10-min IDEAM.',
    fechaTexto: fecha,
    filename: `curva-idf-${slugify(station.nombre)}-${now.toISOString().slice(0, 10)}.pdf`,
  };
}

export interface IdfPdfAssets {
  chartDataUrl: string;
  logoCuc: string;
  logoIdeam: string;
}

// Paleta CUC (RGB).
const WINE: [number, number, number] = [0xa3, 0x16, 0x1a];
const GOLD: [number, number, number] = [0xc9, 0xa2, 0x27];
const INK: [number, number, number] = [0x1a, 0x1a, 0x1a];
const MUTED: [number, number, number] = [0x59, 0x59, 0x59];

export function renderIdfPdf(model: IdfPdfModel, assets: IdfPdfAssets): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14; // margen lateral

  // --- Encabezado: franja vino + logo CUC + título ---
  doc.setFillColor(...WINE);
  doc.rect(0, 0, W, 28, 'F');
  try { doc.addImage(assets.logoCuc, 'PNG', M, 5, 18, 18); } catch { /* logo opcional */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(model.titulo, M + 22, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(model.subtitulo, M + 22, 20);
  // barra dorada
  doc.setFillColor(...GOLD);
  doc.rect(0, 28, W, 1.6, 'F');

  let y = 40;

  // --- Estación ---
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ESTACIÓN', M, y);
  y += 5.5;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(model.estacionNombre, M, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(model.estacionUbicacion, M, y);
  y += 7;

  // --- Chips (texto separado por ·) ---
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(model.chips.join('   ·   '), M, y);
  y += 8;

  // --- Gráfica IDF (PNG embebido, ancho completo) ---
  const chartW = W - M * 2;
  const chartH = 88;
  try {
    doc.addImage(assets.chartDataUrl, 'PNG', M, y, chartW, chartH);
  } catch { /* si falla la captura, seguimos sin gráfica */ }
  y += chartH + 8;

  // --- Ecuación ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`Ecuación ajustada:   ${model.ecuacion}`, M, y);
  y += 5.5;
  if (model.ecuacionParams) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(model.ecuacionParams, M, y);
    y += 7;
  }

  // --- Tabla de intensidades ---
  autoTable(doc, {
    startY: y,
    head: [model.cabecera],
    body: model.filas,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, halign: 'right', textColor: INK },
    headStyles: { fillColor: WINE, textColor: [255, 255, 255], halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 244, 232] }, // dorado muy claro
    margin: { left: M, right: M },
  });

  // --- Pie ---
  const pageH = doc.internal.pageSize.getHeight();
  const footY = pageH - 22;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(M, footY, W - M, footY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(model.pie, M, footY + 5);
  doc.text(model.credito, M, footY + 9.5);
  try { doc.addImage(assets.logoIdeam, 'PNG', W - M - 16, footY + 3, 16, 8); } catch { /* opcional */ }
  doc.setFontSize(8);
  doc.text('ideam.sergiobc.com', M, footY + 14);
  const pag = `Pág. 1 · ${model.fechaTexto}`;
  doc.text(pag, W - M - doc.getTextWidth(pag), footY + 14);

  return doc;
}
