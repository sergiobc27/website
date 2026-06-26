// Vistas con ruta propia. 'ficha' tiene ruta base '/ficha' (muestra el selector
// de departamento/municipio); además acepta el deep-link compartible por hash
// con parámetros (#/ficha/DEP/MUN), que se conserva tal cual al pegarlo.
// 'asistente' ya NO es una vista: el Asistente vive en el widget flotante
// (AsistenteFlotante); la URL vieja /asistente la migra un shim en App.
export const VIEWS = [
  'landing', 'dashboard', 'analytics', 'map', 'compare', 'ficha', 'hydro', 'historia', 'metodologia',
  'status', 'extractor', 'history', 'settings', 'docs',
] as const;

// 'landing' vive en la raíz '/'; el panel ('dashboard') en '/app'; el resto en '/<vista>'.
export function viewToPath(view: string): string {
  if (view === 'landing') return '/';
  if (view === 'dashboard') return '/app';
  return `/${view}`;
}

// Deriva la vista desde un pathname. Raíz pelada -> 'landing' (la portada). '/app'
// es el panel. Segmento desconocido -> 'landing'. ('/landing' y '/dashboard' quedan
// como alias inofensivos de sus rutas canónicas '/' y '/app').
export function pathToView(pathname: string): string {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (!seg) return 'landing';
  if (seg === 'app') return 'dashboard';
  return (VIEWS as readonly string[]).includes(seg) ? seg : 'landing';
}

// Evento global de navegación por deep-link (botones de acción del Asistente).
// El Asistente lo emite con { view, params }; App lo escucha, fija la URL y
// cambia de vista. Nombre compartido para no divergir entre emisor y oyente.
export const NAVIGATE_EVENT = 'ideam:navigate';

// Vistas a las que un deep-link del Asistente puede llevar: las únicas que leen
// su estado de la query (useUrlSync). Whitelist de seguridad: el cliente nunca
// navega a una vista fuera de aquí aunque el payload diga otra cosa.
export const ACCION_VIEWS = new Set<string>(['hydro', 'analytics', 'extractor', 'map']);

export interface NavigateDetail {
  view: string;
  params?: Record<string, string>;
}
