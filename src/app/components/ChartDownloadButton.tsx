import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportChartPng } from '../lib/chartExport';

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  subtitle?: string;
  filenameParts: string[];
}

export function ChartDownloadButton({ targetRef, title, subtitle, filenameParts }: Props) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!targetRef.current || busy) return;
    setBusy(true);
    try {
      await exportChartPng(targetRef.current, { title, subtitle, filenameParts });
      toast.success('Imagen descargada');
    } catch {
      toast.error('No se pudo generar la imagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
      title="Descargar como imagen PNG"
      aria-label="Descargar gráfico como PNG"
    >
      <Download className="h-4 w-4" />
      {busy ? 'Generando…' : 'PNG'}
    </button>
  );
}
