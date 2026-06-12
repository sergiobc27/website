import { useEffect, useState } from 'react';
import { Celda } from './Celda';
import { apiJson } from '../../lib/ideamApi';
import { fmt } from '../../lib/format';
import type { AnalyticsByRegionResponse } from '../../../shared/ideamContracts';

interface TopFila {
  nombre: string;
  valor: number;
}

/** Top 5 departamentos por precipitación media (mm/h prom = mean × 6). */
export function CeldaTop({ onClick, indice, className }: { onClick: () => void; indice?: number; className?: string }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [filas, setFilas] = useState<TopFila[]>([]);

  useEffect(() => {
    apiJson<AnalyticsByRegionResponse>(
      '/api/analytics/by-region',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId: 's54a-sgyg', departments: [] }),
      },
      'sin regiones',
    )
      .then((r) => {
        const top = (r.regions || [])
          .filter((x) => x.mean !== null)
          .sort((a, b) => (b.mean as number) - (a.mean as number))
          .slice(0, 5)
          .map((x) => ({ nombre: x.department, valor: (x.mean as number) * 6 }));
        setFilas(top);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  const max = filas.length ? filas[0].valor : 0;
  return (
    <Celda
      titulo="Donde más llueve"
      ariaLabel={`Ver analítica: los departamentos con mayor intensidad de lluvia promedio son ${filas.map((f) => f.nombre).join(', ') || 'cargando'}`}
      onClick={onClick}
      cargando={cargando}
      error={error || !filas.length}
      indice={indice}
      className={className}
    >
      <div className="flex flex-1 flex-col justify-center gap-1.5" aria-hidden="true">
        {filas.map((f) => (
          <div key={f.nombre} className="flex items-center gap-2 text-xs">
            <span className="w-24 truncate text-muted-foreground">{f.nombre}</span>
            <span className="h-2 rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${Math.max(8, (f.valor / max) * 100 * 0.6)}%` }} />
            <span className="tabular-nums font-semibold text-card-foreground">{fmt(f.valor, 1)}</span>
          </div>
        ))}
        <p className="mt-1 text-[10px] text-muted-foreground">mm/h promedio histórico</p>
      </div>
    </Celda>
  );
}
