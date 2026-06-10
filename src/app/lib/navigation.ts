// Vistas con ruta propia. 'ficha' NO está aquí: es un deep-link por hash con
// parámetros (#/ficha/DEP/MUN) que se conserva tal cual.
export const VIEWS = [
  'dashboard', 'analytics', 'map', 'compare', 'hydro', 'asistente',
  'status', 'extractor', 'history', 'settings', 'docs',
] as const;

// 'dashboard' vive en la raíz '/'; el resto en '/<vista>'.
export function viewToPath(view: string): string {
  return view === 'dashboard' ? '/' : `/${view}`;
}

// Deriva la vista desde un pathname; segmento desconocido -> 'dashboard'.
export function pathToView(pathname: string): string {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (!seg) return 'dashboard';
  return (VIEWS as readonly string[]).includes(seg) ? seg : 'dashboard';
}
