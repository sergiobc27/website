import { describe, it, expect } from 'vitest';
import { parseSearch, buildSearch } from './urlState';

describe('lib/urlState', () => {
  it('parseSearch lee pares clave-valor (con o sin ?)', () => {
    expect(parseSearch('?var=precip&tr=10')).toEqual({ var: 'precip', tr: '10' });
    expect(parseSearch('est=A,B')).toEqual({ est: 'A,B' });
    expect(parseSearch('')).toEqual({});
  });

  it('buildSearch omite vacíos y undefined, con orden estable', () => {
    expect(buildSearch({ var: 'precip', est: '', tr: undefined })).toBe('var=precip');
    expect(buildSearch({ b: '2', a: '1' })).toBe('a=1&b=2');
    expect(buildSearch({})).toBe('');
  });

  it('round-trip parse(build(x)) preserva los valores no vacíos', () => {
    const x = { var: 'precip', est: 'APULO,SOCHA', tr: '100' };
    expect(parseSearch('?' + buildSearch(x))).toEqual(x);
  });

  it('codifica/decodifica valores con caracteres especiales', () => {
    const s = buildSearch({ mun: 'BOGOTÁ, D.C.' });
    expect(parseSearch('?' + s)).toEqual({ mun: 'BOGOTÁ, D.C.' });
  });
});
