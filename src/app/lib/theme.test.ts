import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getThemeChoice, applyTheme, resolveIsDark } from './theme';

// El entorno de vitest aquí es 'node' (sin DOM). Stubeamos los globales que usa
// el módulo: localStorage, document.documentElement.classList y window.matchMedia.

function makeClassList() {
  const set = new Set<string>();
  return {
    add: (c: string) => set.add(c),
    remove: (c: string) => set.delete(c),
    contains: (c: string) => set.has(c),
    toggle: (c: string, force?: boolean) => {
      const on = force ?? !set.has(c);
      if (on) set.add(c);
      else set.delete(c);
      return on;
    },
  };
}

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function setMatchMedia(matches: boolean) {
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({
      matches,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

let classList: ReturnType<typeof makeClassList>;

beforeEach(() => {
  classList = makeClassList();
  vi.stubGlobal('localStorage', makeStorage());
  vi.stubGlobal('document', { documentElement: { classList } });
  setMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lib/theme', () => {
  it('por defecto es system cuando no hay nada guardado', () => {
    expect(getThemeChoice()).toBe('system');
  });

  it('applyTheme("dark") agrega .dark y persiste', () => {
    setMatchMedia(false);
    applyTheme('dark');
    expect(classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('ideam-theme')).toBe('dark');
    expect(getThemeChoice()).toBe('dark');
  });

  it('applyTheme("light") quita .dark y persiste', () => {
    setMatchMedia(true);
    applyTheme('light');
    expect(classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('ideam-theme')).toBe('light');
  });

  it('system resuelve según prefers-color-scheme', () => {
    setMatchMedia(true);
    applyTheme('system');
    expect(resolveIsDark('system')).toBe(true);
    expect(classList.contains('dark')).toBe(true);

    setMatchMedia(false);
    applyTheme('system');
    expect(resolveIsDark('system')).toBe(false);
    expect(classList.contains('dark')).toBe(false);
  });
});
