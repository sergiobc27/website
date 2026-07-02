import { describe, it, expect } from 'vitest';
import { METODOLOGIA, SECCIONES_METODOLOGIA } from './contenido';
import { referenciaDe } from '../hydro/fuentes';

describe('metodologia/contenido — integridad del registro', () => {
  it('cada fuente referencia una entrada existente en la bibliografía', () => {
    for (const entrada of Object.values(METODOLOGIA)) {
      for (const f of entrada.fuentes) {
        expect(referenciaDe(f.ref), `${entrada.id} → ${f.ref}`).toBeTruthy();
      }
    }
  });

  it('cada id de las secciones existe en METODOLOGIA', () => {
    for (const sec of SECCIONES_METODOLOGIA) {
      for (const id of sec.ids) {
        expect(METODOLOGIA[id], id).toBeTruthy();
      }
    }
  });

  it('cada clave de METODOLOGIA aparece en alguna sección (dirección inversa: nada queda huérfano)', () => {
    const idsEnSecciones = new Set(SECCIONES_METODOLOGIA.flatMap((sec) => sec.ids));
    for (const id of Object.keys(METODOLOGIA)) {
      expect(idsEnSecciones.has(id), `${id} no aparece en ninguna sección de la página de Metodología`).toBe(true);
    }
  });

  it('cada entrada tiene las cuatro capas de explicación', () => {
    for (const e of Object.values(METODOLOGIA)) {
      expect(e.resumen.length, e.id).toBeGreaterThan(0);
      expect(e.queEs.length, e.id).toBeGreaterThan(0);
      expect(e.comoSeLee.length, e.id).toBeGreaterThan(0);
      expect(e.paraQueSirve.length, e.id).toBeGreaterThan(0);
    }
  });

  it('una fuente no verificada lleva nota honesta', () => {
    for (const e of Object.values(METODOLOGIA)) {
      for (const f of e.fuentes) {
        if (!f.verificado) expect(f.nota, `${e.id} → ${f.ref}`).toBeTruthy();
      }
    }
  });
});
