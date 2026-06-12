import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Celda } from './Celda';
import { apiJson } from '../../lib/ideamApi';
import { fmt } from '../../lib/format';
import { mesVsHistorico, ultimosMeses } from '../../lib/dashboard';
import type { AnalyticsClimatologyResponse, AnalyticsTimeseriesPoint } from '../../../shared/ideamContracts';

interface CeldaLluviaProps {
  serie: AnalyticsTimeseriesPoint[] | null;
  cargando: boolean;
  error: boolean;
  onClick: () => void;
  indice?: number;
  className?: string;
}

/** Sparkline de la lluvia nacional (12 meses) + mes actual vs su histórico.
 *  Unidad: la serie viene en mm por observación de 10 min → se muestra como
 *  intensidad promedio (mm/h = valor × 6). */
export function CeldaLluvia({ serie, cargando, error, onClick, indice, className }: CeldaLluviaProps) {
  const [clima, setClima] = useState<Array<{ month: number; mean: number | null }>>([]);

  useEffect(() => {
    apiJson<AnalyticsClimatologyResponse>(
      '/api/analytics/monthly-climatology',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId: 's54a-sgyg', departments: [] }),
      },
      'sin climatología',
    )
      .then((r) => setClima(r.months || []))
      .catch(() => {});
  }, []);

  const datos = serie ? ultimosMeses(serie, 12).map((p) => ({ ...p, mmH: p.valor * 6 })) : [];
  const puntoActual = serie ? serie.filter((p) => p.value !== null).at(-1) || null : null;
  const delta = clima.length ? mesVsHistorico(puntoActual, clima) : null;

  return (
    <Celda
      titulo="Lluvia nacional · últimos 12 meses"
      ariaLabel="Ver analítica: intensidad promedio nacional de precipitación de los últimos 12 meses"
      onClick={onClick}
      cargando={cargando}
      error={error || !datos.length}
      indice={indice}
      className={className}
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold text-card-foreground">
            {datos.length ? `${fmt(datos[datos.length - 1].mmH, 2)} mm/h` : '—'}
          </p>
          {delta && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                delta.direccion === 'arriba' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              }`}
            >
              {delta.direccion === 'arriba' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {fmt(delta.pct, 0)}% vs histórico
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">intensidad promedio del mes en curso</p>
        <div className="min-h-0 flex-1" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datos} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="etiqueta" stroke="currentColor" className="text-muted-foreground" style={{ fontSize: '10px' }} minTickGap={24} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)', fontSize: 12 }}
                formatter={(v) => [`${fmt(Number(v), 2)} mm/h`, 'intensidad prom.']}
              />
              <Area type="monotone" dataKey="mmH" stroke="#2563eb" strokeWidth={2} fill="#2563eb" fillOpacity={0.18} isAnimationActive animationDuration={550} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Celda>
  );
}
