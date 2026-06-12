import { describe, it, expect } from 'vitest';
import { formatChatError, cercaDelFondo, parseAcciones } from './chatUi';
import { ApiError } from './ideamApi';

describe('lib/chatUi formatChatError', () => {
  it('429 con retryAfter sugiere esperar N segundos', () => {
    const msg = formatChatError(new ApiError('límite', 429, 30));
    expect(msg).toMatch(/30/);
    expect(msg.toLowerCase()).toMatch(/intenta|espera|l[ií]mite|momento/);
  });

  it('429 sin retryAfter da un mensaje de límite sin NaN/null', () => {
    const msg = formatChatError(new ApiError('límite', 429, null));
    expect(msg).not.toMatch(/NaN|null|undefined/);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('AbortError -> mensaje de timeout', () => {
    const err = new DOMException('abort', 'AbortError');
    expect(formatChatError(err).toLowerCase()).toMatch(/tard|tiempo|demasiado/);
  });

  it('ApiError genérico usa su propio mensaje', () => {
    expect(formatChatError(new ApiError('servicio caído', 502))).toMatch(/servicio caído/);
  });

  it('causa desconocida -> mensaje genérico no vacío', () => {
    expect(formatChatError(null).length).toBeGreaterThan(0);
    expect(formatChatError('algo raro').length).toBeGreaterThan(0);
  });
});

describe('lib/chatUi cercaDelFondo', () => {
  it('en el fondo -> true', () => {
    expect(cercaDelFondo({ scrollTop: 900, scrollHeight: 1000, clientHeight: 100 })).toBe(true);
  });

  it('muy arriba -> false', () => {
    expect(cercaDelFondo({ scrollTop: 0, scrollHeight: 1000, clientHeight: 100 })).toBe(false);
  });

  it('justo en el umbral -> true', () => {
    // distancia = 1000 - (780 + 100) = 120 == umbral por defecto
    expect(cercaDelFondo({ scrollTop: 780, scrollHeight: 1000, clientHeight: 100 })).toBe(true);
  });
});

describe('lib/chatUi parseAcciones', () => {
  it('no-array -> []', () => {
    expect(parseAcciones(undefined)).toEqual([]);
    expect(parseAcciones(null)).toEqual([]);
    expect(parseAcciones('hydro')).toEqual([]);
    expect(parseAcciones({})).toEqual([]);
  });

  it('acción válida se conserva con sus params', () => {
    const acc = parseAcciones([
      { label: 'Ver la curva IDF de TIBAITATÁ →', view: 'hydro', params: { est: '21205791' } },
    ]);
    expect(acc).toEqual([
      { label: 'Ver la curva IDF de TIBAITATÁ →', view: 'hydro', params: { est: '21205791' } },
    ]);
  });

  it('descarta vistas fuera de la whitelist', () => {
    const acc = parseAcciones([
      { label: 'Ir a Ajustes', view: 'settings', params: {} },
      { label: 'Ver Analítica →', view: 'analytics', params: { dep: 'ATLÁNTICO' } },
    ]);
    expect(acc).toHaveLength(1);
    expect(acc[0].view).toBe('analytics');
  });

  it('descarta items sin label string o sin objeto', () => {
    const acc = parseAcciones([
      { view: 'hydro', params: {} },
      { label: '', view: 'hydro', params: {} },
      'no soy objeto',
      null,
      { label: 'OK →', view: 'extractor', params: {} },
    ]);
    expect(acc).toHaveLength(1);
    expect(acc[0].label).toBe('OK →');
  });

  it('sanea params: solo strings no vacíos, recortados a 60', () => {
    const largo = 'x'.repeat(80);
    const acc = parseAcciones([
      {
        label: 'Descargar →',
        view: 'extractor',
        params: { dep: 'BOLÍVAR', vacio: '', num: 2024, nulo: null, largo },
      },
    ]);
    expect(acc[0].params).toEqual({ dep: 'BOLÍVAR', largo: 'x'.repeat(60) });
  });

  it('tope de 3 acciones', () => {
    const muchas = Array.from({ length: 6 }, (_, i) => ({
      label: `Acción ${i} →`,
      view: 'hydro',
      params: {},
    }));
    expect(parseAcciones(muchas)).toHaveLength(3);
  });

  it('params ausente o no-objeto -> {}', () => {
    const acc = parseAcciones([
      { label: 'A →', view: 'hydro' },
      { label: 'B →', view: 'analytics', params: 'oops' },
    ]);
    expect(acc[0].params).toEqual({});
    expect(acc[1].params).toEqual({});
  });
});
