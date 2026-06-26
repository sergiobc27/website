import type { TablaNorma } from '../../lib/hydro/tablasNorma';
import { CitaFuente } from './CitaFuente';

/** Renderiza una tabla de norma con su cita exacta al pie. Scroll horizontal
 * propio para no romper el layout en móvil. */
export function TablaNormaView({ tabla }: { tabla: TablaNorma }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-semibold text-card-foreground">{tabla.titulo}</figcaption>
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
            {tabla.filas.map((fila, i) => (
              <tr key={i} className="border-t border-border/60">
                {fila.map((celda, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-card-foreground' : 'text-right font-mono text-muted-foreground'}`}>
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tabla.nota && <p className="text-[11px] leading-snug text-muted-foreground">{tabla.nota}</p>}
      <CitaFuente fuente={tabla.fuente} />
    </figure>
  );
}
