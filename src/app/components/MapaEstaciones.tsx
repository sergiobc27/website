import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Point as GeoJsonPoint } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { apiUrl } from '../lib/ideamApi';

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

// Carto basemaps gratuitos (atribución OSM+Carto obligatoria, ya incluida en el estilo).
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [[-82.5, -5], [-66, 14.5]];

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

function popupHtml(p: StationProperties) {
  const row = (label: string, value: unknown) =>
    value === null || value === undefined || value === '' ? '' : `<div><span style="opacity:.65">${label}:</span> ${escapeHtml(value)}</div>`;
  return `
    <div style="font: 12px/1.5 ui-sans-serif, system-ui; min-width: 200px; max-width: 260px;">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${escapeHtml(p.nombre || p.codigo)}</div>
      ${row('Código', p.codigo)}
      ${row('Estado', p.estado)}
      ${row('Categoría', p.categoria)}
      ${row('Tecnología', p.tecnologia)}
      ${row('Municipio', `${p.municipio ?? 'N/D'}, ${p.departamento ?? 'N/D'}`)}
      ${row('Altitud', p.altitud !== null ? `${p.altitud} m` : null)}
      ${row('Zona hidrográfica', p.zonaHidrografica)}
      ${row('Corriente', p.corriente)}
      ${row('Entidad', p.entidad)}
    </div>`;
}

export default function MapaEstaciones() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [allStations, setAllStations] = useState<StationFeature[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState('');

  const [estadoFilter, setEstadoFilter] = useState<'todas' | 'activa' | 'otra'>('todas');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [departamentoFilter, setDepartamentoFilter] = useState('');

  // Carga del catálogo (cacheado 24h en el borde).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/stations.geojson'), { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`No fue posible cargar las estaciones (HTTP ${response.status}).`);
        const data = (await response.json()) as StationCollection;
        if (cancelled) return;
        for (const feature of data.features) {
          const estado = (feature.properties.estado || '').toUpperCase();
          feature.properties.estadoNorm = estado.startsWith('ACTIV') ? 'activa' : 'otra';
        }
        setAllStations(data.features);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No fue posible cargar las estaciones.');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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

      // Click en estación: popup con la ficha.
      map.on('click', 'station-point', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const coordinates = (feature.geometry as GeoJsonPoint).coordinates.slice() as [number, number];
        new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(coordinates)
          .setHTML(popupHtml(feature.properties as unknown as StationProperties))
          .addTo(map);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
          >
            <option value="todas">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="otra">Suspendidas / otras</option>
          </select>
          <select
            value={categoriaFilter}
            onChange={(event) => setCategoriaFilter(event.target.value)}
            className="h-9 max-w-52 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
          <select
            value={departamentoFilter}
            onChange={(event) => setDepartamentoFilter(event.target.value)}
            className="h-9 max-w-52 rounded-lg border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-accent"
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map((departamento) => (
              <option key={departamento} value={departamento}>{departamento}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-border shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <div ref={containerRef} style={{ height: 'calc(100vh - 230px)', minHeight: '420px' }} />
        {(!isMapReady || !allStations.length) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
            <MapPin className="mr-2 h-4 w-4 animate-bounce text-accent" /> Cargando estaciones...
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Fuente: catálogo nacional de estaciones del IDEAM (datos.gov.co, hp9r-jxuu) sobre el espejo propio. Haz clic en una
        estación para ver su ficha; los círculos dorados agrupan estaciones cercanas.
      </p>
    </div>
  );
}
