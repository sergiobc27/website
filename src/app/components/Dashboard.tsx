import { useEffect, useState } from 'react';
import { BookOpenText, MapPin, MessageCircle } from 'lucide-react';
import { Celda } from './dashboard/Celda';
import { CeldaAcceso } from './dashboard/CeldaAcceso';
import { CeldaPulso } from './dashboard/CeldaPulso';
import { CeldaLluvia } from './dashboard/CeldaLluvia';
import { CeldaCalendario } from './dashboard/CeldaCalendario';
import { CeldaTop } from './dashboard/CeldaTop';
import { CeldaDescargas } from './dashboard/CeldaDescargas';
import { OPEN_ASISTENTE_EVENT } from './AsistenteFlotante';
import { apiJson } from '../lib/ideamApi';
import type { AnalyticsTimeseriesPoint, AnalyticsTimeseriesResponse } from '../../shared/ideamContracts';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

/**
 * Dashboard bento: centro de mando del espejo. Cada celda navega a su vista
 * (drill-down) y carga sus propios datos — salvo la serie mensual nacional,
 * que se trae UNA vez aquí y alimenta a Lluvia y Calendario.
 */
export function Dashboard({ onNavigate }: DashboardProps) {
  const [serie, setSerie] = useState<AnalyticsTimeseriesPoint[] | null>(null);
  const [serieCargando, setSerieCargando] = useState(true);
  const [serieError, setSerieError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    apiJson<AnalyticsTimeseriesResponse>(
      '/api/analytics/timeseries',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ datasetId: 's54a-sgyg', departments: [], interval: 'month', metric: 'avg' }),
      },
      'sin serie nacional',
    )
      .then((r) => {
        if (!cancelado) setSerie(r.points || []);
      })
      .catch(() => {
        if (!cancelado) setSerieError(true);
      })
      .finally(() => {
        if (!cancelado) setSerieCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-card-foreground">Panel general</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El pulso del espejo de datos hidrometeorológicos. Toca cualquier tarjeta para ver su detalle.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(120px,auto)]">
        <CeldaPulso indice={0} className="min-h-[200px] lg:col-span-2 lg:row-span-2" onClick={() => onNavigate('status')} />
        <CeldaLluvia
          indice={1}
          className="min-h-[200px] lg:col-span-2 lg:row-span-2"
          serie={serie}
          cargando={serieCargando}
          error={serieError}
          onClick={() => onNavigate('analytics')}
        />
        <CeldaTop indice={2} className="min-h-[170px]" onClick={() => onNavigate('analytics')} />
        <CeldaDescargas indice={3} className="min-h-[170px]" onClick={() => onNavigate('history')} />
        <CeldaAcceso
          indice={4}
          icon={BookOpenText}
          titulo="La historia del dato"
          subtitulo="Cómo la lluvia se vuelve curvas IDF"
          ariaLabel="Abrir La historia del dato: el recorrido narrativo de los datos"
          onClick={() => onNavigate('historia')}
        />
        <CeldaAcceso
          indice={5}
          icon={MessageCircle}
          titulo="Asistente Hídrico"
          subtitulo="Resuelve dudas de IDF, SPI y descargas"
          ariaLabel="Abrir el Asistente Hídrico para preguntar sobre los datos"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT))}
        />
        <CeldaCalendario
          indice={6}
          className="min-h-[300px] lg:col-span-4"
          serie={serie}
          cargando={serieCargando}
          error={serieError}
          onClick={() => onNavigate('analytics')}
        />
        <Celda
          indice={7}
          titulo="Mapa de estaciones"
          ariaLabel="Abrir el mapa: explora las más de 17.000 estaciones del catálogo IDEAM"
          onClick={() => onNavigate('map')}
          className="min-h-[90px] lg:col-span-4"
        >
          <div className="flex flex-1 items-center gap-3">
            <MapPin className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <p className="font-bold text-card-foreground">17.976 estaciones en el mapa</p>
              <p className="text-xs text-muted-foreground">Filtra por departamento, zona hidrográfica, río y altitud</p>
            </div>
          </div>
        </Celda>
      </div>
    </div>
  );
}
