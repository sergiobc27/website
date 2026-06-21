import { aRomano } from '../../lib/historia';
import type { CapituloContenido } from './contenido';

/**
 * Tabla de contenidos navegable del libro. Cada entrada salta a su capítulo
 * (scrollIntoView, gestionado por el orquestador para respetar reduced-motion).
 */
export function IndiceHistoria({
  capitulos,
  onIr,
}: {
  capitulos: CapituloContenido[];
  onIr: (id: string) => void;
}) {
  return (
    <section className="hl-indice" aria-label="Índice">
      <h2 className="hl-indice-h">Índice</h2>
      <ol className="hl-indice-ol">
        {capitulos.map((c) => (
          <li key={c.id} className="hl-indice-li">
            <button type="button" className="hl-indice-btn" onClick={() => onIr(c.id)}>
              <span className="hl-indice-rn">{aRomano(c.n)}</span>
              <span className="hl-indice-tt">{c.titulo}</span>
              <span className="hl-indice-dots" aria-hidden="true" />
              <span className="hl-indice-pg">{c.n}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
