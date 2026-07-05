import { useId } from 'react';
import { motion } from 'motion/react';
import { Info, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CitaFuente } from './calculadora/CitaFuente';
import { FormulaIdf, Sub, Sup, V } from './Formula';
import { METODOLOGIA } from '../lib/metodologia/contenido';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';
import { fmt } from '../lib/format';

/**
 * Botón "(i)" junto a la ecuación IDF ajustada. Explica de dónde salen los
 * coeficientes vivos K, m y n de la estación (a diferencia de InfoGrafica, que
 * describe la gráfica en general): el ajuste por regresión log-log sobre los
 * extremos de 10 min y qué significa cada coeficiente y el R² logarítmico.
 */
export function InfoEcuacionIdf({ equation }: { equation: { K: number; m: number; n: number; r2: number } }) {
  const reducido = usePrefersReducedMotion();
  const tituloId = useId();
  const fuentes = METODOLOGIA['idf']?.fuentes ?? [];

  const irAMetodologia = () => {
    window.history.pushState(null, '', '/metodologia#idf');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          aria-label="¿De dónde sale la ecuación ajustada?"
          title="¿De dónde sale esta ecuación?"
          whileHover={{ scale: 1.18 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-card text-accent transition-colors hover:border-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Info className="h-3.5 w-3.5" />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        collisionPadding={12}
        aria-labelledby={tituloId}
        className="max-h-[min(75vh,var(--radix-popover-content-available-height))] w-[21rem] max-w-[92vw] overflow-y-auto overscroll-contain p-0"
      >
        <motion.div
          initial={reducido ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-3 p-4"
        >
          <div>
            <h4 id={tituloId} className="text-sm font-bold text-card-foreground">¿De dónde sale esta ecuación?</h4>
            <p className="mt-1 text-xs font-medium text-accent">El ajuste vivo de la curva IDF de esta estación.</p>
          </div>

          <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
            <FormulaIdf equation={equation} className="text-sm font-semibold text-card-foreground" />
          </div>

          <Bloque etiqueta="Cómo se obtiene">
            Se parte de la lluvia sub-horaria (datos de 10 min): para cada duración estándar (10, 20, 30, 60 min…)
            y cada período de retorno se calcula la intensidad máxima, y sobre toda esa familia de puntos se ajusta,
            por regresión de mínimos cuadrados en escala logarítmica (log-log), la única ecuación
            {' '}<V>I</V> = <V>K</V>·<V>T</V><Sup><V>m</V></Sup>/<V>D</V><Sup><V>n</V></Sup> que mejor los reproduce.
          </Bloque>

          <Bloque etiqueta="Qué significa cada coeficiente">
            <span className="font-semibold text-card-foreground">K = {fmt(equation.K, 3)}</span> fija la escala general de la intensidad;
            {' '}<span className="font-semibold text-card-foreground">m = {fmt(equation.m, 3)}</span> mide cuánto sube la intensidad al aumentar el período de retorno;
            {' '}<span className="font-semibold text-card-foreground">n = {fmt(equation.n, 3)}</span> mide qué tan rápido cae al alargarse el aguacero.
          </Bloque>

          <Bloque etiqueta="Qué tan bien ajusta">
            <V>R</V><Sup>2</Sup><Sub>log</Sub> = {fmt(equation.r2, 3)}: mide qué tan bien la ecuación reproduce los puntos en
            escala logarítmica. Cuanto más cerca de 1, mejor el ajuste.
          </Bloque>

          {fuentes.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              {fuentes.map((f, i) => (
                <CitaFuente key={i} fuente={f} />
              ))}
            </div>
          )}

          <motion.button
            type="button"
            onClick={irAMetodologia}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="group mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent ring-1 ring-inset ring-accent/30 transition-colors hover:bg-accent/20"
          >
            Saber más: explicación técnica y PDF
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

function Bloque({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="text-xs leading-snug text-card-foreground">{children}</p>
    </div>
  );
}
