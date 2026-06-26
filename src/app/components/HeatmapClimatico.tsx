import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { InfoGrafica } from './InfoGrafica';
import { apiJson, ApiError } from '../lib/ideamApi';
import { fmt } from '../lib/format';
import { ControlSelect } from './ControlSelect';
import { ChartDownloadButton } from './ChartDownloadButton';
import { SkeletonLoader } from './SkeletonLoader';
import {
  colorCalendario,
  matrizAniosMeses,
  matrizDiasSemana,
  matrizMesesDias,
  type Dia,
} from '../lib/heatmap';
import type { AnalyticsTimeseriesResponse } from '../../shared/ideamContracts';

type Vista = 'anios-meses' | 'anio-dias';
type Orientacion = 'meses-dias' | 'semana-semanas';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const GAP = 2;

const VISTAS: Array<{ value: Vista; label: string; diaria: boolean }> = [
  { value: 'anios-meses', label: 'Años × meses', diaria: false },
  { value: 'anio-dias', label: 'Un año · días', diaria: true },
];
const ORIENTACIONES: Array<{ value: Orientacion; label: string }> = [
  { value: 'meses-dias', label: 'Meses × días del mes' },
  { value: 'semana-semanas', label: 'Día de semana × semanas' },
];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`;
}

// Agrupa columnas-semana por el mes de su primer día (para rotular el eje X).
function segmentosDeMeses(columnas: Array<Array<Dia | null>>): Array<{ nombre: string; cols: number }> {
  const segs: Array<{ nombre: string; cols: number }> = [];
  let mesActual = -1;
  let cuenta = 0;
  for (const col of columnas) {
    const primer = col.find((d) => d) || null;
    const mes = primer ? Number(primer.fecha.slice(5, 7)) - 1 : mesActual;
    if (mes !== mesActual) {
      if (cuenta && mesActual >= 0) segs.push({ nombre: MESES[mesActual], cols: cuenta });
      mesActual = mes;
      cuenta = 1;
    } else {
      cuenta += 1;
    }
  }
  if (cuenta && mesActual >= 0) segs.push({ nombre: MESES[mesActual], cols: cuenta });
  return segs;
}

interface Props {
  datasetId: string;
  department: string;
  metric: string;
  anioMin?: number;
  anioMax?: number;
}

export function HeatmapClimatico({ datasetId, department, metric, anioMin, anioMax }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const ahora = new Date().getUTCFullYear();
  const [vista, setVista] = useState<Vista>('anios-meses');
  const [orientacion, setOrientacion] = useState<Orientacion>('meses-dias');
  const [anio, setAnio] = useState(() => Math.min(anioMax ?? ahora, ahora - 1));
  const [expandido, setExpandido] = useState(false);
  const [data, setData] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  // La diaria nacional puede estar deshabilitada en la API (responde 400). En
  // ese caso pedimos un departamento; cuando la API la habilite, funciona sola.
  const [requiereDepto, setRequiereDepto] = useState(false);

  const esDiaria = vista === 'anio-dias';

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setCargando(true);
      setRequiereDepto(false);
      const body: Record<string, unknown> = {
        datasetId,
        departments: department ? [department] : [],
        metric,
        interval: esDiaria ? 'day' : 'month',
      };
      if (esDiaria) {
        body.startDate = `${anio}-01-01`;
        body.endDate = `${anio}-12-31`;
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
      } catch (e) {
        if (controller.signal.aborted) return;
        setData(null);
        if (esDiaria && !department && e instanceof ApiError && e.status === 400) setRequiereDepto(true);
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, department, metric, vista, anio, esDiaria]);

  const points = useMemo(() => data?.points ?? [], [data]);
  const aniosDisponibles = useMemo(() => {
    const max = anioMax ?? ahora;
    const min = Math.min(anioMin ?? 2003, max);
    const arr: number[] = [];
    for (let y = max; y >= min; y--) arr.push(y);
    return arr;
  }, [anioMin, anioMax, ahora]);

  const cuerpo = (() => {
    if (cargando) return <SkeletonLoader rows={4} />;
    if (requiereDepto) {
      return (
        <p className="text-sm text-muted-foreground">
          Elige un departamento (en el filtro de ámbito de arriba) para ver el detalle diario.
        </p>
      );
    }
    if (!points.length) return <p className="text-sm text-muted-foreground">Sin datos para esta combinación.</p>;

    if (vista === 'anios-meses') {
      const m = matrizAniosMeses(points);
      return <AniosMeses anios={m.anios.slice(-24)} max={m.max} />;
    }
    if (orientacion === 'meses-dias') {
      const m = matrizMesesDias(points, anio);
      return <MesesDias filas={m.filas} max={m.max} anio={anio} />;
    }
    const m = matrizDiasSemana(points, anio);
    return <SemanaSemanas columnas={m.columnas} max={m.max} />;
  })();

  const controles = (
    <div className="flex flex-wrap items-end gap-3">
      <ControlSelect label="Vista" value={vista} onChange={(v) => setVista(v as Vista)} options={VISTAS.map((v) => ({ value: v.value, label: v.label }))} />
      {esDiaria && (
        <ControlSelect label="Disposición" value={orientacion} onChange={(v) => setOrientacion(v as Orientacion)} options={ORIENTACIONES} />
      )}
      {esDiaria && (
        <ControlSelect label="Año" value={String(anio)} onChange={(v) => setAnio(Number(v))} options={aniosDisponibles.map((y) => ({ value: String(y), label: String(y) }))} />
      )}
    </div>
  );

  const leyenda = !requiereDepto && points.length > 0 && (
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
          <InfoGrafica id="heatmap" />
          <ChartDownloadButton targetRef={gridRef} title="Mapa de calor climático" subtitle={department || 'Todo el país'} filenameParts={['heatmap', vista]} />
          <button type="button" onClick={() => setExpandido(true)} className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/60" aria-label="Expandir a pantalla completa">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {controles}
      <div ref={gridRef} className="mt-4 w-full bg-card">
        {cuerpo}
        {leyenda}
      </div>

      {expandido && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-6 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-card-foreground">Mapa de calor climático: {department || 'Todo el país'}</h3>
            <button type="button" onClick={() => setExpandido(false)} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-muted/60" aria-label="Cerrar">
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

// Años (filas) × meses (columnas). Ocupa todo el ancho.
function AniosMeses({ anios, max }: { anios: Array<{ anio: number; meses: Array<number | null> }>; max: number }) {
  return (
    <div className="grid w-full items-center" style={{ gridTemplateColumns: '52px repeat(12, minmax(0, 1fr))', gap: GAP }}>
      <div />
      {MESES.map((m, i) => (
        <div key={i} className="truncate px-0.5 text-center text-[11px] text-muted-foreground">{m}</div>
      ))}
      {anios.map((fila) => (
        <Fragment key={fila.anio}>
          <div className="pr-2 text-right text-xs tabular-nums text-muted-foreground">{fila.anio}</div>
          {fila.meses.map((v, i) => (
            <div
              key={i}
              className="rounded-[3px] border border-border/30"
              style={{ height: 24, backgroundColor: colorCalendario(v, max) }}
              title={`${MESES[i]} ${fila.anio}: ${v !== null ? fmt(v, 2) : 'sin datos'}`}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

// Meses (filas) × día del mes 1..31 (columnas). Ocupa todo el ancho.
function MesesDias({ filas, max, anio }: { filas: Array<Array<number | null>>; max: number; anio: number }) {
  return (
    <div className="grid w-full items-center" style={{ gridTemplateColumns: '92px repeat(31, minmax(0, 1fr))', gap: GAP }}>
      <div />
      {Array.from({ length: 31 }, (_, i) => (
        <div key={i} className="text-center text-[9px] tabular-nums text-muted-foreground">{i + 1}</div>
      ))}
      {filas.map((dias, mes) => (
        <Fragment key={mes}>
          <div className="pr-2 text-right text-[11px] text-muted-foreground">{MESES[mes]}</div>
          {dias.map((v, d) => (
            <div
              key={d}
              className="rounded-[2px] border border-border/20"
              style={{ height: 22, backgroundColor: colorCalendario(v, max) }}
              title={`${d + 1} de ${MESES[mes]} de ${anio}: ${v !== null ? fmt(v, 2) : 'sin datos'}`}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

// Día de la semana (filas) × semanas (columnas). Ocupa todo el ancho; rótulos de
// mes arriba alineados a las columnas que abarca cada uno.
function SemanaSemanas({ columnas, max }: { columnas: Array<Array<Dia | null>>; max: number }) {
  const segs = segmentosDeMeses(columnas);
  const ncols = columnas.length;
  const tpl = `64px repeat(${ncols}, minmax(0, 1fr))`;
  let acc = 0;
  return (
    <div className="w-full">
      {/* eje X: meses */}
      <div className="grid w-full" style={{ gridTemplateColumns: tpl, gap: GAP }}>
        <div />
        {segs.map((s, i) => {
          const start = 2 + acc;
          acc += s.cols;
          return (
            <div key={i} className="truncate pr-1 text-[11px] text-muted-foreground" style={{ gridColumn: `${start} / span ${s.cols}` }}>
              {s.nombre}
            </div>
          );
        })}
      </div>
      {/* filas: una por día de la semana */}
      {DIAS.map((dia, r) => (
        <div key={r} className="grid w-full items-center" style={{ gridTemplateColumns: tpl, gap: GAP, marginTop: GAP }}>
          <div className="pr-2 text-right text-[11px] text-muted-foreground">{dia}</div>
          {columnas.map((col, c) => {
            const d = col[r];
            return (
              <div
                key={c}
                className="rounded-[2px] border border-border/20"
                style={{ height: 15, backgroundColor: d ? colorCalendario(d.valor, max) : 'transparent' }}
                title={d ? `${fechaLarga(d.fecha)}: ${d.valor !== null ? fmt(d.valor, 2) : 'sin datos'}` : ''}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
