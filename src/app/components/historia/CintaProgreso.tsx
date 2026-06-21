import { useEffect, useRef, useState } from 'react';
import { BookOpenText } from 'lucide-react';
import { aRomano, progresoLectura, TOTAL_ESCENAS } from '../../lib/historia';

/** Sube por el árbol hasta el primer ancestro con scroll (en esta app, el <main>). */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === 'auto' || oy === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}

/**
 * Cinta de lectura CONTINUA ligada al scroll real (no al índice de escena) +
 * marcador "Capítulo N · de VIII". Calcula el avance con requestAnimationFrame
 * sobre el contenedor scrollable real (el <main>), robusto en todo navegador.
 */
export function CintaProgreso({
  rootRef,
  activo,
  titulo,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  activo: number;
  titulo: string;
}) {
  const [progreso, setProgreso] = useState(0);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = getScrollParent(root);
    const target: HTMLElement | Window = scroller ?? window;

    let raf = 0;
    const medir = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const topRef = scroller ? scroller.getBoundingClientRect().top : 0;
      const ventana = scroller ? scroller.clientHeight : window.innerHeight;
      const p = progresoLectura(r.top - topRef, r.height, ventana);
      // Aplica directo al DOM (sin esperar al render) para que sea fluido.
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      setProgreso(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };

    medir();
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [rootRef]);

  return (
    <div className="hl-cinta-wrap">
      <div
        className="hl-cinta"
        role="progressbar"
        aria-valuenow={Math.round(progreso * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de lectura del libro"
      >
        <div ref={fillRef} className="hl-cinta-fill" style={{ transform: `scaleX(${progreso})` }} />
      </div>
      <div className="hl-marcador" aria-hidden="true">
        <BookOpenText className="hl-marcador-icono" />
        <span>
          Capítulo <b>{aRomano(activo)}</b> · de {aRomano(TOTAL_ESCENAS)}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        Capítulo {activo} de {TOTAL_ESCENAS}: {titulo}
      </span>
    </div>
  );
}
