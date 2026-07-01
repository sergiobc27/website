import { motion } from 'motion/react';
import { Info, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CitaFuente } from './calculadora/CitaFuente';
import { METODOLOGIA } from '../lib/metodologia/contenido';

/**
 * Botón "(i)" que se coloca en el encabezado de una gráfica. Abre un popover
 * animado con "qué es / cómo se lee / para qué sirve", la fórmula y la fuente, y
 * un enlace a la sección correspondiente de la página de Metodología.
 */
export function InfoGrafica({ id }: { id: string }) {
  const entrada = METODOLOGIA[id];
  if (!entrada) return null;

  const irAMetodologia = () => {
    window.history.pushState(null, '', `/metodologia#${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          aria-label={`Qué es: ${entrada.titulo}`}
          title="¿Qué es esta gráfica?"
          whileHover={{ scale: 1.18 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Info className="h-4 w-4" />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-[20rem] max-w-[92vw] p-0">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-3 p-4"
        >
          <div>
            <h4 className="text-sm font-bold text-card-foreground">{entrada.titulo}</h4>
            <p className="mt-1 text-xs font-medium text-accent">{entrada.resumen}</p>
          </div>

          <Bloque etiqueta="Qué es">{entrada.queEs}</Bloque>
          <Bloque etiqueta="Cómo se lee">{entrada.comoSeLee}</Bloque>
          <Bloque etiqueta="Para qué sirve">{entrada.paraQueSirve}</Bloque>

          {entrada.formula && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-card-foreground">
              {entrada.formula}
            </div>
          )}

          {entrada.fuentes.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              {entrada.fuentes.map((f, i) => (
                <CitaFuente key={i} fuente={f} />
              ))}
            </div>
          )}

          <motion.button
            type="button"
            onClick={irAMetodologia}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="group mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent ring-1 ring-inset ring-accent/30 transition-colors hover:bg-accent/20"
          >
            Saber más: explicación técnica y PDF
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

function Bloque({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="text-xs leading-snug text-card-foreground">{children}</p>
    </div>
  );
}
