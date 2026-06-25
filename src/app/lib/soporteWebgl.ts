/**
 * `true` si el navegador puede crear un contexto WebGL. Se usa para decidir si se
 * carga la gota 3D (Three.js) o el respaldo SVG estático. Toca el DOM, así que no
 * lleva test unitario (vitest corre en Node sin document).
 */
export function soporteWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
