import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'idf:chunk-reload';

/**
 * Reintenta una promesa (típicamente un import() dinámico) hasta `retries` veces,
 * con una pausa entre intentos. Puro y testeable (sin DOM).
 */
export async function importWithRetry<T>(factory: () => Promise<T>, retries = 2, delayMs = 350): Promise<T> {
  let ultimoError: unknown;
  for (let intento = 0; intento <= retries; intento++) {
    try {
      return await factory();
    } catch (e) {
      ultimoError = e;
      if (intento < retries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw ultimoError;
}

/**
 * Como React.lazy, pero resiliente a fallos de carga de chunk tras un DESPLIEGUE:
 * reintenta el import dinámico y, si aun así falla (chunk obsoleto en una pestaña
 * que quedó abierta durante el deploy), recarga la página UNA vez para traer
 * index+chunks frescos. Evita bucles de recarga con un flag de sesión que se
 * limpia en el primer import exitoso. Si ya se recargó y sigue fallando, propaga
 * el error para que el ErrorBoundary muestre el fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo contrato que React.lazy: preserva las props del componente
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    importWithRetry(factory)
      .then((mod) => {
        try {
          sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
          /* sessionStorage no disponible: nada que limpiar */
        }
        return mod;
      })
      .catch((err) => {
        try {
          if (!sessionStorage.getItem(RELOAD_FLAG)) {
            sessionStorage.setItem(RELOAD_FLAG, '1');
            window.location.reload();
            // La página se está recargando: nunca resolvemos esta promesa.
            return new Promise<{ default: T }>(() => {});
          }
        } catch {
          /* sin sessionStorage/window: caemos al throw */
        }
        throw err;
      }),
  );
}
