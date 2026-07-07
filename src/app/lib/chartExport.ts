// El gráfico se rasteriza a este múltiplo de resolución (nitidez retina). El
// encabezado/pie/márgenes se dibujan con las mismas unidades, así que TODO se
// escala por este factor para que el marco de marca quede proporcional al
// gráfico (antes el título y los márgenes salían diminutos junto a un gráfico 2×).
const EXPORT_SCALE = 2;

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
async function capturePlot(
  node: HTMLElement,
): Promise<{ img: HTMLImageElement; width: number; height: number; legend: LegendItem[] }> {
  const lightVars = collectRootVars();
  const usedInline = Object.keys(lightVars).length > 0;
  const appliedKeys = usedInline ? Object.keys(lightVars) : [];
  const prevColorScheme = node.style.colorScheme;
  const root = document.documentElement;
  const wasDark = !usedInline && root.classList.contains('dark');

  if (usedInline) {
    for (const k of appliedKeys) node.style.setProperty(k, lightVars[k]);
    node.style.colorScheme = 'light';
  } else if (wasDark) {
    root.classList.remove('dark');
  }

  try {
    // El <svg> del plot es la superficie de recharts que NO está dentro de la
    // leyenda (esa contiene sus propios <svg> diminutos por cada marcador).
    const plotSvg = Array.from(node.querySelectorAll<SVGElement>('svg.recharts-surface')).find(
      (s) => !s.closest('.recharts-legend-wrapper'),
    );
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
    if (usedInline) {
      for (const k of appliedKeys) node.style.removeProperty(k);
      node.style.colorScheme = prevColorScheme;
    } else if (wasDark) {
      root.classList.add('dark');
    }
  }
}

// Captura el gráfico y compone un PNG con encabezado, leyenda y pie de marca,
// SOLO con canvas (sin html-to-image). Reutilizado por la descarga y la copia.
export async function composeChartPng(node: HTMLElement, meta: ChartMeta): Promise<Blob> {
  const bg = '#ffffff';
  const fg = '#1a1a1a';
  const muted = '#595959';
  const accent = '#C9A227';

  const { img: chart, width: chartCssW, height: chartCssH, legend } = await capturePlot(node);

  // Todo se dibuja a EXPORT_SCALE× para quedar nítido y proporcional al plot.
  const s = EXPORT_SCALE;
  const pad = 48 * s;
  const headerH = (meta.subtitle ? 150 : 108) * s;
  const footerH = 72 * s;
  const plotW = chartCssW * s;
  const plotH = chartCssH * s;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  // Ancho del lienzo: al menos lo que necesita el pie (fecha + URL) para que no
  // se encimen en gráficas angostas (p. ej. copiadas desde el móvil). Si el plot
  // es más angosto que ese mínimo, se centra en el lienzo.
  const footerFont = 24 * s;
  const genText = `Generado ${new Date().toLocaleDateString('es-CO')}`;
  const url = 'ideam.sergiobc.com';
  ctx.font = `400 ${footerFont}px system-ui, -apple-system, sans-serif`;
  const footerNeed = ctx.measureText(genText).width + 60 * s + ctx.measureText(url).width;
  const contentW = Math.max(plotW, footerNeed);
  const canvasW = contentW + pad * 2;
  const plotX = pad + (contentW - plotW) / 2;
  canvas.width = canvasW; // fijar antes de medir texto

  // — Medir la leyenda (para reservar su alto) —
  const legendFont = 26 * s;
  const markerW = 42 * s;
  const markerGap = 12 * s;
  const itemGap = 36 * s;
  const lineH = 42 * s;
  const legendPadY = legend.length ? 14 * s : 0;
  ctx.font = `500 ${legendFont}px system-ui, -apple-system, sans-serif`;
  const measured = legend.map((it) => ({ ...it, w: markerW + markerGap + ctx.measureText(it.label).width }));
  const lines: Array<Array<(typeof measured)[number]>> = [];
  let cur: Array<(typeof measured)[number]> = [];
  let curW = 0;
  for (const it of measured) {
    const add = it.w + (cur.length ? itemGap : 0);
    if (cur.length && curW + add > contentW) {
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

  canvas.height = headerH + legendH + plotH + footerH;

  // Fijar height reinicia el contexto: re-pintar todo desde cero.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // — Encabezado (el tamaño de fuente se reduce si el texto no cabe, para que
  //   nunca se corte en gráficas angostas) —
  const maxTextW = canvas.width - pad * 2;
  const fitPx = (text: string, weight: number, basePx: number) => {
    ctx.font = `${weight} ${basePx}px system-ui, -apple-system, sans-serif`;
    const w = ctx.measureText(text).width;
    const px = w > maxTextW ? Math.max(20 * s, Math.floor((basePx * maxTextW) / w)) : basePx;
    ctx.font = `${weight} ${px}px system-ui, -apple-system, sans-serif`;
  };
  ctx.textBaseline = 'top';
  ctx.fillStyle = fg;
  fitPx(meta.title, 700, 40 * s);
  ctx.fillText(meta.title, pad, 40 * s);
  if (meta.subtitle) {
    ctx.fillStyle = muted;
    fitPx(meta.subtitle, 400, 28 * s);
    ctx.fillText(meta.subtitle, pad, 94 * s);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(pad, headerH - 18 * s, canvas.width - pad * 2, 3 * s);

  // — Leyenda (marcador de color + etiqueta en gris oscuro, centrada) —
  if (legend.length) {
    ctx.font = `500 ${legendFont}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    lines.forEach((line, li) => {
      const totalW = line.reduce((a, it) => a + it.w, 0) + itemGap * (line.length - 1);
      let x = (canvas.width - totalW) / 2;
      const y = headerH + legendPadY + li * lineH + lineH / 2;
      for (const it of line) {
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 4 * s;
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

  // — Gráfico (centrado si es más angosto que el lienzo) —
  ctx.drawImage(chart, plotX, headerH + legendH, plotW, plotH);

  // — Pie —
  const footerY = headerH + legendH + plotH + 24 * s;
  ctx.fillStyle = muted;
  ctx.font = `400 ${footerFont}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(genText, pad, footerY);
  const uw = ctx.measureText(url).width;
  ctx.fillText(url, canvas.width - pad - uw, footerY);

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
