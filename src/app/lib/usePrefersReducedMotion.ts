import { useEffect, useState } from 'react';

/**
 * `true` si el usuario pidió reducir el movimiento (WCAG 2.3.3).
 * Las animaciones CSS ya se neutralizan globalmente en theme.css; este hook es
 * para el motion que vive en JS (recharts `isAnimationActive`, scrollIntoView
 * 'smooth'), que aquella regla CSS no alcanza.
 */
export function usePrefersReducedMotion(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducido(mq.matches);
    const onChange = () => setReducido(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reducido;
}
