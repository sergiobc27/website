import { describe, it, expect } from 'vitest';
import { viewToPath, pathToView } from './navigation';

describe('lib/navigation', () => {
  it('la landing vive en la raiz', () => {
    expect(viewToPath('landing')).toBe('/');
    expect(pathToView('/')).toBe('landing');
    expect(pathToView('')).toBe('landing');
  });

  it('el panel (dashboard) vive en /app', () => {
    expect(viewToPath('dashboard')).toBe('/app');
    expect(pathToView('/app')).toBe('dashboard');
    expect(pathToView('/app/')).toBe('dashboard');
  });

  it('las demas vistas son /<vista>', () => {
    expect(viewToPath('map')).toBe('/map');
    expect(pathToView('/map')).toBe('map');
    expect(pathToView('/hydro/')).toBe('hydro');
  });

  it('ruta desconocida -> landing', () => {
    expect(pathToView('/no-existe')).toBe('landing');
    expect(pathToView('/favicon.ico')).toBe('landing');
  });
});
