import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { daneDeDepartamento } from '../lib/departamentos';

// Selector de territorio en mapa (Fase 3): variante "picker" de MapaEstaciones.
// Solo dibuja los límites departamentales; un clic en un departamento lo
// agrega/quita de la selección. El match es por código DIVIPOLA/DANE (no por
// nombre): robusto frente a alias (Bogotá, San Andrés, tildes). MapLibre se
// importa de forma diferida (lazy) para no inflar el bundle del extractor.

const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [[-82.5, -5], [-66, 14.5]];
const SOURCE_ID = 'picker-departamentos';

export default function MapaSelectorDepartamentos({
  departments,
  selected,
  onToggle,
}: {
  departments: string[];
  selected: string[];
  onToggle: (department: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // Refs a los últimos valores para que el handler de click (registrado una vez)
  // siempre lea la lista de departamentos y el toggle vigentes.
  const departmentsRef = useRef(departments);
  const onToggleRef = useRef(onToggle);
  departmentsRef.current = departments;
  onToggleRef.current = onToggle;

  const selectedDane = Array.from(new Set(selected.map(daneDeDepartamento).filter(Boolean))) as string[];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const isDark = document.documentElement.classList.contains('dark');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      bounds: COLOMBIA_BOUNDS,
      fitBoundsOptions: { padding: 12 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      void (async () => {
        try {
          const response = await fetch('/colombia-departamentos.json');
          if (!response.ok) throw new Error('No fue posible cargar los límites departamentales.');
          const data = (await response.json()) as FeatureCollection;
          if (!mapRef.current) return;
          map.addSource(SOURCE_ID, { type: 'geojson', data });
          map.addLayer({
            id: 'picker-base',
            type: 'fill',
            source: SOURCE_ID,
            paint: { 'fill-color': 'rgba(201,162,39,0.06)' },
          });
          map.addLayer({
            id: 'picker-sel',
            type: 'fill',
            source: SOURCE_ID,
            filter: ['in', ['get', 'DANE'], ['literal', []]],
            paint: { 'fill-color': 'rgba(201,162,39,0.45)' },
          });
          map.addLayer({
            id: 'picker-line',
            type: 'line',
            source: SOURCE_ID,
            paint: { 'line-color': 'rgba(201,162,39,0.55)', 'line-width': 0.8 },
          });

          map.on('click', 'picker-base', (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            const props = feature.properties as Record<string, unknown>;
            const dane = String(props?.DANE || '') || daneDeDepartamento(String(props?.NOMBRE_DPT || '')) || '';
            if (!dane) return;
            const match = departmentsRef.current.find((department) => daneDeDepartamento(department) === dane);
            if (match) onToggleRef.current(match);
          });
          map.on('mouseenter', 'picker-base', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'picker-base', () => {
            map.getCanvas().style.cursor = '';
          });

          setReady(true);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar el mapa.');
        }
      })();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Resalta los departamentos seleccionados (por DANE) cuando cambia la selección.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer('picker-sel')) return;
    map.setFilter('picker-sel', ['in', ['get', 'DANE'], ['literal', selectedDane]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedDane.join(',')]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      <div ref={containerRef} style={{ height: 320 }} />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs text-muted-foreground">
          Cargando mapa…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/85 p-3 text-center text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
