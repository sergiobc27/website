import { Fragment } from 'react';
import { Clock, Cog, Zap, ArrowRight, ArrowDown } from 'lucide-react';
import { Reveal, RevealItem } from './Reveal';

// Recorrido real del proyecto (problema -> lo que se construyó -> resultado).
// Texto honesto, alineado a la historia; sin cifras sin respaldo (el viejo 98%
// se reemplazó por "de días a segundos", que sí es defendible).
const PASOS = [
  {
    icon: Clock,
    tono: 'text-muted-foreground',
    kicker: 'El problema',
    titulo: 'Días por cada consulta',
    texto:
      'Los datos del IDEAM son enormes y están dispersos en datos.gov.co. Sacar una curva IDF para diseñar drenaje era un flujo manual de Python a PowerBI, con datos crudos y propensos a error.',
  },
  {
    icon: Cog,
    tono: 'text-secondary',
    kicker: 'Lo que construí',
    titulo: 'Automatizar, ordenar, publicar',
    texto:
      'Un paquete que extrae y limpia las series, un espejo propio de los datos para consultarlas en sub-segundos, y una plataforma web con la calculadora de caudal conforme a la norma (RAS e INVÍAS).',
  },
  {
    icon: Zap,
    tono: 'text-success',
    kicker: 'El resultado',
    titulo: 'Todo en segundos',
    texto:
      'Datos limpios, curvas IDF listas y el caudal de diseño de tu obra al instante. Operando a alrededor de $0 al mes.',
  },
];

export function SeccionProblemaSolucion() {
  return (
    <section id="landing-proyecto" className="bg-[#fbf7ee] px-6 py-16 dark:bg-[#15110a] md:px-10">
      <Reveal className="mx-auto max-w-6xl">
        <RevealItem>
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">
            Del problema a la solución
          </p>
        </RevealItem>
        <RevealItem>
          <h2 className="mb-10 text-center text-2xl font-black tracking-tight text-foreground md:text-3xl">
            Cómo pasé de días de trabajo a segundos
          </h2>
        </RevealItem>

        {/* Recorrido de 3 pasos: fila con flechas que fluyen en escritorio;
            columna con flechas hacia abajo en móvil. */}
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {PASOS.map((p, i) => (
            <Fragment key={p.kicker}>
              <RevealItem className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-glow">
                <span className="anim-float mb-3 inline-flex" style={{ animationDelay: `${i * 0.3}s` }}>
                  <p.icon className={`h-8 w-8 ${p.tono} transition-transform duration-300 group-hover:scale-125`} />
                </span>
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">{p.kicker}</p>
                <h3 className="mt-0.5 font-bold text-card-foreground">{p.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
              </RevealItem>
              {i < PASOS.length - 1 && (
                <RevealItem className="flex items-center justify-center text-primary">
                  <ArrowRight className="flujo-flecha hidden h-7 w-7 md:block" aria-hidden />
                  <ArrowDown className="flujo-flecha h-6 w-6 md:hidden" aria-hidden />
                </RevealItem>
              )}
            </Fragment>
          ))}
        </div>

        {/* Gancho honesto que reemplaza al viejo "98%": comparación defendible. */}
        <RevealItem>
          <div className="mt-12 flex flex-col items-center">
            <div className="flex items-center gap-3 text-4xl font-black md:text-5xl">
              <span className="text-muted-foreground line-through decoration-primary/60">días</span>
              <ArrowRight className="flujo-flecha h-7 w-7 text-primary md:h-8 md:w-8" aria-hidden />
              <span className="text-success">segundos</span>
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground md:text-sm">menos tiempo por consulta</p>
          </div>
        </RevealItem>
      </Reveal>
    </section>
  );
}
