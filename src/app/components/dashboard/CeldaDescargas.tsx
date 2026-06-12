import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Celda } from './Celda';
import { fmt } from '../../lib/format';

interface HistoryEntry {
  timestamp: string;
  variable: string;
  rowCount: number;
}

/** Resumen compacto del historial local de descargas. */
export function CeldaDescargas({ onClick, indice, className }: { onClick: () => void; indice?: number; className?: string }) {
  const [historial, setHistorial] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      setHistorial(JSON.parse(localStorage.getItem('ideam-history') || '[]'));
    } catch {
      setHistorial([]);
    }
  }, []);

  const totalFilas = historial.reduce((s, h) => s + Number(h.rowCount || 0), 0);
  return (
    <Celda
      titulo="Mis descargas"
      ariaLabel={`Ver historial de descargas: ${historial.length} exportaciones con ${fmt(totalFilas, 0)} filas en total`}
      onClick={onClick}
      indice={indice}
      className={className}
    >
      {historial.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-1">
          <Download className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="text-sm font-semibold text-card-foreground">Aún sin descargas</p>
          <p className="text-xs text-muted-foreground">Tu historial aparecerá aquí</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-2">
          <div className="space-y-1">
            {historial.slice(0, 3).map((h, i) => (
              <div key={`${h.timestamp}-${i}`} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">{h.variable}</span>
                <span className="shrink-0 tabular-nums font-semibold text-card-foreground">{fmt(Number(h.rowCount || 0), 0)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-card-foreground">{fmt(totalFilas, 0)}</strong> filas en {historial.length} exportaciones
          </p>
        </div>
      )}
    </Celda>
  );
}
