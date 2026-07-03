import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';

interface Onda {
  id: number;
  x: number;
  y: number;
}

// Onda tipo "gota en el agua" donde el usuario hace clic, en cualquier parte de
// la portada. Escucha pointerdown en window y pinta un anillo que se expande en
// una capa fija (pointer-events:none, no bloquea clics). Con prefers-reduced-motion
// no se monta el listener ni se pinta nada.
export function OndasClic() {
  const reducido = usePrefersReducedMotion();
  const [ondas, setOndas] = useState<Onda[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (reducido) return;
    const alClic = (e: PointerEvent) => {
      const id = (idRef.current += 1);
      // Tope de 10 ondas: un clic frenético no infla el DOM.
      setOndas((prev) => [...prev, { id, x: e.clientX, y: e.clientY }].slice(-10));
    };
    window.addEventListener('pointerdown', alClic);
    return () => window.removeEventListener('pointerdown', alClic);
  }, [reducido]);

  const quitar = useCallback((id: number) => {
    setOndas((prev) => prev.filter((o) => o.id !== id));
  }, []);

  if (reducido) return null;

  return (
    <div aria-hidden className="ondas-clic-capa">
      {ondas.map((o) => (
        <span
          key={o.id}
          className="onda-clic"
          style={{ left: o.x, top: o.y }}
          onAnimationEnd={() => quitar(o.id)}
        />
      ))}
    </div>
  );
}
