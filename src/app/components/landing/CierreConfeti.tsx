import { ArrowRight, BookOpen } from 'lucide-react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { construirRafagas } from '../../lib/celebracion';
import { CurvaIdfAnimada } from './CurvaIdfAnimada';
import { Reveal, RevealItem } from './Reveal';

interface CierreConfetiProps {
  onNavigate: (view: string) => void;
}

export function CierreConfeti({ onNavigate }: CierreConfetiProps) {
  const reducido = usePrefersReducedMotion();

  // Un solo botón: "Entrar a la plataforma" dispara los fuegos + confeti (colores
  // CUC) y luego entra al panel. canvas-confetti se importa de forma diferida al
  // primer uso y su canvas vive fuera de React, así que el festejo sigue mientras
  // se hace la transición. Con prefers-reduced-motion el efecto es mínimo.
  const entrarConFestejo = async () => {
    try {
      const confetti = (await import('canvas-confetti')).default;
      construirRafagas(reducido).forEach((r, i) => {
        window.setTimeout(() => confetti(r), reducido ? 0 : i * 200);
      });
    } catch {
      /* canvas-confetti no disponible: igual entramos */
    }
    window.setTimeout(() => onNavigate('dashboard'), reducido ? 150 : 850);
  };

  return (
    <section className="relative overflow-hidden bg-[#15110a] px-6 py-20 text-center md:px-10">
      <Reveal className="mx-auto max-w-3xl">
        <RevealItem>
          <div className="mx-auto mb-3 h-52 w-72 max-w-full md:h-64 md:w-[28rem]">
            <CurvaIdfAnimada className="h-full w-full" />
          </div>
          <p className="mb-8 text-xs font-bold uppercase tracking-[0.18em] text-[#d8c98c]">
            El resultado: curvas IDF reales
          </p>
        </RevealItem>
        <RevealItem>
          <h2 className="text-3xl font-extrabold text-[#f5edda] md:text-4xl">
            Los datos abiertos también se celebran
          </h2>
          <p className="mt-3 text-[#bdb39a]">
            Entra a explorar la plataforma y celébralo con nosotros.
          </p>
        </RevealItem>
        <RevealItem className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={entrarConFestejo}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
          >
            Entrar a la plataforma <ArrowRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('historia')}
            className="inline-flex items-center gap-1.5 text-sm text-[#d8c98c] underline-offset-4 hover:underline"
          >
            <BookOpen className="h-4 w-4" /> Lee la historia completa del dato
          </button>
        </RevealItem>
      </Reveal>
    </section>
  );
}
