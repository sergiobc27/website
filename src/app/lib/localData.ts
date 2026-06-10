// Claves de datos del usuario en localStorage. NO incluye 'ideam-theme'
// (preferencia, no dato) para no resetear el tema al limpiar.
const DATA_KEYS = [
  'ideam-history',
  'ideam-extractor-config',
  'ideam-extractor-active-job',
  'ideam-comparador',
] as const;

export function clearLocalData(): void {
  for (const key of DATA_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignorar */
    }
  }
}
