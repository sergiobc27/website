import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { GraficaViva } from './historia/GraficaViva';
import { OPEN_ASISTENTE_EVENT } from './AsistenteFlotante';
import { HISTORIA_IDF } from '../data/historiaIdf';
import { escenaMasVisible, TOTAL_ESCENAS } from '../lib/historia';
import { fmt } from '../lib/format';

const D = HISTORIA_IDF;

// El copy de las 8 escenas (didáctico: jurados + público general).
const ESCENAS: Array<{ titulo: string; parrafos: string[] }> = [
  {
    titulo: '¿Qué tan fuerte puede llover aquí?',
    parrafos: [
      'De esa pregunta depende el tamaño de cada alcantarillado, cuneta y puente de Colombia. Si la respuesta se queda corta, la calle se inunda; si se pasa, la obra cuesta de más.',
      `Esta es la historia de cómo una estación real del IDEAM — ${D.estacion.nombre}, en ${D.estacion.municipio} (${D.estacion.departamento}) — convierte gotas de lluvia en una herramienta de diseño.`,
    ],
  },
  {
    titulo: 'El pulso de la lluvia',
    parrafos: [
      `El IDEAM no mide la lluvia "por días": la registra cada 10 minutos. Esto que ves es una tormenta real del ${D.tormenta.fecha} — cada barra es lo que cayó en 10 minutos.`,
      `Ese día cayeron ${fmt(D.tormenta.totalMm)} mm en total, con ráfagas que llegaron a una intensidad de ${fmt(D.tormenta.maxIntensidadMmH)} mm/h. La lluvia no es pareja: tiene picos cortos y violentos — y son esos picos los que inundan una calle.`,
    ],
  },
  {
    titulo: 'Aquí está el diferenciador',
    parrafos: [
      'La práctica común en Colombia solo conoce el TOTAL del día (un número) y "desagrega" esa lluvia con fórmulas regionales para adivinar cómo se repartió.',
      'Esta plataforma no adivina: usa los 144 pulsos reales de cada día. Esa es la diferencia entre estimar una curva IDF y construirla con datos de verdad — el corazón de esta tesis.',
    ],
  },
  {
    titulo: 'Décadas de tormentas',
    parrafos: [
      `Para diseñar no basta una tormenta: hay que conocerlas todas. De cada año de registro guardamos su peor tormenta de 24 horas — aquí están las de ${D.estacion.nombre} (${D.maximosAnuales.length} años, el anillo dorado es la tormenta que acabas de ver).`,
      'A simple vista parecen puntos al azar. La hidrología existe para encontrarles el patrón.',
    ],
  },
  {
    titulo: 'Domar el azar',
    parrafos: [
      'La distribución de Gumbel — la matemática de los valores extremos — ordena ese caos: a cada lámina de lluvia le asigna una probabilidad de ser superada.',
      'De ahí sale el período de retorno (Tr). Ojo con la trampa: "Tr = 25 años" NO significa que ocurra cada 25 años — significa que cada año hay un 4% de probabilidad de que se supere. La franja dorada es la incertidumbre del ajuste (IC 90%): con series cortas, es honesta y ancha.',
    ],
  },
  {
    titulo: 'Nacen las curvas',
    parrafos: [
      'Repitiendo ese análisis para cada duración — 10 minutos, 30, una hora, un día — aparecen las curvas IDF: Intensidad, Duración, Frecuencia. Cada curva es un período de retorno; cada punto dice "para una lluvia de esta duración, espera esta intensidad".',
      'Lo que antes tomaba semanas de cálculo manual, aquí sale de los datos reales de la estación. Así de simple — y así de citable.',
    ],
  },
  {
    titulo: 'Una fórmula que resume décadas',
    parrafos: [
      'Toda esa familia de curvas se condensa en una sola expresión — la forma canónica colombiana de Vargas & Díaz-Granados (1998) — ajustada a esta estación con los parámetros que ves.',
      'Con un R² así de alto, la ecuación reproduce fielmente las curvas: es la estación entera, lista para usarse en una calculadora.',
    ],
  },
  {
    titulo: 'De la curva al diseño',
    parrafos: [
      'Y así se cierra el círculo: el método racional toma una intensidad de la curva (C·I·A) y la convierte en el caudal que una obra debe evacuar. De gotas cada 10 minutos a una decisión de ingeniería.',
      'Importante: esta plataforma es orientativa — el diseño real lo rigen la RAS 0330, el manual del INVÍAS y el criterio profesional. Pero ahora ya sabes exactamente de dónde sale cada número.',
    ],
  },
];

interface HistoriaIdfProps {
  onNavigate: (view: string) => void;
}

export function HistoriaIdf({ onNavigate }: HistoriaIdfProps) {
  const [escena, setEscena] = useState(1);
  const escenaRef = useRef(1);
  const seccionesRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const ratios = new Array(TOTAL_ESCENAS).fill(0);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.escena) - 1;
          if (idx >= 0) ratios[idx] = e.intersectionRatio;
        }
        const siguiente = escenaMasVisible(ratios, escenaRef.current);
        if (siguiente !== escenaRef.current) {
          escenaRef.current = siguiente;
          setEscena(siguiente);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    seccionesRef.current.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {/* Barra de progreso de lectura */}
      <div className="sticky top-0 z-10 -mx-4 mb-2 h-1 bg-border/40 md:-mx-6">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300"
          style={{ width: `${(escena / TOTAL_ESCENAS) * 100}%` }}
        />
      </div>

      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-card-foreground">
          <Sparkles className="h-6 w-6 text-accent" /> La historia del dato
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo la lluvia de cada 10 minutos se convierte en curvas IDF reales. Desplázate para avanzar.
        </p>
      </div>

      {/* Móvil: gráfica sticky arriba. Desktop: texto izquierda, gráfica sticky derecha. */}
      <div className="md:grid md:grid-cols-[1fr_1.1fr] md:gap-8">
        <div className="sticky top-2 z-[5] h-[38vh] md:order-2 md:top-20 md:h-[70vh]">
          <GraficaViva escena={escena} data={D} />
        </div>

        <div className="md:order-1">
          {ESCENAS.map((s, i) => (
            <section
              key={s.titulo}
              data-escena={i + 1}
              ref={(el) => {
                seccionesRef.current[i] = el;
              }}
              className="flex min-h-[80vh] flex-col justify-center py-10"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                {i + 1} / {TOTAL_ESCENAS}
              </p>
              <h3 className="mb-4 text-xl font-bold text-card-foreground">{s.titulo}</h3>
              {s.parrafos.map((p) => (
                <p key={p.slice(0, 24)} className="mb-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}

              {i + 1 === TOTAL_ESCENAS && (
                <div className="mt-6 flex flex-wrap gap-3 pb-24 md:pb-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('hydro')}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Explora tu propia estación <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT))}
                    className="inline-flex items-center gap-2 rounded-lg border border-accent/50 px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <MessageCircle className="h-4 w-4" /> Pregúntale al asistente
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      <footer className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
        Datos reales de la estación {D.estacion.nombre} ({D.estacion.codigo}), {D.estacion.municipio} —{' '}
        {D.estacion.departamento}, generados el {D.generadoEl}. {D.fuente}. Plataforma orientativa: no sustituye el
        diseño normado ni el criterio profesional.
      </footer>
    </div>
  );
}
