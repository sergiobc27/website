import { Formula, Frac, Sub, Sup, V } from '../Formula';
import { fmt } from '../../lib/format';
import type { TiemposTc, MetodoTc } from '../../lib/hydro/tc';

/** Muestra la aritmética sustituida paso a paso con los valores actuales del
 * usuario, cada paso con su referencia. No recalcula nada: recibe lo ya
 * computado por la calculadora. */
export function CalculoPasoAPaso({
  L, S, A, tcs, tcUsado, tcMetodo, cBase, cf, cAjust, tr, equation, intensidad, q,
}: {
  L: number; S: number; A: number;
  tcs: TiemposTc; tcUsado: number; tcMetodo: MetodoTc | 'recomendado';
  cBase: number; cf: number; cAjust: number; tr: number;
  equation: { K: number; m: number; n: number }; intensidad: number; q: number;
}) {
  const Skm = S / 100; // pendiente en m/m (la UI la captura en %)
  return (
    <>
    <ol className="space-y-3 text-xs text-muted-foreground">
      <Paso n={1} titulo="Tiempo de concentración (Tc)" fuente="Kirpich (1940); Témez (1978); Giandotti (1934); factores del Kirpich modificado: Chow, Maidment y Mays (1988), Tabla 15.1.2. La mediana de los métodos es un criterio del autor. Piso de diseño según la obra: el Manual INVÍAS (2009, pág. 2-8) exige un mínimo de 15 min en drenaje vial; el RAS 0330 (Art. 135, num. 4) admite mínimos de 3 a 10 min en drenaje urbano.">
        <Linea>
          <Formula className="text-card-foreground">
            <V>T</V><Sub>c</Sub> (Kirpich{tcs.kirpichModificado ? ' modificado' : ''}) = {tcs.kirpichModificado ? <>{fmt(tcs.factorRecorrido, 1)} · </> : null}0,0195 · {fmt(L, 0)}<Sup>0,77</Sup> · {fmt(Skm, 4)}<Sup>−0,385</Sup> = {fmt(tcs.kirpich, 1)} min
          </Formula>
        </Linea>
        <Linea>Témez = {fmt(tcs.temez, 1)} min · Giandotti = {fmt(tcs.giandotti, 1)} min · <strong className="text-card-foreground">Tc usado = {fmt(tcUsado, 1)} min</strong> ({tcMetodo === 'recomendado' ? 'recomendado (mediana)' : tcMetodo}{tcs.pisoAplicado ? `, elevado al piso de ${fmt(tcs.piso, 0)} min (${tcs.piso === 15 ? 'obra vial, Manual INVÍAS 2009' : 'RAS 0330, Art. 135, num. 4'})` : ''})</Linea>
      </Paso>

      <Paso n={2} titulo="Coeficiente de escorrentía C ajustado" fuente="C base: INVÍAS (2009), Tablas 2.9/2.10. Factor Cf: Chow, Maidment & Mays (1988).">
        <Linea>
          <Formula className="text-card-foreground">
            <V>C</V> = mín(1; {fmt(cBase, 2)} · {fmt(cf, 2)}) = {fmt(cAjust, 2)}
          </Formula>
          <span className="ml-1">(Cf para Tr {tr} años)</span>
        </Linea>
      </Paso>

      <Paso n={3} titulo="Intensidad de la IDF en D = Tc" fuente="Curva IDF ajustada de la estación (RAS 0330, Art. 135, num. 2).">
        <Linea>
          <Formula className="text-card-foreground">
            <V>I</V> = <Frac num={<>{fmt(equation.K, 2)} · {fmt(tr, 0)}<Sup>{fmt(equation.m, 3)}</Sup></>} den={<>{fmt(tcUsado, 1)}<Sup>{fmt(equation.n, 3)}</Sup></>} /> = {fmt(intensidad, 1)} mm/h
          </Formula>
        </Linea>
      </Paso>

      <Paso n={4} titulo="Caudal de diseño (método racional)" fuente="Método racional: RAS 0330 (Art. 135) e INVÍAS (2009), §2.5.5.2. Q en m³/s, C adimensional, I en mm/h, A en hectáreas.">
        <Linea>
          <Formula className="text-base text-accent">
            <V>Q</V> = <Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} /> = <Frac num={<>{fmt(cAjust, 2)} · {fmt(intensidad, 1)} · {fmt(A, 1)}</>} den={<>360</>} /> = {fmt(q, 3)} m³/s
          </Formula>
        </Linea>
      </Paso>
    </ol>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Los valores se muestran redondeados; el cálculo usa la precisión completa.
      </p>
    </>
  );
}

function Paso({ n, titulo, fuente, children }: { n: number; titulo: string; fuente: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <p className="mb-1 text-xs font-semibold text-card-foreground">{n}. {titulo}</p>
      <div className="space-y-1">{children}</div>
      <p className="mt-2 border-t border-border/60 pt-1.5 text-[11px] leading-snug text-muted-foreground">Fuente: {fuente}</p>
    </li>
  );
}

function Linea({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-1">{children}</div>;
}
