import { Tooltip } from '../Tooltip';
import { referenciaDe, type Fuente } from '../../lib/hydro/fuentes';

/** Muestra "INVÍAS (2009), Tabla 2.9" con tooltip de la cita APA completa.
 * Si la fuente no está verificada, lo dice de forma honesta (no inventa). */
export function CitaFuente({ fuente }: { fuente: Fuente }) {
  const ref = referenciaDe(fuente.ref);
  const autorAnio = ref ? `${ref.apa.split('(')[0].trim()} (${ref.anio})` : fuente.ref;
  const etiqueta = `${autorAnio}, ${fuente.localizador}`;
  return (
    <Tooltip content={ref?.apa ?? 'Referencia no encontrada'}>
      <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2">
        Fuente: {etiqueta}
        {!fuente.verificado && (
          <span className="text-amber-400" title={fuente.nota ?? 'Localizador por confirmar'}>
            (localizador por confirmar)
          </span>
        )}
      </span>
    </Tooltip>
  );
}
