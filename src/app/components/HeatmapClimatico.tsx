import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { apiJson, ApiError } from '../lib/ideamApi';
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
  type Dia,
} from '../lib/heatmap';
import type { AnalyticsTimeseriesResponse } from '../../shared/ideamContracts';

type Vista = 'anios-meses' | 'anio-meses' | 'dias-semana' | 'mes-dias';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const PX = 24; // tamaño L (único)
const GAP = 3;
const EJE_DIAS_W = 78; // ancho de la columna de etiquetas de día de semana
const EJE_ANIO_W = 48; // ancho de la columna de etiquetas de año

const VISTAS: Array<{ value: Vista; label: string; diaria: boolean }> = [
  { value: 'anios-meses', label: 'Años × meses', diaria: false },
  { value: 'anio-meses', label: 'Un año · meses', diaria: false },
  { value: 'dias-semana', label: 'Año completo · días', diaria: true },
  { value: 'mes-dias', label: 'Un mes · días', diaria: true },
];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`;
}

// Agrupa las columnas-semana por el mes de su primer día, para rotular el eje X.
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
  const [anio, setAnio] = useState(() => Math.min(anioMax ?? ahora, ahora - 1));
  const [mes, setMes] = useState(1);
  const [expandido, setExpandido] = useState(false);
  const [data, setData] = useState<AnalyticsTimeseriesResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  // La diaria nacional puede estar deshabilitada en la API (responde 400). En
  // ese caso pedimos un departamento; cuando la API la habilite, funciona sola.
  const [requiereDepto, setRequiereDepto] = useState(false);

  const esDiaria = VISTAS.find((v) => v.value === vista)?.diaria ?? false;

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
      } catch (e) {
        if (controller.signal.aborted) return;
        setData(null);
        // 400 en diaria nacional = la API aún no permite el país completo: pide departamento.
        if (esDiaria && !department && e instanceof ApiError && e.status === 400) setRequiereDepto(true);
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, department, metric, vista, anio, mes, esDiaria]);

  const points = useMemo(() => data?.points ?? [], [data]);
  // Todos los años del dataset (no solo los que devolvió el fetch).
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
      const anios = m.anios.slice(-24);
      return (
        <div className="inline-block">
          {/* Eje X: meses (nombres completos, verticales para que quepan) */}
          <div className="flex" style={{ paddingLeft: EJE_ANIO_W }}>
            {MESES.map((nombre, i) => (
              <div key={i} className="flex justify-center" style={{ width: PX + GAP }}>
                <span className="text-xs text-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  {nombre}
                </span>
              </div>
            ))}
          </div>
          {anios.map((fila) => (
            <div key={fila.anio} className="flex items-center" style={{ marginTop: GAP }}>
              <span className="pr-2 text-right text-xs tabular-nums text-muted-foreground" style={{ width: EJE_ANIO_W }}>{fila.anio}</span>
              <div className="flex" style={{ gap: GAP }}>
                {fila.meses.map((v, i) => (
                  <span
                    key={i}
                    className="block rounded-[3px] border border-border/30"
                    style={{ width: PX, height: PX, backgroundColor: colorCalendario(v, m.max) }}
                    title={v !== null ? `${MESES[i]} ${fila.anio} — ${fmt(v * 6, 2)} mm/h` : `${MESES[i]} ${fila.anio} — sin datos`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (vista === 'anio-meses') {
      const m = matrizUnAnioMeses(points, anio);
      return (
        <div className="flex flex-wrap gap-3">
          {m.meses.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5" style={{ width: 64 }}>
              <span
                className="block w-full rounded-md border border-border/30"
                style={{ height: 72, backgroundColor: colorCalendario(v, m.max) }}
                title={v !== null ? `${MESES[i]} ${anio} — ${fmt(v * 6, 2)} mm/h` : `${MESES[i]} ${anio} — sin datos`}
              />
              <span className="text-center text-[11px] text-muted-foreground">{MESES[i]}</span>
            </div>
          ))}
        </div>
      );
    }

    // Vistas diarias: año completo o un mes, ambas con ejes (días de semana + meses).
    const md = vista === 'dias-semana' ? matrizDiasSemana(points, anio) : matrizMesDias(points, anio, mes);
    const columnas = 'columnas' in md ? md.columnas : md.semanas;
    return <VistaDiaria columnas={columnas} max={md.max} />;
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
          options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
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

// Cuadrícula diaria con ejes definidos: meses arriba (nombres completos) y días
// de la semana a la izquierda. Compartida por la vista anual y la mensual.
function VistaDiaria({ columnas, max }: { columnas: Array<Array<Dia | null>>; max: number }) {
  const segs = segmentosDeMeses(columnas);
  return (
    <div className="inline-block">
      {/* Eje X: meses */}
      <div className="flex" style={{ paddingLeft: EJE_DIAS_W }}>
        {segs.map((s, i) => (
          <div
            key={i}
            className="shrink-0 truncate pr-2 text-xs font-medium text-muted-foreground"
            style={{ width: s.cols * (PX + GAP) }}
          >
            {s.nombre}
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: GAP }}>
        {/* Eje Y: días de la semana */}
        <div className="flex flex-col" style={{ width: EJE_DIAS_W, gap: GAP }}>
          {DIAS.map((d, i) => (
            <span key={i} className="flex items-center text-xs text-muted-foreground" style={{ height: PX }}>
              {d}
            </span>
          ))}
        </div>
        {/* Columnas-semana */}
        <div className="flex" style={{ gap: GAP }}>
          {columnas.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
              {col.map((d, ri) => (
                <span
                  key={ri}
                  className="block rounded-[3px] border border-border/20"
                  style={{ width: PX, height: PX, backgroundColor: d ? colorCalendario(d.valor, max) : 'transparent' }}
                  title={d ? `${fechaLarga(d.fecha)} — ${d.valor !== null ? fmt(d.valor, 2) : 'sin datos'}` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
