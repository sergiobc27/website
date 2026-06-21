import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { OPEN_ASISTENTE_EVENT } from './AsistenteFlotante';
import { HISTORIA_IDF } from '../data/historiaIdf';
import { escenaMasVisible, TOTAL_ESCENAS } from '../lib/historia';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';
import { construirCapitulos } from './historia/contenido';
import { Portada } from './historia/Portada';
import { IndiceHistoria } from './historia/IndiceHistoria';
import { Capitulo } from './historia/Capitulo';
import { CintaProgreso } from './historia/CintaProgreso';
import { StepperCapitulos } from './historia/StepperCapitulos';

const D = HISTORIA_IDF;

interface HistoriaIdfProps {
  onNavigate: (view: string) => void;
}

/**
 * "La historia del dato" como libro editorial: cubierta (Cap. I), índice
 * navegable, capítulos II–VIII (texto serif con capitular + lámina enmarcada con
 * foco progresivo), cinta de progreso continua y stepper lateral. Toda animación
 * respeta prefers-reduced-motion (CSS por theme.css; recharts y scrollIntoView
 * vía el hook). El contenido textual es la alternativa accesible a las gráficas.
 */
export function HistoriaIdf({ onNavigate }: HistoriaIdfProps) {
  const capitulos = useMemo(() => construirCapitulos(D), []);
  const [activo, setActivo] = useState(1);
  const activoRef = useRef(1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seccionesRef = useRef<Array<HTMLElement | null>>([]);
  const reducido = usePrefersReducedMotion();

  useEffect(() => {
    const ratios = new Array(TOTAL_ESCENAS).fill(0);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.escena) - 1;
          if (idx >= 0) ratios[idx] = e.intersectionRatio;
        }
        const siguiente = escenaMasVisible(ratios, activoRef.current);
        if (siguiente !== activoRef.current) {
          activoRef.current = siguiente;
          setActivo(siguiente);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    seccionesRef.current.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const irA = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
  };

  const tituloActivo = capitulos[activo - 1]?.titulo ?? '';

  return (
    <div
      ref={rootRef}
      className="historia-libro font-serif relative -mx-4 -mt-20 -mb-24 px-4 pt-20 pb-24 md:-mx-6 md:px-6 lg:-mb-6 lg:pb-6"
    >
      <CintaProgreso rootRef={rootRef} activo={activo} titulo={tituloActivo} />
      <StepperCapitulos capitulos={capitulos} activo={activo} onIr={irA} />

      <Portada
        cap={capitulos[0]}
        data={D}
        seccionRef={(el) => {
          seccionesRef.current[0] = el;
        }}
      />

      <IndiceHistoria capitulos={capitulos} onIr={irA} />

      {capitulos.slice(1).map((cap) => (
        <Capitulo
          key={cap.id}
          cap={cap}
          data={D}
          seccionRef={(el) => {
            seccionesRef.current[cap.n - 1] = el;
          }}
        >
          {cap.n === TOTAL_ESCENAS && (
            <div className="hl-cta-fila">
              <button type="button" onClick={() => onNavigate('hydro')} className="hl-cta hl-cta-primario">
                Calcula la IDF de tu estación <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT))}
                className="hl-cta hl-cta-fantasma"
              >
                <MessageCircle className="h-4 w-4" /> Pregúntale al asistente
              </button>
            </div>
          )}
        </Capitulo>
      ))}

      <footer className="hl-colofon">
        Datos reales de la estación {D.estacion.nombre} ({D.estacion.codigo}), {D.estacion.municipio},{' '}
        {D.estacion.departamento}, generados el {D.generadoEl}. {D.fuente}. Plataforma orientativa: no sustituye el
        diseño normado ni el criterio profesional.
      </footer>
    </div>
  );
}
