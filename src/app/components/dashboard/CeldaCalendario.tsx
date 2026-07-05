import { Celda } from './Celda';
import { fmt } from '../../lib/format';
import { colorCalendario, matrizCalendario } from '../../lib/dashboard';
import type { AnalyticsTimeseriesPoint } from '../../../shared/ideamContracts';

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MES_LARGO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MAX_ANIOS = 24;

interface CeldaCalendarioProps {
  serie: AnalyticsTimeseriesPoint[] | null;
  cargando: boolean;
  error: boolean;
  onClick: () => void;
  indice?: number;
  className?: string;
}

/** Heatmap años × meses de la lluvia nacional: la bimodalidad y los fenómenos
 *  (Niña 2010-11, Niño 2015-16) aparecen como patrones de color. */
export function CeldaCalendario({ serie, cargando, error, onClick, indice, className }: CeldaCalendarioProps) {
  const matriz = serie ? matrizCalendario(serie) : { anios: [], max: 0 };
  const anios = matriz.anios.slice(-MAX_ANIOS);

  return (
    <Celda
      titulo="Calendario climático · lámina de lluvia nacional por mes"
      ariaLabel="Ver analítica: calendario climático de la lámina mensual de lluvia nacional (mm/mes) por años y meses; los meses históricamente más lluviosos son abril, mayo, octubre y noviembre"
      onClick={onClick}
      cargando={cargando}
      error={error || !anios.length}
      indice={indice}
      className={className}
    >
      <div className="flex flex-1 flex-col gap-2" aria-hidden="true">
        <div className="grid flex-1 gap-x-1.5 gap-y-1" style={{ gridTemplateColumns: 'auto repeat(12, 1fr)' }}>
          <span />
          {MESES.map((m, i) => (
            <span key={`${m}-${i}`} className="text-center text-[11px] text-muted-foreground">{m}</span>
          ))}
          {anios.map((fila) => (
            <Fila key={fila.anio} fila={fila} max={matriz.max} />
          ))}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          seco
          {[0.1, 0.35, 0.6, 0.85].map((t) => (
            <span key={t} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: colorCalendario(t, 1) }} />
          ))}
          lluvioso
        </div>
      </div>
    </Celda>
  );
}

function Fila({ fila, max }: { fila: { anio: number; meses: Array<number | null> }; max: number }) {
  return (
    <>
      <span className="pr-1 text-right text-[11px] tabular-nums text-muted-foreground">{fila.anio}</span>
      {fila.meses.map((valor, mes) => (
        <span
          key={mes}
          title={valor !== null ? `${MES_LARGO[mes]} ${fila.anio}: ${fmt(valor, 1)} mm/mes` : `${MES_LARGO[mes]} ${fila.anio}: sin datos`}
          className="block min-h-[10px] w-full rounded-[2px] border border-border/30"
          style={{ backgroundColor: colorCalendario(valor, max) }}
        />
      ))}
    </>
  );
}
