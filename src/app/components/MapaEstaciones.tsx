import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point as GeoJsonPoint } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, MapPin } from 'lucide-react';
import { apiJson, apiUrl } from '../lib/ideamApi';
import type {
  AnalyticsByRegionResponse,
  AnalyticsTimeseriesResponse,
  MetaResponse,
} from '../../shared/ideamContracts';

interface StationProperties {
  codigo: string;
  nombre: string | null;
  categoria: string | null;
  tecnologia: string | null;
  estado: string | null;
  departamento: string | null;
  municipio: string | null;
  altitud: number | null;
  zonaHidrografica: string | null;
  corriente: string | null;
  entidad: string | null;
  estadoNorm?: 'activa' | 'otra';
}

interface StationFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: StationProperties;
}

interface StationCollection {
  type: 'FeatureCollection';
  features: StationFeature[];
}

const SOURCE_ID = 'estaciones';
const DEPTOS_SOURCE_ID = 'departamentos';

// Carto basemaps gratuitos (atribución OSM+Carto obligatoria, ya incluida en el estilo).
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [[-82.5, -5], [-66, 14.5]];

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

function normalizeName(value: string) {
  return value.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// El GeoJSON de límites (DANE vía john-guerra) usa nombres antiguos/largos.
const GEO_NAME_ALIASES: Record<string, string> = {
  'SANTAFE DE BOGOTA D.C': 'BOGOTA D.C.',
  'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA': 'SAN ANDRES Y PROVIDENCIA',
};

function popupHtml(p: StationProperties) {
  const row = (label: string, value: unknown) =>
    value === null || value === undefined || value === '' ? '' : `<div><span style="opacity:.65">${label}:</span> ${escapeHtml(value)}</div>`;
  return `
    <div style="font: 12px/1.5 ui-sans-serif, system-ui; min-width: 220px; max-width: 280px;">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${escapeHtml(p.nombre || p.codigo)}</div>
      ${row('Código', p.codigo)}
      ${row('Estado', p.estado)}
      ${row('Categoría', p.categoria)}
      ${row('Municipio', `${p.municipio ?? 'N/D'}, ${p.departamento ?? 'N/D'}`)}
      ${row('Altitud', p.altitud != null && String(p.altitud) !== '' ? `${p.altitud} m` : null)}
      ${row('Corriente', p.corriente)}
      <div class="ideam-spark" style="margin-top: 8px; min-height: 64px; opacity: .8;">Cargando serie histórica...</div>
      <button type="button" class="ideam-compare-btn" style="margin-top: 8px; width: 100%; padding: 5px 8px; border: 1px solid #C9A227; border-radius: 6px; background: rgba(201,162,39,.12); color: #8a6f1a; font-weight: 600; cursor: pointer; font: inherit; font-size: 12px;">
        + Añadir al comparador
      </button>
    </div>`;
}

function sparklineSvg(points: Array<{ bucket: string; value: number | null }>, label: string) {
  const valid = points.filter((p) => p.value !== null) as Array<{ bucket: string; value: number }>;
  if (valid.length < 2) {
    return `<div style="opacity:.65">Sin datos de ${escapeHtml(label)} en esta estación.</div>`;
  }
  const w = 230;
  const h = 44;
  const values = valid.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (valid.length - 1);
  const path = valid
    .map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - 3 - ((p.value - min) / span) * (h - 6)).toFixed(1)}`)
    .join('');
  // Nota XSS: TODO valor dinámico que entra a este HTML pasa por escapeHtml
  // (label, años) o es numérico generado aquí (path con toFixed).
  const first = escapeHtml(valid[0].bucket.slice(0, 4));
  const last = escapeHtml(valid[valid.length - 1].bucket.slice(0, 4));
  return `
    <div style="font-weight:600; margin-bottom:2px;">${escapeHtml(label)} · promedio anual</div>
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Serie anual de la estación">
      <path d="${path}" fill="none" stroke="#C9A227" stroke-width="1.6" />
    </svg>
    <div style="display:flex; justify-content:space-between; opacity:.65; font-size:11px;">
      <span>${first}</span><span>${last}</span>
    </div>`;
}

export default function MapaEstaciones() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sparkDatasetRef = useRef<{ id: string; name: string }>({ id: 's54a-sgyg', name: 'Precipitacion' });
  const boundariesRef = useRef<FeatureCollection | null>(null);

  const [allStations, setAllStations] = useState<StationFeature[]>([]);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState('');

  const [estadoFilter, setEstadoFilter] = useState<'todas' | 'activa' | 'otra'>('todas');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [departamentoFilter, setDepartamentoFilter] = useState('');
  const [sparkDataset, setSparkDataset] = useState('s54a-sgyg');
  const [choroplethOn, setChoroplethOn] = useState(false);
  const [choroplethRange, setChoroplethRange] = useState<{ min: number; max: number } | null>(null);

  // Carga del catálogo de estaciones (cacheado 24h en el borde) + variables.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [stationsResponse, meta] = await Promise.all([
          fetch(apiUrl('/api/stations.geojson'), { headers: { accept: 'application/json' } }),
          apiJson<MetaResponse>('/api/meta', undefined, 'No fue posible cargar la metadata.'),
        ]);
        if (!stationsResponse.ok) throw new Error(`No fue posible cargar las estaciones (HTTP ${stationsResponse.status}).`);
        const data = (await stationsResponse.json()) as StationCollection;
        if (cancelled) return;
        for (const feature of data.features) {
          const estado = (feature.properties.estado || '').toUpperCase();
          feature.properties.estadoNorm = estado.startsWith('ACTIV') ? 'activa' : 'otra';
        }
        setAllStations(data.features);
        setDatasets(meta.datasets.map((d) => ({ id: d.id, name: d.name })));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No fue posible cargar las estaciones.');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const found = datasets.find((d) => d.id === sparkDataset);
    if (found) sparkDatasetRef.current = found;
  }, [datasets, sparkDataset]);

  // Inicialización del mapa (una sola vez).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const isDark = document.documentElement.classList.contains('dark');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      bounds: COLOMBIA_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 46,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#C9A227',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#8a6f1a',
          'circle-radius': ['step', ['get', 'point_count'], 14, 50, 20, 250, 27, 1000, 34],
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#1a1a1a' },
      });
      map.addLayer({
        id: 'station-point',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['match', ['get', 'estadoNorm'], 'activa', '#C9A227', '#A3161A'],
          'circle-radius': 5,
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Click en cluster: acercar hasta expandirlo.
      map.on('click', 'clusters', async (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        if (clusterId === undefined || !source) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: (feature.geometry as GeoJsonPoint).coordinates as [number, number], zoom });
      });

      // Click en estación: ficha + mini-serie histórica de la variable elegida.
      map.on('click', 'station-point', async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties as unknown as StationProperties;
        const coordinates = (feature.geometry as GeoJsonPoint).coordinates.slice() as [number, number];
        const popup = new maplibregl.Popup({ maxWidth: '300px' })
          .setLngLat(coordinates)
          .setHTML(popupHtml(props))
          .addTo(map);

        // Integración con el Comparador: comparte estado vía localStorage.
        const compareButton = popup.getElement()?.querySelector('.ideam-compare-btn') as HTMLButtonElement | null;
        compareButton?.addEventListener('click', () => {
          try {
            const raw = JSON.parse(window.localStorage.getItem('ideam-comparador') || '[]');
            const codes: string[] = Array.isArray(raw) ? raw.map(String) : [];
            if (codes.includes(props.codigo)) {
              compareButton.textContent = 'Ya está en el comparador';
              return;
            }
            if (codes.length >= 5) {
              compareButton.textContent = 'Comparador lleno (máx. 5)';
              return;
            }
            codes.push(props.codigo);
            window.localStorage.setItem('ideam-comparador', JSON.stringify(codes));
            compareButton.textContent = '✓ Añadida — abre el Comparador';
          } catch {
            // best-effort
          }
        });

        const dataset = sparkDatasetRef.current;
        try {
          const series = await apiJson<AnalyticsTimeseriesResponse>(
            '/api/analytics/timeseries',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                datasetId: dataset.id,
                departments: [],
                catalogFilters: { stations: [props.codigo] },
                interval: 'year',
                metric: 'avg',
              }),
            },
            'No fue posible cargar la serie.'
          );
          const target = popup.getElement()?.querySelector('.ideam-spark');
          if (target) target.innerHTML = sparklineSvg(series.points, dataset.name);
        } catch {
          const target = popup.getElement()?.querySelector('.ideam-spark');
          if (target) target.innerHTML = '<div style="opacity:.65">No fue posible cargar la serie.</div>';
        }
      });

      for (const layer of ['clusters', 'station-point']) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      setIsMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const categorias = useMemo(
    () => Array.from(new Set(allStations.map((f) => f.properties.categoria).filter(Boolean))).sort() as string[],
    [allStations]
  );
  const departamentos = useMemo(
    () => Array.from(new Set(allStations.map((f) => f.properties.departamento).filter(Boolean))).sort() as string[],
    [allStations]
  );

  const visibleStations = useMemo(
    () =>
      allStations.filter((f) => {
        if (estadoFilter !== 'todas' && f.properties.estadoNorm !== estadoFilter) return false;
        if (categoriaFilter && f.properties.categoria !== categoriaFilter) return false;
        if (departamentoFilter && f.properties.departamento !== departamentoFilter) return false;
        return true;
      }),
    [allStations, estadoFilter, categoriaFilter, departamentoFilter]
  );

  // Los filtros reescriben la fuente (setData) para que los clusters se
  // recalculen con el subconjunto visible (setFilter dejaría conteos falsos).
  useEffect(() => {
    if (!isMapReady) return;
    const source = mapRef.current?.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: visibleStations } as unknown as FeatureCollection);
  }, [isMapReady, visibleStations]);

  // Coropleta: límites departamentales estáticos + volumen por departamento
  // (by-region nacional, <1s sobre obs_mensual). Capa debajo de los clusters.
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;

    const removeLayers = () => {
      if (map.getLayer('deptos-fill')) map.removeLayer('deptos-fill');
      if (map.getLayer('deptos-line')) map.removeLayer('deptos-line');
      if (map.getSource(DEPTOS_SOURCE_ID)) map.removeSource(DEPTOS_SOURCE_ID);
    };

    if (!choroplethOn) {
      removeLayers();
      setChoroplethRange(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        if (!boundariesRef.current) {
          const response = await fetch('/colombia-departamentos.json');
          if (!response.ok) throw new Error('No fue posible cargar los límites departamentales.');
          boundariesRef.current = (await response.json()) as FeatureCollection;
        }
        const byRegion = await apiJson<AnalyticsByRegionResponse>(
          '/api/analytics/by-region',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ datasetId: sparkDataset, departments: [] }),
          },
          'No fue posible cargar el volumen por departamento.'
        );
        if (cancelled) return;

        // El cagg puede traer variantes del mismo nombre: se agrupan normalizadas.
        const obsByDept = new Map<string, number>();
        for (const region of byRegion.regions) {
          const key = normalizeName(region.department || '');
          obsByDept.set(key, (obsByDept.get(key) || 0) + region.rowCount);
        }

        const merged = {
          type: 'FeatureCollection',
          features: (boundariesRef.current.features || []).map((feature) => {
            const raw = String((feature.properties as Record<string, unknown>)?.NOMBRE_DPT || '');
            const canonical = GEO_NAME_ALIASES[raw] || raw;
            const obs = obsByDept.get(normalizeName(canonical)) || 0;
            return { ...feature, properties: { NOMBRE_DPT: raw, obs } };
          }),
        } as FeatureCollection;

        const counts = merged.features.map((f) => Number((f.properties as { obs?: number })?.obs) || 0);
        const max = Math.max(...counts, 1);
        setChoroplethRange({ min: Math.min(...counts), max });

        removeLayers();
        map.addSource(DEPTOS_SOURCE_ID, { type: 'geojson', data: merged });
        map.addLayer(
          {
            id: 'deptos-fill',
            type: 'fill',
            source: DEPTOS_SOURCE_ID,
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['get', 'obs'],
                0, 'rgba(201,162,39,0.04)',
                max * 0.25, 'rgba(201,162,39,0.25)',
                max * 0.6, 'rgba(201,162,39,0.45)',
                max, 'rgba(163,22,26,0.55)',
              ],
              'fill-outline-color': 'rgba(201,162,39,0.4)',
            },
          },
          'clusters'
        );
        map.addLayer(
          {
            id: 'deptos-line',
            type: 'line',
            source: DEPTOS_SOURCE_ID,
            paint: { 'line-color': 'rgba(201,162,39,0.5)', 'line-width': 0.8 },
          },
          'clusters'
        );
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No fue posible cargar la coropleta.');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isMapReady, choroplethOn, sparkDataset]);

  const sparkDatasetName = datasets.find((d) => d.id === sparkDataset)?.name || 'Precipitacion';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-card-foreground text-2xl font-bold">Mapa de estaciones IDEAM</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {visibleStations.length.toLocaleString('es-CO')} de {allStations.length.toLocaleString('es-CO')} estaciones visibles ·
            <span className="ml-1 inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C9A227]" /> activa
            </span>
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#A3161A]" /> suspendida/otra
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={estadoFilter}
            onChange={(event) => setEstadoFilter(event.target.value as typeof estadoFilter)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Filtrar por estado"
          >
            <option value="todas">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="otra">Suspendidas / otras</option>
          </select>
          <select
            value={categoriaFilter}
            onChange={(event) => setCategoriaFilter(event.target.value)}
            className="h-9 max-w-48 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
          <select
            value={departamentoFilter}
            onChange={(event) => setDepartamentoFilter(event.target.value)}
            className="h-9 max-w-48 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Filtrar por departamento"
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map((departamento) => (
              <option key={departamento} value={departamento}>{departamento}</option>
            ))}
          </select>
          <select
            value={sparkDataset}
            onChange={(event) => setSparkDataset(event.target.value)}
            className="h-9 max-w-48 rounded-lg border border-accent/40 bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Variable para la mini-serie y la coropleta"
            title="Variable para la mini-serie del popup y la coropleta"
          >
            {(datasets.length ? datasets : [{ id: 's54a-sgyg', name: 'Precipitacion' }]).map((dataset) => (
              <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setChoroplethOn((current) => !current)}
            aria-pressed={choroplethOn}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
              choroplethOn
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-card text-muted-foreground hover:border-accent/40'
            }`}
            title="Sombrear departamentos por volumen de observaciones de la variable elegida"
          >
            <Layers className="h-4 w-4" />
            Coropleta
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-border shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <div ref={containerRef} style={{ height: 'calc(100vh - 230px)', minHeight: '420px' }} />
        {(!isMapReady || !allStations.length) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
            <MapPin className="mr-2 h-4 w-4 animate-bounce text-accent" /> Cargando estaciones...
          </div>
        )}
        {choroplethOn && choroplethRange && (
          <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <p className="mb-1 font-semibold text-card-foreground">Observaciones de {sparkDatasetName}</p>
            <div className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(to right, rgba(201,162,39,0.08), rgba(201,162,39,0.45), rgba(163,22,26,0.55))' }} />
            <div className="mt-0.5 flex justify-between">
              <span>{choroplethRange.min.toLocaleString('es-CO', { notation: 'compact' })}</span>
              <span>{choroplethRange.max.toLocaleString('es-CO', { notation: 'compact' })}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Fuente: catálogo nacional de estaciones del IDEAM (datos.gov.co, hp9r-jxuu) sobre el espejo propio. Haz clic en una
        estación para ver su ficha y su serie histórica; los círculos dorados agrupan estaciones cercanas. Límites
        departamentales: DANE (marco geoestadístico, simplificado).
      </p>
    </div>
  );
}
