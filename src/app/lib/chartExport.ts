import { toPng } from 'html-to-image';

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

// Rasteriza el gráfico a un <img>, SIEMPRE en claro (un PNG con fondo oscuro es
// inservible para pegar en un informe impreso). Se captura el nodo EN VIVO (así
// el tamaño y el detalle son idénticos a los originales), pero forzando el tema
// claro SOLO en ese nodo con variables CSS inline: sus descendientes las heredan
// y el resto de la página no se toca, así que no parpadea. Respaldo (si no se
// pudieron leer las variables, p. ej. hojas cross-origin): quitar `.dark` global.
async function captureChartImage(node: HTMLElement, bg: string): Promise<HTMLImageElement> {
  const lightVars = collectRootVars();
  let dataUrl: string;

  if (Object.keys(lightVars).length > 0) {
    const applied = Object.keys(lightVars);
    for (const k of applied) node.style.setProperty(k, lightVars[k]);
    const prevColorScheme = node.style.colorScheme;
    node.style.colorScheme = 'light';
    try {
      dataUrl = await toPng(node, { pixelRatio: EXPORT_SCALE, cacheBust: true, backgroundColor: bg });
    } finally {
      for (const k of applied) node.style.removeProperty(k);
      node.style.colorScheme = prevColorScheme;
    }
  } else {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');
    try {
      dataUrl = await toPng(node, { pixelRatio: EXPORT_SCALE, cacheBust: true, backgroundColor: bg });
    } finally {
      if (wasDark) root.classList.add('dark');
    }
  }

  const chart = new Image();
  await new Promise<void>((resolve, reject) => {
    chart.onload = () => resolve();
    chart.onerror = reject;
    chart.src = dataUrl;
  });
  return chart;
}

// Captura el nodo del gráfico y compone un PNG con encabezado/pie de marca,
// devolviendo el Blob. Siempre en claro. Reutilizado por la descarga y la copia.
export async function composeChartPng(node: HTMLElement, meta: ChartMeta): Promise<Blob> {
  const bg = '#ffffff';
  const fg = '#1a1a1a';
  const muted = '#595959';
  const accent = '#C9A227';

  const chart = await captureChartImage(node, bg);

  // El gráfico ya viene a EXPORT_SCALE×; el marco se dibuja en esas mismas
  // unidades, así que cada medida se escala igual para quedar proporcional.
  const s = EXPORT_SCALE;
  const pad = 48 * s;
  const headerH = (meta.subtitle ? 150 : 108) * s;
  const footerH = 72 * s;
  const canvas = document.createElement('canvas');
  canvas.width = chart.width + pad * 2;
  canvas.height = headerH + chart.height + footerH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textBaseline = 'top';
  ctx.fillStyle = fg;
  ctx.font = `700 ${40 * s}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(meta.title, pad, 40 * s);
  if (meta.subtitle) {
    ctx.fillStyle = muted;
    ctx.font = `400 ${28 * s}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(meta.subtitle, pad, 94 * s);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(pad, headerH - 18 * s, canvas.width - pad * 2, 3 * s);

  ctx.drawImage(chart, pad, headerH);

  ctx.fillStyle = muted;
  ctx.font = `400 ${24 * s}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(`Generado ${new Date().toLocaleDateString('es-CO')}`, pad, headerH + chart.height + 24 * s);
  const url = 'ideam.sergiobc.com';
  const w = ctx.measureText(url).width;
  ctx.fillText(url, canvas.width - pad - w, headerH + chart.height + 24 * s);

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
