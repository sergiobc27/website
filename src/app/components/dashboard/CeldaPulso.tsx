import { useEffect, useRef, useState } from 'react';
import { Database } from 'lucide-react';
import { Celda } from './Celda';
import { apiJson } from '../../lib/ideamApi';
import { fmt } from '../../lib/format';
import { frescuraRelativa, sumarObservaciones } from '../../lib/dashboard';
import type { AnalyticsDatasetsOverviewResponse, MetaResponse } from '../../../shared/ideamContracts';

function formatFreshnessDate(iso: string | null) {
  if (!iso) return 'Sin datos';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Contador 0→total con easing-out; con reduced-motion va directo al valor. */
function useContador(total: number | null) {
  const [valor, setValor] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (total === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValor(total);
      return;
    }
    const inicio = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - inicio) / dur);
      setValor(Math.round(total * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [total]);
  return valor;
}

/** Celda hero: total de observaciones del espejo + frescura del dato. */
export function CeldaPulso({ onClick, indice, className }: { onClick: () => void; indice?: number; className?: string }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [freshness, setFreshness] = useState<{ latestObservation: string | null; lastSync: string | null } | null>(null);
  const contador = useContador(total);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [meta, overview] = await Promise.all([
          apiJson<MetaResponse>('/api/meta', undefined, 'sin metadata'),
          apiJson<AnalyticsDatasetsOverviewResponse>('/api/analytics/datasets-overview', undefined, 'sin overview').catch(() => null),
        ]);
        if (cancelado) return;
        setFreshness(meta.dataFreshness || null);
        setTotal(overview ? sumarObservaciones(overview.datasets || []) : null);
      } catch {
        if (!cancelado) setError(true);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const ultimo = freshness?.latestObservation || null;
  return (
    <Celda
      titulo="Pulso del espejo"
      ariaLabel={`Ver estado del espejo de datos: ${total ? fmt(total, 0) : 'más de 760 millones de'} observaciones, último dato ${formatFreshnessDate(ultimo)}`}
      onClick={onClick}
      cargando={cargando}
      error={error}
      indice={indice}
      className={className}
    >
      <div className="flex flex-1 flex-col justify-between gap-3">
        <div>
          <p className="text-4xl font-bold tabular-nums text-card-foreground lg:text-5xl">
            {total !== null ? fmt(contador, 0) : 'más de 760 M'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">observaciones del IDEAM en el espejo</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Último dato: <strong className="text-card-foreground">{formatFreshnessDate(ultimo)}</strong>
            {ultimo && <span>({frescuraRelativa(ultimo)})</span>}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            Sincronizado {frescuraRelativa(freshness?.lastSync || null) || 'a diario'}
          </span>
        </div>
      </div>
    </Celda>
  );
}
