import type { ReactNode } from 'react';
import { SkeletonLoader } from '../SkeletonLoader';

interface CeldaProps {
  /** Descripción completa para lector de pantalla ("Ver estado del espejo: …"). */
  ariaLabel: string;
  onClick: () => void;
  titulo?: string;
  cargando?: boolean;
  error?: boolean;
  /** Posición en el grid para el stagger de entrada (delay = indice × 40 ms). */
  indice?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Contenedor base de toda celda del bento: un botón accesible con lift al
 * hover, feedback de presión y estados de carga/error propios — una celda
 * caída nunca tumba el resto del grid.
 */
export function Celda({ ariaLabel, onClick, titulo, cargando, error, indice = 0, className = '', children }: CeldaProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{ animationDelay: `${indice * 40}ms` }}
      className={`bento-enter group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-glow transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] ${className}`}
    >
      {titulo && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      )}
      {cargando ? (
        <div className="flex-1">
          <SkeletonLoader rows={2} />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-2xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">sin conexión al espejo</p>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
