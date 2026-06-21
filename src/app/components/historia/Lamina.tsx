import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Marco editorial de una "lámina" del libro (la gráfica enmarcada con doble
 * filete dorado y pie). Monta su contenido de forma PEREZOSA la primera vez que
 * entra al viewport: así cada gráfica anima su entrada una sola vez (motion con
 * sentido) y no se montan las 8 gráficas recharts de golpe (rendimiento).
 */
export function Lamina({ caption, children }: { caption: string; children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Si no hay IntersectionObserver (entorno raro), mostrar de una.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure ref={ref} className="hl-lamina">
      <div className="hl-lamina-cuerpo">
        {visible ? (
          <div className="animate-fade-in-up h-full w-full">{children}</div>
        ) : (
          <div className="h-full w-full" aria-hidden="true" />
        )}
      </div>
      <figcaption className="hl-lamina-pie">{caption}</figcaption>
    </figure>
  );
}
