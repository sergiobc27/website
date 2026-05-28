const PRODUCTION_API_ORIGIN = 'https://ideam.sergiobc.com';

export function apiUrl(path: string) {
  if (path.startsWith('http')) return path;
  if (typeof window === 'undefined') return path;
  return window.location.hostname === 'ideam.sergiobc.com' ? path : `${PRODUCTION_API_ORIGIN}${path}`;
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
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}
