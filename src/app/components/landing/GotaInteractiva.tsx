import { useCallback, useRef, useState } from 'react';
import { GotaAnimada } from './GotaAnimada';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';

interface Onda {
  id: number;
  x: number;
  y: number;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

// Gota del hero con interacción: se inclina suavemente hacia el cursor (parallax
// 3D vía CSS vars, sin re-render) y suelta un anillo de onda donde haces clic.
// Con prefers-reduced-motion no reacciona (queda como la gota estática). El
// tilt/ondas son puro CSS; el bloque global de reduced-motion también las frena.
export function GotaInteractiva() {
  const reducido = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const [ondas, setOndas] = useState<Onda[]>([]);

  const seguir = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reducido) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
      const dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2));
      el.style.setProperty('--gx', `${dx * 16}px`);
      el.style.setProperty('--gy', `${dy * 16}px`);
      el.style.setProperty('--grx', `${dy * -7}deg`);
      el.style.setProperty('--gry', `${dx * 7}deg`);
    },
    [reducido],
  );

  const soltar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--gx', '0px');
    el.style.setProperty('--gy', '0px');
    el.style.setProperty('--grx', '0deg');
    el.style.setProperty('--gry', '0deg');
  }, []);

  const salpicar = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reducido) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const id = (idRef.current += 1);
      // Máximo 6 ondas simultáneas: un clic frenético no infla el DOM.
      setOndas((prev) => [...prev, { id, x: e.clientX - r.left, y: e.clientY - r.top }].slice(-6));
    },
    [reducido],
  );

  return (
    <div
      ref={ref}
      onPointerMove={seguir}
      onPointerLeave={soltar}
      onPointerDown={salpicar}
      className="gota-interactiva relative z-10 flex h-72 w-72 items-center justify-center md:h-[24rem] md:w-[24rem]"
    >
      {ondas.map((o) => (
        <span
          key={o.id}
          aria-hidden
          className="gota-clic-onda"
          style={{ left: o.x, top: o.y }}
          onAnimationEnd={() => setOndas((prev) => prev.filter((x) => x.id !== o.id))}
        />
      ))}
      <div className="gota-parallax h-full w-full [filter:drop-shadow(0_18px_34px_rgba(43,143,214,0.4))] lg:scale-105">
        <GotaAnimada />
      </div>
    </div>
  );
}
