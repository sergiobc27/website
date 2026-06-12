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
