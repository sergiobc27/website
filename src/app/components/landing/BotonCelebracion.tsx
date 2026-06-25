import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { construirRafagas } from '../../lib/celebracion';

export function BotonCelebracion() {
  const reducido = usePrefersReducedMotion();
  const [activo, setActivo] = useState(false);

  const celebrar = async () => {
    setActivo(true);
    try {
      const confetti = (await import('canvas-confetti')).default;
      const rafagas = construirRafagas(reducido);
      rafagas.forEach((r, i) => {
        window.setTimeout(() => confetti(r), reducido ? 0 : i * 220);
      });
    } catch {
      /* canvas-confetti no disponible: el botón sigue siendo inocuo */
    } finally {
      window.setTimeout(() => setActivo(false), 1200);
    }
  };

  return (
    <button
      type="button"
      onClick={celebrar}
      aria-label="Celebra los datos abiertos con una animación"
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FCD116] to-[#C9A227] px-5 py-3 font-bold text-[#5a3d00] transition-transform hover:scale-105 active:scale-95"
    >
      <Sparkles className={`h-5 w-5 ${activo ? 'animate-spin' : ''}`} />
      ¡Celebra los datos abiertos!
    </button>
  );
}
