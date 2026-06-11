import { useEffect, useRef } from 'react';

// Helpers puros para sincronizar estado de vista <-> query string de la URL.
// Sin React: testeables de forma aislada.

export function parseSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

// Arma la query omitiendo vacíos/undefined; orden alfabético estable para no
// generar replaceStates redundantes cuando el contenido lógico no cambió.
export function buildSearch(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value !== undefined && value !== '') sp.set(key, value);
  }
  return sp.toString();
}

interface UseUrlSyncOptions {
  // Estado actual de la vista, ya serializado a strings. Los valores en su
  // default deben pasarse como `undefined` para mantener la URL limpia.
  params: Record<string, string | undefined>;
  // Restaura el estado desde la URL. Se llama UNA vez en montaje y en cada
  // popstate (atrás/adelante / enlace restaurado). Debe usar solo setters.
  onRestore?: (params: Record<string, string>) => void;
}

// Sincroniza estado de vista con la query string. Escribe con replaceState
// (no crea entradas de historial por cada cambio) y restaura en montaje/popstate.
export function useUrlSync({ params, onRestore }: UseUrlSyncOptions): void {
  const search = buildSearch(params);
  const mounted = useRef(false);

  // WRITE: refleja el estado en la URL cuando cambia. IMPORTANTE: se SALTA la
  // primera pasada para no pisar los params de un enlace pegado antes de que
  // onRestore (efecto de abajo) los lea de la URL original.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const current = window.location.search.replace(/^\?/, '');
    if (current === search) return;
    const url = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', url);
  }, [search]);

  // READ: restaura al montar (la URL aún está intacta porque WRITE se saltó la
  // primera pasada) y ante atrás/adelante.
  useEffect(() => {
    if (!onRestore) return;
    onRestore(parseSearch(window.location.search));
    const handler = () => onRestore(parseSearch(window.location.search));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
    // onRestore debe ser estable (solo setters); deps vacías a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
