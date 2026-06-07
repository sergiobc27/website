const PRODUCTION_API_ORIGIN = 'https://ideam.sergiobc.com';

export function apiUrl(path: string) {
  if (path.startsWith('http')) return path;
  if (typeof window === 'undefined') return path;
  const host = window.location.hostname;
  // Same-origin (relative) when served by the production domain or by a local
  // dev server (wrangler dev / vite), so the local Worker handles /api calls and
  // there is no cross-origin CORS block. Other hosts fall back to production.
  if (host === 'ideam.sergiobc.com' || host === 'localhost' || host === '127.0.0.1') return path;
  return `${PRODUCTION_API_ORIGIN}${path}`;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T & { error?: string }> {
  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();

  if (!contentType.includes('application/json')) {
    const isHtml = bodyText.trimStart().startsWith('<!DOCTYPE') || bodyText.trimStart().startsWith('<html');
    const detail = isHtml
      ? 'El servicio respondio con una pagina HTML en vez de datos JSON. Recarga la pagina e intenta de nuevo.'
      : bodyText.slice(0, 240);
    throw new Error(`${fallbackMessage} ${detail}`);
  }

  try {
    return JSON.parse(bodyText) as T & { error?: string };
  } catch {
    throw new Error(`${fallbackMessage} La respuesta JSON esta corrupta o incompleta.`);
  }
}

export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function apiJson<T>(path: string, init: RequestInit | undefined, fallbackMessage: string) {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await parseJsonResponse<T>(response, fallbackMessage);
  if (!response.ok) {
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiError(
      data.error || fallbackMessage,
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
    );
  }
  return data;
}
