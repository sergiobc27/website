import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Formula } from './Formula';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';
import type { Variable } from '../lib/metodologia/contenido';

/**
 * Lista "Dónde: cada símbolo = qué representa" que acompaña SIEMPRE a una fórmula,
 * para que cualquier persona sepa a qué hace referencia cada letra. Los símbolos se
 * renderizan con la fuente matemática de `Formula` para verse igual que en la fórmula.
 *
 * Si una variable trae `comoSeObtiene`, su fila es clicable (chevrón) y despliega
 * debajo "cómo se consigue" el valor: de dónde se toma, dónde se mide, de qué
 * depende o si la calcula la app. Funciona igual inline (Metodología, calculadora)
 * y dentro del popup (i), sin popovers anidados.
 */
export function VariablesLista({ variables, className = '' }: { variables: Variable[]; className?: string }) {
  if (!variables.length) return null;
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dónde</p>
      <div className="mt-1 space-y-1">
        {variables.map((v, i) => (
          <Fila key={i} v={v} />
        ))}
      </div>
    </div>
  );
}

function Fila({ v }: { v: Variable }) {
  const [abierto, setAbierto] = useState(false);
  const reducido = usePrefersReducedMotion();
  const panelId = useId();
  const tieneComo = !!v.comoSeObtiene;

  const cuerpo = (
    <>
      <span className="min-w-[2.2rem] shrink-0 font-semibold text-accent">
        <Formula>{v.simbolo}</Formula>
      </span>
      <span className="text-card-foreground">
        <span className="text-muted-foreground">= </span>
        {v.definicion}
        {tieneComo && (
          <ChevronDown
            className={`ml-1 inline-block h-3 w-3 shrink-0 text-accent/70 transition-transform ${abierto ? 'rotate-180' : ''}`}
            aria-hidden
          />
        )}
      </span>
    </>
  );

  if (!tieneComo) {
    return <div className="flex items-baseline gap-2 text-xs leading-snug">{cuerpo}</div>;
  }

  return (
    <div className="text-xs leading-snug">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={abierto ? panelId : undefined}
        className="flex w-full items-baseline gap-2 rounded text-left transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
      >
        {cuerpo}
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            key="como"
            id={panelId}
            initial={reducido ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducido ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducido ? 0 : 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="ml-[calc(2.2rem+0.5rem)] mt-1 rounded-md border-l-2 border-accent/40 bg-accent/5 px-2 py-1.5 text-muted-foreground">
              <span className="font-semibold text-accent/80">Cómo se consigue: </span>
              {v.comoSeObtiene}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
