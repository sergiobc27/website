import { describe, it, expect } from 'vitest';
import { viewToPath, pathToView } from './navigation';

describe('lib/navigation', () => {
  it('dashboard vive en la raiz', () => {
    expect(viewToPath('dashboard')).toBe('/');
    expect(pathToView('/')).toBe('dashboard');
    expect(pathToView('')).toBe('dashboard');
  });

  it('las demas vistas son /<vista>', () => {
    expect(viewToPath('map')).toBe('/map');
    expect(pathToView('/map')).toBe('map');
    expect(pathToView('/hydro/')).toBe('hydro');
  });

  it('ruta desconocida -> dashboard', () => {
    expect(pathToView('/no-existe')).toBe('dashboard');
    expect(pathToView('/favicon.ico')).toBe('dashboard');
  });
});
