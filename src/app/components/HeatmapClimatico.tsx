import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { apiJson } from '../lib/ideamApi';
import { fmt } from '../lib/format';
import { ControlSelect } from './ControlSelect';
import { ChartDownloadButton } from './ChartDownloadButton';
import { SkeletonLoader } from './SkeletonLoader';
import {
  colorCalendario,
  matrizAniosMeses,
  matrizUnAnioMeses,
  matrizDiasSemana,
  matrizMesDias,
} from '../lib/heatmap';
import type { AnalyticsTimeseriesResponse } from '../../shared/ideamContracts';

type Vista = 'anios-meses' | 'anio-meses' | 'dias-semana' | 'mes-dias';
type Tamano = 's' | 'm' | 'l';

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MES_LARGO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CELDA_PX: Record<Tamano, number> = { s: 10, m: 16, l: 24 };
const VISTAS: Array<{ value: Vista; label: string; diaria: boolean }> = [
  { value: 'anios-meses', label: 'Años × meses', diaria: false },
  { value: 'anio-meses', label: '1 año × meses', diaria: false },
  { value: 'dias-semana', label: 'Días × día de semana', diaria: true },
  { value: 'mes-dias', label: 'Mes × día', diaria: true },
];

interface Props {
  datasetId: string;
  department: string;
  metric: string;
}

export function HeatmapClimatico({ datasetId, department, metric }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const ahora = new Date().getUTCFullYear();
  const [vista, setVista] = useState<Vista>('anios-meses');
  const [anio, setAnio] = useState(ahora - 1);
  const [mes, setMes] = useState(1);
  const [tamano, setTamano] = useState<Tamano>('m');
  const [expandido, setExpandido] = useState(false);
  const [data, setData] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  const esDiaria = VISTAS.find((v) => v.value === vista)?.diaria ?? false;
  const faltaDepto = esDiaria && !department;

  useEffect(() => {
    if (faltaDepto) {
      setData(null);
      setCargando(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setCargando(true);
      const body: Record<string, unknown> = {
        datasetId,
        departments: department ? [department] : [],
        metric,
        interval: esDiaria ? 'day' : 'month',
      };
      if (vista === 'dias-semana') {
        body.startDate = `${anio}-01-01`;
        body.endDate = `${anio}-12-31`;
      } else if (vista === 'mes-dias') {
        const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
        body.startDate = `${anio}-${String(mes).padStart(2, '0')}-01`;
        body.endDate = `${anio}-${String(mes).padStart(2, '0')}-${fin}`;
      }
      try {
        const res = await apiJson<AnalyticsTimeseriesResponse>(
          '/api/analytics/timeseries',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
          'No fue posible cargar el heatmap.',
        );
        setData(res);
      } catch {
        if (!controller.signal.aborted) setData(null);
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, department, metric, vista, anio, mes, esDiaria, faltaDepto]);

  const points = useMemo(() => data?.points ?? [], [data]);
  const aniosDisponibles = useMemo(() => {
    const ys = new Set<number>();
    for (const pt of points) ys.add(Number(pt.bucket.slice(0, 4)));
    const arr = [...ys].filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
    return arr.length ? arr : [anio];
  }, [points, anio]);

  const px = CELDA_PX[tamano];

  const cuerpo = (() => {
    if (faltaDepto) {
      return (
        <p className="text-sm text-muted-foreground">
          Elige un departamento (en el filtro de ámbito de arriba) para ver el detalle diario.
        </p>
      );
    }
    if (cargando) return <SkeletonLoader rows={4} />;
    if (!points.length) return <p className="text-sm text-muted-foreground">Sin datos para esta combinación.</p>;

    if (vista === 'anios-meses') {
      const m = matrizAniosMeses(points);
      const anios = m.anios.slice(-24);
      return (
        <div className="grid gap-x-1.5 gap-y-1" style={{ gridTemplateColumns: `auto repeat(12, ${px}px)` }}>
          <span />
          {MESES.map((mm, i) => (
            <span key={i} className="text-center text-[10px] text-muted-foreground">{mm}</span>
          ))}
          {anios.map((fila) => (
            <Fila
              key={fila.anio}
              etiqueta={String(fila.anio)}
              valores={fila.meses}
              max={m.max}
              px={px}
              fmtTitulo={(v, i) => `${MES_LARGO[i]} ${fila.anio} — ${fmt((v as number) * 6, 2)} mm/h`}
            />
          ))}
        </div>
      );
    }
    if (vista === 'anio-meses') {
      const m = matrizUnAnioMeses(points, anio);
      return (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
          {m.meses.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className="block w-full rounded-[3px] border border-border/30"
                style={{ height: px * 2, backgroundColor: colorCalendario(v, m.max) }}
                title={v !== null ? `${MES_LARGO[i]} ${anio} — ${fmt(v * 6, 2)} mm/h` : `${MES_LARGO[i]} ${anio} — sin datos`}
              />
              <span className="text-[10px] text-muted-foreground">{MES_LARGO[i]}</span>
            </div>
          ))}
        </div>
      );
    }
    if (vista === 'dias-semana') {
      const m = matrizDiasSemana(points, anio);
      return (
        <div className="flex gap-[3px] overflow-x-auto">
          {m.columnas.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((d, ri) => (
                <span
                  key={ri}
                  className="block rounded-[2px] border border-border/20"
                  style={{ width: px, height: px, backgroundColor: d ? colorCalendario(d.valor, m.max) : 'transparent' }}
                  title={d ? `${d.fecha} — ${d.valor !== null ? fmt(d.valor, 2) : 'sin datos'}` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }
    const m = matrizMesDias(points, anio, mes);
    return (
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(7, ${px * 1.6}px)` }}>
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="text-center text-[10px] text-muted-foreground">{d}</span>
        ))}
        {m.semanas.flat().map((d, i) => (
          <span
            key={i}
            className="flex items-center justify-center rounded-[3px] border border-border/20 text-[9px] tabular-nums text-card-foreground/70"
            style={{ height: px * 1.6, backgroundColor: d ? colorCalendario(d.valor, m.max) : 'transparent' }}
            title={d ? `${d.fecha} — ${d.valor !== null ? fmt(d.valor, 2) : 'sin datos'}` : ''}
          >
            {d ? Number(d.fecha.slice(8, 10)) : ''}
          </span>
        ))}
      </div>
    );
  })();

  const controles = (
    <div className="flex flex-wrap items-end gap-3">
      <ControlSelect
        label="Vista"
        value={vista}
        onChange={(v) => setVista(v as Vista)}
        options={VISTAS.map((v) => ({ value: v.value, label: v.label }))}
      />
      {vista !== 'anios-meses' && (
        <ControlSelect
          label="Año"
          value={String(anio)}
          onChange={(v) => setAnio(Number(v))}
          options={aniosDisponibles.map((y) => ({ value: String(y), label: String(y) }))}
        />
      )}
      {vista === 'mes-dias' && (
        <ControlSelect
          label="Mes"
          value={String(mes)}
          onChange={(v) => setMes(Number(v))}
          options={MES_LARGO.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
      )}
      <div className="flex items-center gap-1" role="group" aria-label="Tamaño">
        {(['s', 'm', 'l'] as Tamano[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTamano(t)}
            aria-pressed={tamano === t}
            className={`h-8 w-8 rounded-md border text-xs font-semibold transition-colors ${
              tamano === t ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );

  const leyenda = !faltaDepto && points.length > 0 && (
    <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
      seco
      {[0.1, 0.35, 0.6, 0.85].map((t) => (
        <span key={t} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: colorCalendario(t, 1) }} />
      ))}
      lluvioso
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-card-foreground">Mapa de calor climático</h3>
          <p className="text-sm text-muted-foreground">{department || 'Todo el país'} · intensidad de lluvia</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ChartDownloadButton
            targetRef={gridRef}
            title="Mapa de calor climático"
            subtitle={department || 'Todo el país'}
            filenameParts={['heatmap', vista]}
          />
          <button
            type="button"
            onClick={() => setExpandido(true)}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/60"
            aria-label="Expandir a pantalla completa"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {controles}
      <div ref={gridRef} className="mt-4 overflow-x-auto bg-card">
        {cuerpo}
        {leyenda}
      </div>

      {expandido && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-card-foreground">
              Mapa de calor climático — {department || 'Todo el país'}
            </h3>
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="rounded-md border border-border p-2 text-muted-foreground hover:bg-muted/60"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-4">{controles}</div>
          <div className="flex-1 overflow-auto">
            {cuerpo}
            {leyenda}
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({
  etiqueta,
  valores,
  max,
  px,
  fmtTitulo,
}: {
  etiqueta: string;
  valores: Array<number | null>;
  max: number;
  px: number;
  fmtTitulo: (v: number | null, i: number) => string;
}) {
  return (
    <>
      <span className="pr-1 text-right text-[10px] tabular-nums text-muted-foreground" style={{ lineHeight: `${px}px` }}>
        {etiqueta}
      </span>
      {valores.map((v, i) => (
        <span
          key={i}
          className="block rounded-[2px] border border-border/30"
          style={{ height: px, backgroundColor: colorCalendario(v, max) }}
          title={v !== null ? fmtTitulo(v, i) : 'sin datos'}
        />
      ))}
    </>
  );
}
