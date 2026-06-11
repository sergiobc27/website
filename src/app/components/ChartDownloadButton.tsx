import { useState } from 'react';
import { Download, ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';
import { exportChartPng, copyChartPng } from '../lib/chartExport';

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  subtitle?: string;
  filenameParts: string[];
}

const btnClass =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50';

export function ChartDownloadButton({ targetRef, title, subtitle, filenameParts }: Props) {
  const [busy, setBusy] = useState<null | 'png' | 'copy'>(null);

  const meta = { title, subtitle, filenameParts };

  const onDownload = async () => {
    if (!targetRef.current || busy) return;
    setBusy('png');
    try {
      await exportChartPng(targetRef.current, meta);
      toast.success('Imagen descargada');
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
        <ClipboardCopy className="h-4 w-4" />
        {busy === 'copy' ? 'Copiando…' : 'Copiar'}
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={!!busy}
        className={btnClass}
        title="Descargar como imagen PNG"
        aria-label="Descargar gráfico como PNG"
      >
        <Download className="h-4 w-4" />
        {busy === 'png' ? 'Generando…' : 'PNG'}
      </button>
    </div>
  );
}
