// El gráfico se rasteriza a este múltiplo de resolución (nitidez retina). El
// encabezado/pie/márgenes se dibujan con las mismas unidades, así que TODO se
// escala por este factor para que el marco de marca quede proporcional al
// gráfico (antes el título y los márgenes salían diminutos junto a un gráfico 2×).
const EXPORT_SCALE = 2;

// Ancho CSS al que se compone SIEMPRE la gráfica, sin importar el dispositivo.
// Los contenedores de recharts usan ancho fluido (100%) pero ALTO fijo en px, así
// que la geometría del plot cambia con el viewport: en escritorio sale ancho y en
// móvil casi cuadrado y "aplastado". Antes de capturar forzamos este ancho para
// que el alto (ya fijo) + este ancho fijo den una imagen idéntica en cualquier
// pantalla (la que se ve bien en un monitor de buena resolución).
const CANONICAL_CSS_WIDTH = 1000;

// Tolerancia: si el plot ya mide ~este ancho no re-maquetamos (evita el reflujo).
const RELAYOUT_TOLERANCE_PX = 8;
// Tras forzar el ancho, recharts re-anima barras/curvas (morph) durante
// `animationDuration` (550 ms en todas las gráficas). Esperamos un poco más para
// capturar el estado final, nunca un fotograma intermedio.
const RELAYOUT_SETTLE_MS = 700;
// Cota de seguridad para no colgar la exportación si el re-maquetado nunca cuadra.
const RELAYOUT_TIMEOUT_MS = 1500;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildFilename(parts: string[], date: Date): string {
  const slug = parts.map(slugify).filter(Boolean).join('-');
  const day = date.toISOString().slice(0, 10);
  return `ideam-${slug}-${day}.png`;
}

interface ChartMeta {
  title: string;
  subtitle?: string;
  filenameParts: string[];
}

// Reúne las variables de tema del bloque :root (los valores CLAROS). Sirven
// para forzar el modo claro en un contenedor aislado sin togglear la clase
// `.dark` global, que repintaba y hacía parpadear toda la página durante la
// captura. Recorre también reglas anidadas (@layer, @media de Tailwind v4).
function collectRootVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  const visit = (rules?: CSSRuleList) => {
    if (!rules) return;
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if ((rule.selectorText || '').split(',').some((s) => s.trim() === ':root')) {
          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            if (prop.startsWith('--')) vars[prop] = rule.style.getPropertyValue(prop);
          }
        }
      } else {
        visit((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Hoja cross-origin: no legible, se ignora.
    }
  }
  return vars;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// El <svg> del plot es la superficie de recharts que NO está dentro de la leyenda
// (esa contiene sus propios <svg> diminutos por cada marcador).
function findPlotSvg(node: HTMLElement): SVGElement | undefined {
  return Array.from(node.querySelectorAll<SVGElement>('svg.recharts-surface')).find(
    (s) => !s.closest('.recharts-legend-wrapper'),
  );
}

function plotSvgWidth(node: HTMLElement): number {
  const svg = findPlotSvg(node);
  if (!svg) return 0;
  return Number(svg.getAttribute('width')) || svg.clientWidth || 0;
}

// Espera a que recharts re-maquete el <svg> del plot al ancho objetivo tras forzar
// el ancho del contenedor. Sale al llegar al objetivo, al estabilizarse el ancho, o
// por timeout (fallback: capturar con lo que haya).
async function waitForPlotWidth(node: HTMLElement, targetCssW: number): Promise<void> {
  const start = performance.now();
  let last = -1;
  let stable = 0;
  while (performance.now() - start < RELAYOUT_TIMEOUT_MS) {
    await nextFrame();
    const w = plotSvgWidth(node);
    if (Math.abs(w - targetCssW) <= RELAYOUT_TOLERANCE_PX) return;
    if (w === last) {
      if (++stable >= 3) return;
    } else {
      stable = 0;
      last = w;
    }
  }
}

// Propiedades de presentación que se copian del SVG vivo al clon serializado.
const SVG_STYLE_PROPS = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight',
  'text-anchor', 'dominant-baseline',
];

// Rasteriza un <svg> de recharts a un <img> PNG (a la resolución de exportación).
// html-to-image NO dibuja de forma fiable el texto ni los ejes del SVG de recharts
// (los números de los ejes salían en blanco); en cambio, serializar el SVG con sus
// estilos computados inlineados y renderizarlo de forma nativa sí los conserva.
async function rasterizeSvg(svg: SVGElement): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  const width = Number(svg.getAttribute('width')) || svg.clientWidth;
  const height = Number(svg.getAttribute('height')) || svg.clientHeight;
  const clone = svg.cloneNode(true) as SVGElement;
  const srcEls = svg.querySelectorAll('*');
  const dstEls = clone.querySelectorAll('*');
  for (let i = 0; i < srcEls.length; i++) {
    const src = srcEls[i];
    const dst = dstEls[i];
    const cs = getComputedStyle(src);
    const cls = src.getAttribute('class') || '';
    // Las series (líneas y áreas) se animan con stroke-dasharray para el
    // "revelado"; al serializar el SVG puede quedar en su estado inicial
    // (p. ej. "0px 982px" = todo hueco) y salir INVISIBLE. Forzamos trazo
    // continuo en ellas, conservando el punteado solo en la rejilla.
    const isSeries = /recharts-(line-curve|area-area|area-curve)/.test(cls);
    let style = '';
    for (const p of SVG_STYLE_PROPS) {
      if (p === 'stroke-dasharray' && isSeries) continue;
      const v = cs.getPropertyValue(p);
      if (v) style += `${p}:${v};`;
    }
    if (isSeries) style += 'stroke-dasharray:none;stroke-dashoffset:0;';
    dst.setAttribute('style', style);
    if (isSeries) {
      dst.removeAttribute('stroke-dasharray');
      dst.removeAttribute('stroke-dashoffset');
    }
    // Quitar los clip-path: recharts usa clipPaths (uno para el área del plot y
    // otro para la animación de revelado); al renderizar el SVG aislado como
    // imagen, esas referencias url(#…) pueden resolverse mal y OCULTAR las
    // series (p. ej. el área de "Total anual" salía vacía). Sin clip los datos
    // caen igual dentro del área, así que se ven completos.
    dst.removeAttribute('clip-path');
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const serialized = new XMLSerializer().serializeToString(clone);
  const svgImg = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized));
  const canvas = document.createElement('canvas');
  canvas.width = width * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
  const img = await loadImage(canvas.toDataURL('image/png'));
  return { img, width, height };
}

interface LegendItem {
  label: string;
  color: string;
}

// Captura el gráfico como imagen SIEMPRE en claro (un PNG oscuro es inservible
// para un informe impreso). Fuerza el tema claro SOLO leyendo las variables del
// nodo (sin tocar el DOM en vivo → sin parpadeo ni conflictos con React), rasteriza
// el <svg> del plot de forma nativa (conserva ejes, números y curvas, cosa que
// html-to-image NO hacía) y extrae los ítems de la leyenda (que van en HTML aparte).
//
// Antes de capturar fuerza el ancho canónico (CANONICAL_CSS_WIDTH): el nodo se
// posiciona FUERA de pantalla con ese ancho fijo, se deja que recharts re-maquete y
// se rasteriza. Como el alto del contenedor ya es fijo en px, forzar el ancho hace
// que la imagen sea IDÉNTICA en móvil y escritorio (la misma que se ve bien en un
// monitor de buena resolución), y no una versión angosta/aplastada en el celular.
// Para que el usuario no vea un salto de maquetación, se congela el alto del
// contenedor padre mientras el nodo está fuera de pantalla (solo se ve el gesto de
// "Generando…"/"Copiando…"). Si el re-maquetado no cuadra a tiempo, se captura con
// lo que haya (nunca falla la exportación).
async function capturePlot(
  node: HTMLElement,
): Promise<{ img: HTMLImageElement; width: number; height: number; legend: LegendItem[] }> {
  const lightVars = collectRootVars();
  const usedInline = Object.keys(lightVars).length > 0;
  const root = document.documentElement;
  const wasDark = !usedInline && root.classList.contains('dark');

  // Snapshot para restaurar EN UN SOLO paso (quita vars de tema, ancho y posición).
  const originalStyle = node.getAttribute('style');
  const parent = node.parentElement;
  const parentPrevMinHeight = parent ? parent.style.minHeight : '';

  const needRelayout = node.clientWidth > 0 && Math.abs(node.clientWidth - CANONICAL_CSS_WIDTH) > RELAYOUT_TOLERANCE_PX;

  if (usedInline) {
    for (const k of Object.keys(lightVars)) node.style.setProperty(k, lightVars[k]);
    node.style.colorScheme = 'light';
  } else if (wasDark) {
    root.classList.remove('dark');
  }

  try {
    if (needRelayout) {
      // Congelar el alto del padre ANTES de sacar el nodo del flujo (evita el salto).
      if (parent) parent.style.minHeight = `${parent.offsetHeight}px`;
      node.style.position = 'fixed';
      node.style.left = '-100000px';
      node.style.top = '0';
      node.style.width = `${CANONICAL_CSS_WIDTH}px`;
      node.style.maxWidth = 'none';
      node.style.zIndex = '-1';
      await waitForPlotWidth(node, CANONICAL_CSS_WIDTH);
      // Dejar terminar el morph de barras/curvas que dispara recharts al re-maquetar.
      await sleep(RELAYOUT_SETTLE_MS);
    }

    const plotSvg = findPlotSvg(node);
    if (!plotSvg) throw new Error('No recharts surface');
    const { img, width, height } = await rasterizeSvg(plotSvg);

    const legend: LegendItem[] = [];
    const wrap = node.querySelector('.recharts-legend-wrapper');
    if (wrap) {
      for (const li of Array.from(wrap.querySelectorAll('.recharts-legend-item'))) {
        const textEl = li.querySelector('.recharts-legend-item-text');
        const label = textEl?.textContent?.trim();
        if (!label) continue;
        const icon = li.querySelector('.recharts-legend-icon');
        const iconCs = icon ? getComputedStyle(icon) : null;
        const color =
          (iconCs && iconCs.stroke && iconCs.stroke !== 'none' ? iconCs.stroke : iconCs?.fill) ||
          (textEl ? getComputedStyle(textEl).color : '') ||
          '#595959';
        legend.push({ label, color });
      }
    }
    return { img, width, height, legend };
  } finally {
    // Restaurar el estilo original del nodo en un solo paso (quita vars, ancho y
    // posición) y liberar el alto congelado del padre.
    if (originalStyle === null) node.removeAttribute('style');
    else node.setAttribute('style', originalStyle);
    if (parent) parent.style.minHeight = parentPrevMinHeight;
    if (wasDark) root.classList.add('dark');
  }
}

// Tamaños de tipografía y márgenes del marco de marca, PUROS (testeable sin DOM).
// Se atan a la dimensión MENOR efectiva del plot — min(ancho, alto·2.6) — y NO al
// ancho: en gráficas anchas-y-bajas atarse al ancho hacía el título/leyenda/pie
// gigantes frente a un plot bajo. Como el alto del plot es fijo por dispositivo y
// el ancho se canoniza al capturar, el marco queda proporcional e IDÉNTICO en móvil
// y escritorio (misma altura ⇒ mismas tipografías, sin importar la pantalla).
export interface ChartLayoutMetrics {
  ref: number;
  pad: number;
  titlePx: number;
  subPx: number;
  legendFont: number;
  footerFont: number;
  dividerH: number;
  titleTop: number;
  subGap: number;
  dividerGap: number;
  headerBottomGap: number;
  markerW: number;
  markerGap: number;
  itemGap: number;
  legendPadY: number;
  legendLineWidth: number;
  footerGap: number;
}

export function chartLayoutMetrics(plotW: number, plotH: number): ChartLayoutMetrics {
  const ref = Math.min(plotW, plotH * 2.6);
  const s = (frac: number) => Math.round(ref * frac);
  return {
    ref,
    pad: s(0.045),
    titlePx: s(0.03),
    subPx: s(0.02),
    legendFont: s(0.018),
    footerFont: s(0.017),
    dividerH: Math.max(2, s(0.0016)),
    titleTop: s(0.028),
    subGap: s(0.012),
    dividerGap: s(0.02),
    headerBottomGap: s(0.028),
    markerW: s(0.04),
    markerGap: s(0.012),
    itemGap: s(0.03),
    legendPadY: s(0.014),
    legendLineWidth: Math.max(2, s(0.0035)),
    footerGap: s(0.022),
  };
}

// Captura el gráfico y compone un PNG con encabezado, leyenda y pie de marca,
// SOLO con canvas (sin html-to-image). Reutilizado por la descarga y la copia.
export async function composeChartPng(node: HTMLElement, meta: ChartMeta): Promise<Blob> {
  const bg = '#ffffff';
  const fg = '#1a1a1a';
  const muted = '#595959';
  const accent = '#C9A227';

  const { img: chart, width: chartCssW, height: chartCssH, legend } = await capturePlot(node);

  // El plot ya viene a EXPORT_SCALE× para quedar nítido. La tipografía y los
  // márgenes salen de chartLayoutMetrics (atados al alto, no al ancho).
  const plotW = chartCssW * EXPORT_SCALE;
  const plotH = chartCssH * EXPORT_SCALE;
  const M = chartLayoutMetrics(plotW, plotH);
  const { pad, titlePx, subPx, legendFont, footerFont, dividerH } = M;
  const font = (weight: number, sizePx: number) => `${weight} ${sizePx}px system-ui, -apple-system, sans-serif`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  const canvasW = plotW + pad * 2;
  const maxTextW = plotW; // = canvasW - pad*2
  canvas.width = canvasW; // fijar antes de medir texto

  // — Alto del encabezado, según el tamaño real de la tipografía —
  const titleTop = M.titleTop;
  const subTop = titleTop + titlePx + M.subGap;
  const dividerY = (meta.subtitle ? subTop + subPx : titleTop + titlePx) + M.dividerGap;
  const headerH = dividerY + dividerH + M.headerBottomGap;

  // — Medir la leyenda (para reservar su alto), con salto de línea si no cabe —
  const markerW = M.markerW;
  const markerGap = M.markerGap;
  const itemGap = M.itemGap;
  const lineH = Math.round(legendFont * 1.7);
  const legendPadY = legend.length ? M.legendPadY : 0;
  ctx.font = font(500, legendFont);
  const measured = legend.map((it) => ({ ...it, w: markerW + markerGap + ctx.measureText(it.label).width }));
  const lines: Array<Array<(typeof measured)[number]>> = [];
  let cur: Array<(typeof measured)[number]> = [];
  let curW = 0;
  for (const it of measured) {
    const add = it.w + (cur.length ? itemGap : 0);
    if (cur.length && curW + add > maxTextW) {
      lines.push(cur);
      cur = [it];
      curW = it.w;
    } else {
      cur.push(it);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);
  const legendH = legend.length ? lines.length * lineH + legendPadY * 2 : 0;

  const footerH = Math.round(footerFont * 2.4);
  canvas.height = headerH + legendH + plotH + footerH;

  // Fijar height reinicia el contexto: re-pintar todo desde cero.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // — Encabezado (reduce la fuente si el texto no cabe, para que nunca se corte) —
  const fitPx = (text: string, weight: number, basePx: number) => {
    ctx.font = font(weight, basePx);
    const w = ctx.measureText(text).width;
    const p = w > maxTextW ? Math.floor((basePx * maxTextW) / w) : basePx;
    ctx.font = font(weight, p);
  };
  ctx.textBaseline = 'top';
  ctx.fillStyle = fg;
  fitPx(meta.title, 700, titlePx);
  ctx.fillText(meta.title, pad, titleTop);
  if (meta.subtitle) {
    ctx.fillStyle = muted;
    fitPx(meta.subtitle, 400, subPx);
    ctx.fillText(meta.subtitle, pad, subTop);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(pad, dividerY, canvasW - pad * 2, dividerH);

  // — Leyenda (marcador de color + etiqueta en gris oscuro, centrada) —
  if (legend.length) {
    ctx.font = font(500, legendFont);
    ctx.textBaseline = 'middle';
    ctx.lineWidth = M.legendLineWidth;
    lines.forEach((line, li) => {
      const totalW = line.reduce((a, it) => a + it.w, 0) + itemGap * (line.length - 1);
      let x = (canvasW - totalW) / 2;
      const y = headerH + legendPadY + li * lineH + lineH / 2;
      for (const it of line) {
        ctx.strokeStyle = it.color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + markerW, y);
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.fillText(it.label, x + markerW + markerGap, y);
        x += it.w + itemGap;
      }
    });
    ctx.textBaseline = 'top';
  }

  // — Gráfico —
  ctx.drawImage(chart, pad, headerH + legendH, plotW, plotH);

  // — Pie —
  const genText = `Generado ${new Date().toLocaleDateString('es-CO')}`;
  const url = 'ideam.sergiobc.com';
  const footerY = headerH + legendH + plotH + M.footerGap;
  ctx.fillStyle = muted;
  ctx.font = font(400, footerFont);
  ctx.fillText(genText, pad, footerY);
  const uw = ctx.measureText(url).width;
  ctx.fillText(url, canvasW - pad - uw, footerY);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No blob');
  return blob;
}

// Descarga el PNG compuesto como archivo.
export async function exportChartPng(node: HTMLElement, meta: ChartMeta): Promise<void> {
  const blob = await composeChartPng(node, meta);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = buildFilename(meta.filenameParts, new Date());
  link.click();
  URL.revokeObjectURL(link.href);
}

// Copia el PNG compuesto al portapapeles (para pegarlo como imagen).
// Pasa una Promise<Blob> al ClipboardItem: así la composición async sigue
// dentro del gesto del usuario (lo exige Safari) y funciona en Chrome/Firefox.
export async function copyChartPng(node: HTMLElement, meta: ChartMeta): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Portapapeles de imágenes no soportado');
  }
  const item = new ClipboardItem({ 'image/png': composeChartPng(node, meta) });
  await navigator.clipboard.write([item]);
}
