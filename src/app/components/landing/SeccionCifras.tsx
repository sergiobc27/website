import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { Reveal, RevealItem } from './Reveal';

const CIFRAS = [
  { valor: 764, sufijo: 'M', etiqueta: 'observaciones cargadas', color: 'text-primary' },
  { valor: 13, sufijo: '', etiqueta: 'variables hidrometeorológicas', color: 'text-secondary' },
  { valor: 15, sufijo: '', etiqueta: 'curvas IDF publicables', color: 'text-success' },
  { valor: 0, sufijo: '', etiqueta: 'costo de operación ($)', color: 'text-primary' },
];

function Contador({ valor, sufijo, reducido }: { valor: number; sufijo: string; reducido: boolean }) {
  const [n, setN] = useState(reducido ? valor : 0);
  const ref = useRef<HTMLDivElement | null>(null);
  const hecho = useRef(false);

  useEffect(() => {
    if (reducido) {
      setN(valor);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let rafId = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hecho.current) {
          hecho.current = true;
          const dur = 1100;
          const inicio = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - inicio) / dur);
            setN(Math.round(valor * (1 - Math.pow(1 - p, 3))));
            if (p < 1) rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [valor, reducido]);

  return (
    <div ref={ref}>
      {n.toLocaleString('es-CO')}
      {sufijo}
    </div>
  );
}

export function SeccionCifras() {
  const reducido = usePrefersReducedMotion();
  return (
    <section className="bg-gradient-to-b from-[#fbf7ee] to-[#fbe9c9] px-6 py-16 dark:from-[#15110a] dark:to-[#1b1407] md:px-10">
      <Reveal className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
        {CIFRAS.map(({ valor, sufijo, etiqueta, color }) => (
          <RevealItem key={etiqueta} className="text-center">
            <div className={`text-5xl font-black leading-none tracking-tight md:text-7xl ${color}`}>
              <Contador valor={valor} sufijo={sufijo} reducido={reducido} />
            </div>
            <div className="mt-2 text-xs font-medium text-muted-foreground md:text-sm">{etiqueta}</div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}
