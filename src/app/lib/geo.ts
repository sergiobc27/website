import type { Feature as GeoJsonFeature, FeatureCollection, Geometry } from 'geojson';
import { daneDeDepartamento } from './departamentos';

export interface EstacionGeo {
  nombre: string;
  municipio: string;
  departamento: string;
}

export interface EstacionFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}
type Feature = EstacionFeature;

// Estación del catálogo (stations.geojson) más cercana a unas coordenadas.
// Distancia equirectangular (corrige la longitud por cos(lat)); suficiente y
// barata para vecino-más-cercano. Devuelve null si no hay features o coords
// inválidas. Las coordenadas nunca salen del navegador: esto corre en el cliente.
export function estacionMasCercana(
  coords: { lat: number; lng: number },
  features: Feature[],
): EstacionGeo | null {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
  if (!Array.isArray(features) || features.length === 0) return null;
  const cosLat = Math.cos((coords.lat * Math.PI) / 180);
  let mejor: Feature | null = null;
  let mejorD = Infinity;
  for (const f of features) {
    const c = f && f.geometry && f.geometry.coordinates;
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const dx = (c[0] - coords.lng) * cosLat;
    const dy = c[1] - coords.lat;
    const d = dx * dx + dy * dy;
    if (d < mejorD) {
      mejorD = d;
      mejor = f;
    }
  }
  if (!mejor) return null;
  const p = mejor.properties || {};
  return {
    nombre: String(p.nombre ?? ''),
    municipio: String(p.municipio ?? ''),
    departamento: String(p.departamento ?? ''),
  };
}

/** Esquina suroeste y noreste, en el orden que espera MapLibre. */
export type Limites = [[number, number], [number, number]];

/**
 * Polígono del departamento cuyo nombre se pasa, buscado por CÓDIGO DANE y no
 * por nombre: la fuente del IDEAM trae el mismo departamento con varias
 * grafías (San Andrés tiene cinco) y el GeoJSON del DANE usa otras distintas
 * ("SANTAFE DE BOGOTA D.C"). El código es el único punto de encuentro fiable.
 */
export function limiteDeDepartamento(
  boundaries: FeatureCollection | null | undefined,
  nombre: string | null | undefined,
): GeoJsonFeature | null {
  const dane = daneDeDepartamento(nombre);
  if (!dane || !boundaries?.features?.length) return null;
  return (
    boundaries.features.find((f) => String((f.properties || {}).DANE || '') === dane) ?? null
  );
}

/**
 * Rectángulo que envuelve una geometría, sea Polygon o MultiPolygon (San Andrés
 * y Nariño lo son). Recorre las coordenadas anidadas sin asumir profundidad, así
 * que también sirve para Point y LineString.
 */
export function bboxDeGeometria(geom: Geometry | null | undefined): Limites | null {
  if (!geom || !('coordinates' in geom)) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visitar = (nodo: unknown) => {
    if (!Array.isArray(nodo)) return;
    if (typeof nodo[0] === 'number' && typeof nodo[1] === 'number') {
      const [lng, lat] = nodo as number[];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const hijo of nodo) visitar(hijo);
  };
  visitar((geom as { coordinates: unknown }).coordinates);

  if (minLng === Infinity) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Rectángulo que envuelve un conjunto de estaciones (puntos). */
export function bboxDeEstaciones(
  features: Array<{ geometry?: { coordinates?: number[] } }>,
): Limites | null {
  return bboxDeGeometria({
    type: 'MultiPoint',
    coordinates: features
      .map((f) => f?.geometry?.coordinates)
      .filter((c): c is number[] => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])),
  });
}
