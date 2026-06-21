import { aRomano } from '../../lib/historia';
import type { CapituloContenido } from './contenido';

/**
 * Índice lateral del libro: puntos clicables (uno por capítulo) que resaltan el
 * activo y permiten saltar. Solo en escritorio (oculto en móvil, donde basta la
 * cinta de progreso + "N de VIII").
 */
export function StepperCapitulos({
  capitulos,
  activo,
  onIr,
}: {
  capitulos: CapituloContenido[];
  activo: number;
  onIr: (id: string) => void;
}) {
  return (
    <nav className="hl-stepper" aria-label="Capítulos del libro">
      {capitulos.map((c) => {
        const on = c.n === activo;
        return (
          <button
            key={c.id}
            type="button"
            className="hl-stepper-punto"
            data-on={on ? '1' : '0'}
            aria-current={on ? 'true' : undefined}
            aria-label={`Capítulo ${c.n}: ${c.titulo}`}
            onClick={() => onIr(c.id)}
          >
            <span className="hl-stepper-tip">
              {aRomano(c.n)} · {c.titulo}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
