import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point as GeoJsonPoint } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { apiJson, apiUrl } from '../lib/ideamApi';
import { useUrlSync } from '../lib/urlState';
import { daneDeDepartamento } from '../lib/departamentos';
import {
  vistaPorId,
  vistasPorFamilia,
  valoresPorDane,
  contarEstacionesPorDane,
  construirFeatures,
  rangoValores,
  expresionRelleno,
  type RegionRow,
} from '../lib/vistasMapa';
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

// Valor de la leyenda con su unidad: enteros para conteos o magnitudes grandes,
// 1 decimal para magnitudes pequeñas (°C, m).
function fmtValorLeyenda(value: number, unidad: string): string {
  const dec = unidad === 'estaciones' || Math.abs(value) >= 100 ? 0 : 1;
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: dec })} ${unidad}`;
}

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
      ${row('DIVIPOLA (depto.)', daneDeDepartamento(p.departamento))}
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

// Alta de la fuente y capas de estaciones. Idempotente: se llama al cargar el
// mapa y de nuevo tras un setStyle (cambio de tema), que descarta las capas.
// Los handlers de click/hover se registran aparte una sola vez (persisten al
// re-crear capas con el mismo id), por eso aquí solo van source + layers.
function addStationLayers(map: maplibregl.Map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 46,
    });
  }
  if (!map.getLayer('clusters')) {
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
  }
  if (!map.getLayer('cluster-count')) {
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
  }
  if (!map.getLayer('station-point')) {
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
  }
}

export default function MapaEstaciones() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Variable de la mini-serie del popup: se deriva de la vista del mapa elegida
  // (precipitación por defecto / cuando no hay vista o es "cobertura").
  const popupDatasetRef = useRef<{ id: string; name: string }>({ id: 's54a-sgyg', name: 'Precipitación' });
  const boundariesRef = useRef<FeatureCollection | null>(null);
  // Cache de by-region por datasetId: evita re-consultar al alternar vistas.
  const byRegionCacheRef = useRef<Map<string, RegionRow[]>>(new Map());

  const [allStations, setAllStations] = useState<StationFeature[]>([]);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string }>>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  // Se incrementa tras un cambio de basemap por tema, para re-disparar los
  // efectos que repueblan datos (estaciones y coropleta) sobre el estilo nuevo.
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [error, setError] = useState('');

  const [estadoFilter, setEstadoFilter] = useState<'todas' | 'activa' | 'otra'>('todas');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [departamentoFilter, setDepartamentoFilter] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [corrienteFilter, setCorrienteFilter] = useState('');
  // Diferido: filtrar 18K features en cada tecla causaba jank (auditoría #5 #13).
  const corrienteQuery = useDeferredValue(corrienteFilter);
  const [altitudMax, setAltitudMax] = useState<number | null>(null); // tope superior (m)
  // Vista temática de la coropleta (id de vistasMapa) o null = solo estaciones.
  const [mapaVista, setMapaVista] = useState<string | null>(null);
  const [leyenda, setLeyenda] = useState<{
    rotulo: string; unidad: string; min: number; max: number; rampa: string[]; invertir: boolean; enRevision: boolean;
  } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Estado en la URL: filtros del mapa + dataset del sparkline + choropleth.
  useUrlSync({
    params: {
      vista: mapaVista ?? undefined,
      estado: estadoFilter === 'todas' ? undefined : estadoFilter,
      cat: categoriaFilter || undefined,
      dep: departamentoFilter || undefined,
      zona: zonaFilter || undefined,
      corriente: corrienteFilter || undefined,
      altmax: altitudMax === null ? undefined : String(altitudMax),
    },
    onRestore: (p) => {
      if (p.vista && vistaPorId(p.vista)) setMapaVista(p.vista);
      // Compatibilidad: enlaces viejos con `choro=1` abrían la coropleta de lluvia.
      else if (p.choro === '1') setMapaVista('lluvia');
      if (p.estado === 'todas' || p.estado === 'activa' || p.estado === 'otra') setEstadoFilter(p.estado);
      if (p.cat) setCategoriaFilter(p.cat);
      if (p.dep) setDepartamentoFilter(p.dep);
      if (p.zona) setZonaFilter(p.zona);
      if (p.corriente) setCorrienteFilter(p.corriente);
      if (p.altmax && Number.isFinite(Number(p.altmax))) setAltitudMax(Number(p.altmax));
    },
  });

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

  // La variable del popup sigue a la vista del mapa: vista de clima/agua => su
  // variable; sin vista o "cobertura" => precipitación.
  useEffect(() => {
    const vista = mapaVista ? vistaPorId(mapaVista) : undefined;
    const id = vista?.datasetId ?? 's54a-sgyg';
    const name = datasets.find((d) => d.id === id)?.name ?? vista?.rotulo ?? 'Precipitación';
    popupDatasetRef.current = { id, name };
  }, [datasets, mapaVista]);

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
      addStationLayers(map);

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
            compareButton.textContent = '✓ Añadida: abre el Comparador';
          } catch {
            // best-effort
          }
        });

        const dataset = popupDatasetRef.current;
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

  // El basemap se fija solo al iniciar; reaccionar a cambios de tema (la clase
  // `dark` en <html> la gestiona lib/theme). setStyle descarta las capas, así
  // que tras cargar el estilo nuevo se re-añaden y se bumpea styleEpoch para
  // que los efectos de datos vuelvan a poblar estaciones y coropleta.
  useEffect(() => {
    const target = document.documentElement;
    let lastDark = target.classList.contains('dark');
    const observer = new MutationObserver(() => {
      const isDark = target.classList.contains('dark');
      if (isDark === lastDark) return;
      lastDark = isDark;
      const map = mapRef.current;
      if (!map) return;
      map.setStyle(isDark ? STYLE_DARK : STYLE_LIGHT);
      map.once('styledata', () => {
        addStationLayers(map);
        setStyleEpoch((epoch) => epoch + 1);
      });
    });
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const categorias = useMemo(
    () => Array.from(new Set(allStations.map((f) => f.properties.categoria).filter(Boolean))).sort() as string[],
    [allStations]
  );
  const departamentos = useMemo(
    () => Array.from(new Set(allStations.map((f) => f.properties.departamento).filter(Boolean))).sort() as string[],
    [allStations]
  );
  const zonas = useMemo(
    () => Array.from(new Set(allStations.map((f) => f.properties.zonaHidrografica).filter(Boolean))).sort() as string[],
    [allStations]
  );
  // Corrientes (ríos): muchas; se ofrecen como datalist para autocompletar.
  const corrientes = useMemo(
    () => Array.from(new Set(allStations.map((f) => f.properties.corriente).filter(Boolean))).sort() as string[],
    [allStations]
  );
  const altitudMaxDisponible = useMemo(
    () => allStations.reduce((max, f) => Math.max(max, Number(f.properties.altitud) || 0), 0),
    [allStations]
  );

  // Match de corriente: parcial e insensible a tildes/mayúsculas (antes la
  // igualdad estricta vaciaba el mapa con texto parcial sin feedback — aud #5 #14).
  const corrienteNorm = useMemo(() => normalizeName(corrienteQuery.trim()), [corrienteQuery]);

  const visibleStations = useMemo(
    () =>
      allStations.filter((f) => {
        const p = f.properties;
        if (estadoFilter !== 'todas' && p.estadoNorm !== estadoFilter) return false;
        if (categoriaFilter && p.categoria !== categoriaFilter) return false;
        if (departamentoFilter && p.departamento !== departamentoFilter) return false;
        if (zonaFilter && p.zonaHidrografica !== zonaFilter) return false;
        if (corrienteNorm && !normalizeName(p.corriente || '').includes(corrienteNorm)) return false;
        if (altitudMax != null) {
          // Altitud desconocida (null/no numérica) NO pasa un filtro de altitud:
          // antes Number(null)=0 la colaba como nivel del mar (auditoría #5 #12).
          const alt = Number(p.altitud);
          if (!Number.isFinite(alt) || alt > altitudMax) return false;
        }
        return true;
      }),
    [allStations, estadoFilter, categoriaFilter, departamentoFilter, zonaFilter, corrienteNorm, altitudMax]
  );

  // Los filtros reescriben la fuente (setData) para que los clusters se
  // recalculen con el subconjunto visible (setFilter dejaría conteos falsos).
  useEffect(() => {
    if (!isMapReady) return;
    const source = mapRef.current?.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: visibleStations } as unknown as FeatureCollection);
  }, [isMapReady, visibleStations, styleEpoch]);

  // Coropleta por VISTA temática: colorea cada departamento por la magnitud del
  // fenómeno (mm/mes, °C, %, nº de estaciones...). Une los límites estáticos con
  // el valor por DANE y deja "sin datos" en gris. Capa debajo de los clusters.
  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;

    const removeLayers = () => {
      if (map.getLayer('deptos-fill')) map.removeLayer('deptos-fill');
      if (map.getLayer('deptos-line')) map.removeLayer('deptos-line');
      if (map.getSource(DEPTOS_SOURCE_ID)) map.removeSource(DEPTOS_SOURCE_ID);
    };

    const vista = mapaVista ? vistaPorId(mapaVista) : undefined;
    if (!vista) {
      removeLayers();
      setLeyenda(null);
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

        let valorPorDane: Map<string, number>;
        if (vista.metrica === 'catalogStations') {
          // Cobertura: cuenta el catálogo de estaciones ya cargado (red real).
          valorPorDane = contarEstacionesPorDane(
            allStations.map((f) => ({ departamento: f.properties.departamento }))
          );
        } else {
          const cacheKey = vista.datasetId as string;
          let regions = byRegionCacheRef.current.get(cacheKey);
          if (!regions) {
            const byRegion = await apiJson<AnalyticsByRegionResponse>(
              '/api/analytics/by-region',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ datasetId: vista.datasetId, departments: [] }),
              },
              'No fue posible cargar los datos por departamento.'
            );
            regions = byRegion.regions as RegionRow[];
            byRegionCacheRef.current.set(cacheKey, regions);
          }
          if (cancelled) return;
          valorPorDane = valoresPorDane(regions, vista.metrica);
        }

        const merged = construirFeatures(boundariesRef.current, valorPorDane);
        const { min, max } = rangoValores([...valorPorDane.values()]);
        setLeyenda({
          rotulo: vista.rotulo,
          unidad: vista.unidad,
          min,
          max,
          rampa: vista.rampa,
          invertir: !!vista.invertir,
          enRevision: !!vista.enRevision,
        });

        // hasData=false => gris neutro (no el color "más bajo", que mentiría).
        const fillColor = [
          'case',
          ['get', 'hasData'],
          expresionRelleno(vista, min, max),
          'rgba(120,120,128,0.18)',
        ] as unknown as maplibregl.ExpressionSpecification;

        removeLayers();
        map.addSource(DEPTOS_SOURCE_ID, { type: 'geojson', data: merged });
        map.addLayer(
          {
            id: 'deptos-fill',
            type: 'fill',
            source: DEPTOS_SOURCE_ID,
            paint: { 'fill-color': fillColor, 'fill-outline-color': 'rgba(201,162,39,0.4)' },
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
  }, [isMapReady, mapaVista, allStations, styleEpoch]);

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
        <div className="w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((open) => !open)}
            aria-expanded={mobileFiltersOpen}
            className="mb-1 inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-card-foreground lg:hidden"
          >
            <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Filtros</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`} />
          </button>
          <div
            className={`${mobileFiltersOpen ? 'flex' : 'hidden'} flex-col gap-2 lg:flex lg:flex-row lg:flex-wrap [&>button]:w-full [&>input]:w-full [&>select]:w-full lg:[&>button]:w-auto lg:[&>input]:w-auto lg:[&>select]:w-auto`}
          >
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
            value={zonaFilter}
            onChange={(event) => setZonaFilter(event.target.value)}
            className="h-9 max-w-48 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Filtrar por zona hidrográfica"
          >
            <option value="">Todas las zonas hidrográficas</option>
            {zonas.map((zona) => (
              <option key={zona} value={zona}>{zona}</option>
            ))}
          </select>
          <input
            list="corrientes-list"
            value={corrienteFilter}
            onChange={(event) => setCorrienteFilter(event.target.value)}
            placeholder="Río / corriente"
            className="h-9 max-w-44 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Filtrar por corriente o río"
          />
          <datalist id="corrientes-list">
            {corrientes.map((corriente) => (
              <option key={corriente} value={corriente} />
            ))}
          </datalist>
          {altitudMaxDisponible > 0 && (
            <select
              value={altitudMax ?? ''}
              onChange={(event) => setAltitudMax(event.target.value ? Number(event.target.value) : null)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
              aria-label="Filtrar por altitud máxima"
              title="Mostrar estaciones hasta esta altitud"
            >
              <option value="">Cualquier altitud</option>
              {[500, 1000, 1500, 2000, 2500, 3000].filter((a) => a < altitudMaxDisponible).map((a) => (
                <option key={a} value={a}>≤ {a} m</option>
              ))}
            </select>
          )}
          <select
            value={mapaVista ?? ''}
            onChange={(event) => setMapaVista(event.target.value || null)}
            className="h-9 max-w-56 rounded-lg border border-accent/40 bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
            aria-label="Colorear el mapa por una variable"
            title="Pinta los departamentos según el fenómeno elegido"
          >
            <option value="">Colorear mapa: ninguno</option>
            {vistasPorFamilia().map((grupo) => (
              <optgroup key={grupo.familia} label={grupo.familia}>
                {grupo.vistas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.rotulo}
                    {v.enRevision ? ' (en revisión)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-border shadow-glow">
        <div ref={containerRef} style={{ height: 'calc(100vh - 230px)', minHeight: '420px' }} />
        {(!isMapReady || !allStations.length) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
            <MapPin className="mr-2 h-4 w-4 animate-bounce text-accent" /> Cargando estaciones...
          </div>
        )}
        {leyenda && (
          <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <p className="mb-1 font-semibold text-card-foreground">{leyenda.rotulo}</p>
            <div
              className="h-2 w-40 rounded-full"
              style={{
                background: `linear-gradient(to right, ${(leyenda.invertir ? [...leyenda.rampa].reverse() : leyenda.rampa).join(', ')})`,
              }}
            />
            <div className="mt-0.5 flex justify-between">
              <span>{fmtValorLeyenda(leyenda.min, leyenda.unidad)}</span>
              <span>{fmtValorLeyenda(leyenda.max, leyenda.unidad)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(120,120,128,0.35)' }} />
              sin datos
            </div>
            {leyenda.enRevision && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Datos en revisión</p>
            )}
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
