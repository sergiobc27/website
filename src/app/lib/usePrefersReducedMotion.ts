import { useEffect, useState } from 'react';

/**
 * `true` si el usuario pidió reducir el movimiento (WCAG 2.3.3).
 * Las animaciones CSS ya se neutralizan globalmente en theme.css; este hook es
 * para el motion que vive en JS (recharts `isAnimationActive`, scrollIntoView
 * 'smooth'), que aquella regla CSS no alcanza.
 */
export function usePrefersReducedMotion(): boolean {
  // Lectura sincrona en el primer render: los componentes que se animan al
  // montarse (VisorPdf, popover de InfoGrafica) necesitan el valor correcto
  // antes de que framer-motion capture el `initial`; un useEffect llega tarde.
  const [reducido, setReducido] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducido(mq.matches);
    const onChange = () => setReducido(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reducido;
}
