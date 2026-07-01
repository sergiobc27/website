import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { BookOpenText, Info } from 'lucide-react';
import { Reveal, RevealItem } from './landing/Reveal';
import { CitaFuente } from './calculadora/CitaFuente';
import { TablaNormaView } from './calculadora/TablaNormaView';
import { VariablesLista } from './VariablesLista';
import { IlustracionMetodo } from './IlustracionMetodo';
import { METODOLOGIA, SECCIONES_METODOLOGIA, type EntradaMetodo } from '../lib/metodologia/contenido';
import {
  TABLA_C_URBANA,
  TABLA_C_RURAL,
  TABLA_CF,
  TABLA_TR_VIAL,
  TABLA_TR_URBANO,
  type TablaNorma,
} from '../lib/hydro/tablasNorma';

// Tablas de norma asociadas a cada método (se muestran bajo su explicación).
const TABLAS_POR_ID: Record<string, TablaNorma[]> = {
  'coeficiente-c': [TABLA_C_URBANA, TABLA_C_RURAL],
  'factor-cf': [TABLA_CF],
  'metodo-racional': [TABLA_TR_VIAL, TABLA_TR_URBANO],
};

export function Metodologia() {
  const [destacado, setDestacado] = useState<string | null>(null);

  // Deep-link: al abrir /metodologia#<id> (desde el botón i de una gráfica),
  // desplaza la sección a la vista y la resalta con un destello animado.
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setDestacado(id);
    }, 120);
    const t2 = window.setTimeout(() => setDestacado(null), 2800);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenText className="h-6 w-6 text-accent" />
            <h2 className="text-2xl font-bold text-card-foreground">Metodología</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Qué significa cada gráfica y de dónde sale cada fórmula y cada tabla. Cada método cita el artículo,
            tabla o referencia exacta para que puedas comprobarlo en la fuente original.
          </p>
          <div className="mt-3 flex max-w-3xl items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              Fines académicos y de investigación. Las fuentes se citan y enlazan con este único fin; los derechos
              pertenecen a sus autores y editoriales. Las obras protegidas se enlazan a su DOI o editorial y no se
              alojan; los PDF disponibles provienen de fuentes oficiales o de acceso abierto.
            </span>
          </div>
        </div>

        {SECCIONES_METODOLOGIA.map((seccion) => (
          <section key={seccion.titulo} className="space-y-4">
            <h3 className="border-b border-border pb-2 text-lg font-bold text-card-foreground">{seccion.titulo}</h3>
            <Reveal className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {seccion.ids.map((id) => {
                const entrada = METODOLOGIA[id];
                return entrada ? <Tarjeta key={id} entrada={entrada} destacado={destacado === id} /> : null;
              })}
            </Reveal>
          </section>
        ))}
      </div>
    </MotionConfig>
  );
}

function Tarjeta({ entrada, destacado }: { entrada: EntradaMetodo; destacado: boolean }) {
  const tablas = TABLAS_POR_ID[entrada.id];
  return (
    <RevealItem>
      {/* scroll-mt para que el deep-link no quede tapado por la navbar overlay. */}
      <article id={entrada.id} className="relative scroll-mt-24 h-full rounded-xl border border-border bg-card p-5 shadow-glow">
        {destacado && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-accent"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.6, times: [0, 0.12, 0.72, 1], ease: 'easeInOut' }}
          />
        )}
        <h4 className="font-bold text-card-foreground">{entrada.titulo}</h4>
        <p className="mt-1 text-sm font-medium text-accent">{entrada.resumen}</p>

        <IlustracionMetodo id={entrada.id} className="mt-3" />

        {entrada.formula && (
          <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-card-foreground">
            {entrada.formula}
          </div>
        )}

        {entrada.variables && entrada.variables.length > 0 && (
          <VariablesLista variables={entrada.variables} className="mt-3" />
        )}

        <dl className="mt-3 space-y-2 text-sm">
          <Campo etiqueta="Qué es">{entrada.queEs}</Campo>
          <Campo etiqueta="Cómo se lee">{entrada.comoSeLee}</Campo>
          <Campo etiqueta="Para qué sirve">{entrada.paraQueSirve}</Campo>
        </dl>

        {tablas && (
          <div className="mt-4 space-y-4">
            {tablas.map((t) => (
              <TablaNormaView key={t.titulo} tabla={t} />
            ))}
          </div>
        )}

        {entrada.fuentes.length > 0 && (
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Referencias</p>
            {entrada.fuentes.map((f, i) => (
              <CitaFuente key={i} fuente={f} />
            ))}
          </div>
        )}
      </article>
    </RevealItem>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="leading-snug text-card-foreground">{children}</dd>
    </div>
  );
}
