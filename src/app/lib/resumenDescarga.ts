// Construye el "resumen-primero" en prosa que se muestra antes del botón de descarga.
// Frase natural (no pares Etiqueta: valor) que previene descargas erróneas y fija
// expectativa. Mantener corto y legible.

export interface ResumenProsaOpts {
  variable: string;
  departamentos: string[];
  anioInicio?: number | null;
  anioFin?: number | null;
  estaciones?: number;
}

function territorio(departamentos: string[]): string {
  const deps = (departamentos ?? []).filter(Boolean);
  // Una descarga = un departamento. Sin selección aún, se anticipa en singular
  // (la descarga global ya no es posible).
  return deps[0] || 'un departamento';
}

export function construirResumenProsa(opts: ResumenProsaOpts): string {
  const variable = opts.variable?.trim() || 'datos';
  let frase = `Descargarás ${variable} de ${territorio(opts.departamentos)}`;
  if (opts.anioInicio && opts.anioFin) {
    frase += `, ${opts.anioInicio}–${opts.anioFin}`;
  }
  if (opts.estaciones && opts.estaciones > 0) {
    frase += ` · ~${opts.estaciones} ${opts.estaciones === 1 ? 'estación' : 'estaciones'}`;
  }
  return `${frase}.`;
}
