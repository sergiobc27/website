import { useState } from 'react';
import { Download, ClipboardCopy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { exportChartPng, copyChartPng } from '../lib/chartExport';

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  subtitle?: string;
  filenameParts: string[];
}

const btnClass =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-accent/40 hover:text-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50';

export function ChartDownloadButton({ targetRef, title, subtitle, filenameParts }: Props) {
  const [busy, setBusy] = useState<null | 'png' | 'copy'>(null);
  const [done, setDone] = useState<null | 'png' | 'copy'>(null);

  const meta = { title, subtitle, filenameParts };

  // Confirmación efímera (check) además del toast: feedback táctil junto al botón.
  const flashDone = (kind: 'png' | 'copy') => {
    setDone(kind);
    setTimeout(() => setDone((current) => (current === kind ? null : current)), 1500);
  };

  const onDownload = async () => {
    if (!targetRef.current || busy) return;
    setBusy('png');
    try {
      await exportChartPng(targetRef.current, meta);
      toast.success('Imagen descargada');
      flashDone('png');
    } catch {
      toast.error('No se pudo generar la imagen');
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    if (!targetRef.current || busy) return;
    setBusy('copy');
    try {
      await copyChartPng(targetRef.current, meta);
      toast.success('Imagen copiada al portapapeles');
      flashDone('copy');
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes('soportado')
          ? 'Tu navegador no permite copiar imágenes; usa Descargar'
          : 'No se pudo copiar la imagen'
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={onCopy}
        disabled={!!busy}
        className={btnClass}
        title="Copiar imagen al portapapeles"
        aria-label="Copiar gráfico como imagen al portapapeles"
      >
        {done === 'copy' ? <Check className="h-4 w-4 text-success" /> : <ClipboardCopy className="h-4 w-4" />}
        {busy === 'copy' ? 'Copiando…' : done === 'copy' ? 'Copiado' : 'Copiar'}
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={!!busy}
        className={btnClass}
        title="Descargar como imagen PNG"
        aria-label="Descargar gráfico como PNG"
      >
        {done === 'png' ? <Check className="h-4 w-4 text-success" /> : <Download className="h-4 w-4" />}
        {busy === 'png' ? 'Generando…' : done === 'png' ? 'Listo' : 'PNG'}
      </button>
    </div>
  );
}
