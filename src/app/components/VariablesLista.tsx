import { Formula } from './Formula';
import type { Variable } from '../lib/metodologia/contenido';

/**
 * Lista "Dónde: cada símbolo = qué representa" que acompaña SIEMPRE a una fórmula,
 * para que cualquier persona sepa a qué hace referencia cada letra. Los símbolos se
 * renderizan con la fuente matemática de `Formula` para verse igual que en la fórmula.
 */
export function VariablesLista({ variables, className = '' }: { variables: Variable[]; className?: string }) {
  if (!variables.length) return null;
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dónde</p>
      <dl className="mt-1 space-y-1">
        {variables.map((v, i) => (
          <div key={i} className="flex items-baseline gap-2 text-xs leading-snug">
            <dt className="min-w-[2.2rem] shrink-0 font-semibold text-accent">
              <Formula>{v.simbolo}</Formula>
            </dt>
            <dd className="text-card-foreground">
              <span className="text-muted-foreground">= </span>
              {v.definicion}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
