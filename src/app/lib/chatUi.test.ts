import { describe, it, expect } from 'vitest';
import { formatChatError, cercaDelFondo } from './chatUi';
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
