// Vistas con ruta propia. 'ficha' tiene ruta base '/ficha' (muestra el selector
// de departamento/municipio); además acepta el deep-link compartible por hash
// con parámetros (#/ficha/DEP/MUN), que se conserva tal cual al pegarlo.
// 'asistente' ya NO es una vista: el Asistente vive en el widget flotante
// (AsistenteFlotante); la URL vieja /asistente la migra un shim en App.
export const VIEWS = [
  'dashboard', 'analytics', 'map', 'compare', 'ficha', 'hydro', 'historia',
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
