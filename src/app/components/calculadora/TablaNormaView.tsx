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
        {/* Sin ancho minimo forzado en movil: las tablas angostas (2 columnas)
            caben en pantalla y el valor a elegir queda visible sin deslizar. En
            escritorio se restaura un piso comodo. Las tablas anchas de verdad
            (muchas columnas) siguen con scroll horizontal propio. */}
        <table className="w-full text-xs sm:min-w-[28rem]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {tabla.columnas.map((c) => (
                <th key={c} className="px-2 py-2 text-left font-semibold sm:px-3">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, i) => {
              const filaActiva = activa?.fila === i;
              return (
                <tr
                  key={i}
                  className={`border-t border-border/60 transition-colors duration-300 ${
                    // Fila seleccionada: degradado que se intensifica hacia la derecha
                    // (donde esta el valor elegido), para leer "toda la fila -> este valor".
                    filaActiva ? 'bg-gradient-to-r from-accent/10 via-accent/15 to-accent/30' : ''
                  }`}
                >
                  {fila.map((celda, j) => {
                    if (!esValor(j)) {
                      const alineacion = j === 0 ? '' : 'text-right font-mono';
                      // Una sola clase de color por celda (evita que text-card-foreground
                      // y text-accent compitan). En la fila activa, la 1a celda lleva
                      // barra de acento a la izquierda y su nombre en acento.
                      const color = filaActiva
                        ? j === 0
                          ? 'font-semibold text-accent'
                          : 'text-card-foreground'
                        : j === 0
                          ? 'text-card-foreground'
                          : 'text-muted-foreground';
                      const barra = filaActiva && j === 0 ? 'border-l-2 border-accent' : '';
                      return (
                        <td key={j} className={`px-2 py-1.5 sm:px-3 ${alineacion} ${color} ${barra}`}>
                          {celda}
                        </td>
                      );
                    }
                    const activo = activa?.fila === i && activa?.col === j;
                    return (
                      <td key={j} className="px-0.5 py-1 text-right sm:px-1">
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
                          className={`w-full cursor-pointer rounded-md border px-1.5 py-1 font-mono transition-colors sm:px-2 ${
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
