import { ApiError } from './ideamApi';
import { ACCION_VIEWS } from './navigation';

// Un botón de acción (deep-link) que el Worker arma de forma determinista a
// partir del intent resuelto. El frontend NO confía en él a ciegas: parseAcciones
// vuelve a validar la whitelist y a sanear los params antes de pintar nada.
export interface Accion {
  label: string;
  view: string;
  params: Record<string, string>;
}

// Valida y sanea las acciones que llegan en /api/chat. Defensa en profundidad:
// aunque el Worker ya las construye seguras, el cliente descarta vistas fuera de
// la whitelist y params que no sean strings (recortados a 60), y limita a 3.
export function parseAcciones(raw: unknown): Accion[] {
  if (!Array.isArray(raw)) return [];
  const out: Accion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { label, view, params } = item as Record<string, unknown>;
    if (typeof label !== 'string' || !label.trim()) continue;
    if (typeof view !== 'string' || !ACCION_VIEWS.has(view)) continue;
    const limpios: Record<string, string> = {};
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (typeof v === 'string' && v) limpios[k] = v.slice(0, 60);
      }
    }
    out.push({ label: label.slice(0, 80), view, params: limpios });
  }
  return out.slice(0, 3);
}

// Traduce la causa de un fallo del chat a un mensaje amigable en español,
// respetando el 429 (límite de mensajes) con su Retry-After y el timeout.
export function formatChatError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 429) {
      const espera = cause.retryAfterSeconds
        ? ` Intenta de nuevo en ${cause.retryAfterSeconds} s.`
        : ' Intenta de nuevo en un momento.';
      return `Has alcanzado el límite de mensajes por ahora.${espera}`;
    }
    return cause.message;
  }
  if (cause instanceof Error && cause.name === 'AbortError') {
    return 'El asistente tardó demasiado en responder. Intenta de nuevo.';
  }
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  return 'El asistente no está disponible ahora. Intenta de nuevo.';
}

// ¿el scroll está lo bastante cerca del fondo como para auto-desplazar sin pisar
// un scroll-up manual del usuario? `umbral` en px.
export function cercaDelFondo(
  m: { scrollTop: number; scrollHeight: number; clientHeight: number },
  umbral = 120,
): boolean {
  return m.scrollHeight - (m.scrollTop + m.clientHeight) <= umbral;
}
