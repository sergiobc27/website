import { toPng } from 'html-to-image';

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

// Captura el nodo del gráfico y compone un PNG con encabezado/pie de marca,
// devolviendo el Blob. Respeta el tema (claro/oscuro) leyendo la clase `dark`.
// Reutilizado por la descarga y por la copia al portapapeles.
export async function composeChartPng(node: HTMLElement, meta: ChartMeta): Promise<Blob> {
  const isDark = document.documentElement.classList.contains('dark');
  const bg = isDark ? '#1a1a1a' : '#ffffff';
  const fg = isDark ? '#f3f4f6' : '#1a1a1a';
  const muted = isDark ? '#cccccc' : '#595959';
  const accent = '#C9A227';

  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: bg });
  const chart = new Image();
  await new Promise<void>((resolve, reject) => {
    chart.onload = () => resolve();
    chart.onerror = reject;
    chart.src = dataUrl;
  });

  const pad = 48;
  const headerH = meta.subtitle ? 150 : 108;
  const footerH = 72;
  const canvas = document.createElement('canvas');
  canvas.width = chart.width + pad * 2;
  canvas.height = headerH + chart.height + footerH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textBaseline = 'top';
  ctx.fillStyle = fg;
  ctx.font = '700 40px system-ui, -apple-system, sans-serif';
  ctx.fillText(meta.title, pad, 40);
  if (meta.subtitle) {
    ctx.fillStyle = muted;
    ctx.font = '400 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(meta.subtitle, pad, 94);
  }
  ctx.fillStyle = accent;
  ctx.fillRect(pad, headerH - 18, canvas.width - pad * 2, 3);

  ctx.drawImage(chart, pad, headerH);

  ctx.fillStyle = muted;
  ctx.font = '400 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Generado ${new Date().toLocaleDateString('es-CO')}`, pad, headerH + chart.height + 24);
  const url = 'ideam.sergiobc.com';
  const w = ctx.measureText(url).width;
  ctx.fillText(url, canvas.width - pad - w, headerH + chart.height + 24);

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
