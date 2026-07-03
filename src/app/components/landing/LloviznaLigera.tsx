import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';

// Llovizna ligera de fondo: gotas finas cayendo, sutiles, sobre toda la portada.
// Canvas 2D liviano (sin librerías), pointer-events:none. Se pausa sola cuando la
// pestaña no está visible y no se monta con prefers-reduced-motion. Cantidad baja
// a propósito ("ligera") para no distraer ni pesar en equipos modestos.
export function LloviznaLigera() {
  const reducido = usePrefersReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducido) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let ancho = 0;
    let alto = 0;
    let raf = 0;

    const redim = () => {
      // Fallback a innerWidth: en el primer layout clientWidth puede ser 0.
      ancho = canvas.clientWidth || window.innerWidth || document.documentElement.clientWidth || 0;
      alto = canvas.clientHeight || window.innerHeight || document.documentElement.clientHeight || 0;
      canvas.width = Math.max(1, Math.round(ancho * dpr));
      canvas.height = Math.max(1, Math.round(alto * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const N = 64; // llovizna: visible pero sutil
    const gotas = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      largo: rnd(10, 22),
      vel: rnd(2.4, 5),
      op: rnd(0.1, 0.28),
    }));

    redim();
    window.addEventListener('resize', redim);
    // Remide cuando el canvas pasa de 0 a su tamaño real (layout tardío) o cambia.
    const ro = new ResizeObserver(redim);
    ro.observe(canvas);

    const dibujar = () => {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.strokeStyle = '#3a9fe0';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      for (const g of gotas) {
        const px = g.x * ancho;
        const py = g.y * alto;
        ctx.globalAlpha = g.op;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + g.largo);
        ctx.stroke();
        g.y += g.vel / alto;
        if (py > alto + g.largo) {
          g.y = -g.largo / alto;
          g.x = Math.random();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(dibujar);
    };

    const alCambiarVisibilidad = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(dibujar);
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    raf = requestAnimationFrame(dibujar);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', redim);
      ro.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [reducido]);

  if (reducido) return null;
  return <canvas ref={ref} aria-hidden className="llovizna-canvas" />;
}
