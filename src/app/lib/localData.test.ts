import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearLocalData } from './localData';

// Entorno 'node': stub de localStorage con un Map.
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearLocalData', () => {
  it('borra los datos pero preserva la preferencia de tema', () => {
    localStorage.setItem('ideam-history', '[1]');
    localStorage.setItem('ideam-extractor-config', '{}');
    localStorage.setItem('ideam-extractor-active-job', 'abc');
    localStorage.setItem('ideam-comparador', '["x"]');
    localStorage.setItem('ideam-theme', 'dark');

    clearLocalData();

    expect(localStorage.getItem('ideam-history')).toBeNull();
    expect(localStorage.getItem('ideam-extractor-config')).toBeNull();
    expect(localStorage.getItem('ideam-extractor-active-job')).toBeNull();
    expect(localStorage.getItem('ideam-comparador')).toBeNull();
    expect(localStorage.getItem('ideam-theme')).toBe('dark');
  });
});
