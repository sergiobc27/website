import { ApiError } from './ideamApi';

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
