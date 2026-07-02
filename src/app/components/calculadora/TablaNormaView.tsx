import { motion } from 'motion/react';
import { MousePointerClick } from 'lucide-react';
import type { TablaNorma } from '../../lib/hydro/tablasNorma';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { CitaFuente } from './CitaFuente';

/**
 * Renderiza una tabla de norma con su cita exacta al pie. Scroll horizontal propio.
 *
 * Opcionalmente INTERACTIVA: si se pasan `colsValor` + `onCelda`, esas columnas se
 * vuelven celdas clicables (el usuario elige el valor directo de la tabla) y la
 * celda `activa` queda resaltada con anillo + glow. Sin esas props, es solo lectura.
 */
export function TablaNormaView({
  tabla,
  colsValor,
  onCelda,
  activa,
}: {
  tabla: TablaNorma;
  colsValor?: number[];
  onCelda?: (fila: number, col: number, valor: string | number) => void;
  activa?: { fila: number; col: number } | null;
}) {
  const reducido = usePrefersReducedMotion();
  const interactivo = !!onCelda && !!colsValor?.length;
  const esValor = (j: number) => interactivo && colsValor!.includes(j);

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-semibold text-card-foreground">{tabla.titulo}</figcaption>
      {interactivo && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-accent">
          <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Toca o haz clic en un valor resaltado de la tabla para usarlo en el cálculo.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {tabla.columnas.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, i) => {
              const filaActiva = activa?.fila === i;
              return (
                <tr key={i} className={`border-t border-border/60 ${filaActiva ? 'bg-accent/5' : ''}`}>
                  {fila.map((celda, j) => {
                    const base = j === 0 ? 'text-card-foreground' : 'text-right font-mono text-muted-foreground';
                    if (!esValor(j)) {
                      return (
                        <td key={j} className={`px-3 py-1.5 ${base}`}>
                          {celda}
                        </td>
                      );
                    }
                    const activo = activa?.fila === i && activa?.col === j;
                    return (
                      <td key={j} className="px-1 py-1 text-right">
                        <motion.button
                          type="button"
                          onClick={() => onCelda!(i, j, celda)}
                          aria-pressed={activo}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          animate={
                            activo && !reducido
                              ? { boxShadow: ['0 0 0 rgba(201,162,39,0)', '0 0 12px rgba(201,162,39,0.75)', '0 0 5px rgba(201,162,39,0.4)'] }
                              : { boxShadow: '0 0 0 rgba(201,162,39,0)' }
                          }
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={`w-full cursor-pointer rounded-md border px-2 py-1 font-mono transition-colors ${
                            activo
                              ? 'border-accent bg-accent/20 font-bold text-accent ring-1 ring-accent'
                              : 'border-accent/30 border-dashed bg-accent/5 text-card-foreground hover:border-accent/60 hover:bg-accent/10 hover:text-accent'
                          }`}
                        >
                          {celda}
                        </motion.button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tabla.nota && <p className="text-[11px] leading-snug text-muted-foreground">{tabla.nota}</p>}
      <CitaFuente fuente={tabla.fuente} />
    </figure>
  );
}
