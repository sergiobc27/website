import { useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { InfoGrafica } from './InfoGrafica';
import { Formula, Frac, Sub, Sup, V } from './Formula';
import { fmt } from '../lib/format';
import { tiemposConcentracion, FACTOR_RECORRIDO, type MetodoTc, type Recorrido } from '../lib/hydro/tc';
import { cAjustado, qRacional, factorFrecuencia } from '../lib/hydro/runoff';
import { CITAS } from '../lib/hydro/normas';
import { SeccionColapsable, Field, NumberInput, Select } from './calculadora/SeccionColapsable';
import { SeccionTc } from './calculadora/SeccionTc';
import { SeccionCoefC, type Contexto } from './calculadora/SeccionCoefC';
import { SeccionManning } from './calculadora/SeccionManning';
import { TablaNormaView } from './calculadora/TablaNormaView';
import { TABLA_TR_VIAL, TABLA_TR_URBANO } from '../lib/hydro/tablasNorma';
import { CalculoPasoAPaso } from './calculadora/CalculoPasoAPaso';

const RETURN_PERIODS = [2, 5, 10, 25, 50, 100];

interface Props {
  equation: { K: number; m: number; n: number };
  durations: number[]; // duraciones con datos (para advertir extrapolación)
}

export function CalculadoraCaudal({ equation, durations }: Props) {
  const [tr, setTr] = useState(10);
  const [trSel, setTrSel] = useState<{ tabla: 'vial' | 'urbano'; fila: number } | null>(null);
  const [area, setArea] = useState('5'); // hectáreas
  const [longitud, setLongitud] = useState('800'); // m
  const [pendiente, setPendiente] = useState('2'); // %
  const [tcMetodo, setTcMetodo] = useState<MetodoTc | 'recomendado'>('recomendado');
  const [recorrido, setRecorrido] = useState<Recorrido>('rural');
  const [cContexto, setCContexto] = useState<Contexto>('urbana');
  const [cBase, setCBase] = useState('0.83'); // punto medio de 'Distritos comerciales, centro' (INVÍAS Tabla 2.9)

  const A = parseFloat(area);
  const L = parseFloat(longitud);
  const S = parseFloat(pendiente);

  const tcs = useMemo(() => tiemposConcentracion(L, S / 100, A, FACTOR_RECORRIDO[recorrido]), [L, S, A, recorrido]);

  const tcUsado = useMemo(() => {
    if (tcMetodo === 'recomendado') return tcs.recomendado;
    return tcs[tcMetodo];
  }, [tcMetodo, tcs]);

  const cAjust = useMemo(() => cAjustado(parseFloat(cBase), tr), [cBase, tr]);

  const result = useMemo(() => {
    if (!(A > 0) || tcUsado == null || !(tcUsado > 0)) return null;
    const intensidad = (equation.K * Math.pow(tr, equation.m)) / Math.pow(tcUsado, equation.n);
    const q = qRacional(cAjust, intensidad, A);
    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);
    const warnings: string[] = [];
    if (A > 80) warnings.push('Área > 80 ha: el método racional deja de ser válido (RAS 0330); usa modelación hidrológica (hidrograma / HEC-HMS).');
    if (tcUsado < minDur) warnings.push(`Tc = ${fmt(tcUsado, 1)} min es menor que la duración mínima medida (${minDur} min): la intensidad se extrapola fuera del rango calibrado.`);
    if (tcUsado > maxDur) warnings.push(`Tc = ${fmt(tcUsado, 1)} min excede la duración máxima (${maxDur} min): intensidad extrapolada.`);
    return { intensidad, q, warnings };
  }, [A, tcUsado, cAjust, tr, equation, durations]);

  const avisoKirpich = cContexto === 'urbana';

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-card-foreground">Calculadora de caudal de diseño (método racional)</h3>
          <p className="text-sm text-muted-foreground">Tc por varios métodos → intensidad de la IDF → C ponderado por frecuencia → caudal pico → verificación con Manning.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <InfoGrafica id="metodo-racional" />
          <Calculator className="h-5 w-5 shrink-0 text-accent" />
        </div>
      </div>

      <div className="space-y-3">
        {/* 1 · Parámetros de cuenca */}
        <SeccionColapsable titulo="1 · Parámetros de cuenca" descripcion="Geometría y período de retorno de diseño">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Período de retorno Tr (años)">
              <Select
                value={tr}
                onChange={(v) => { setTr(Number(v)); setTrSel(null); }}
                options={[...new Set([...RETURN_PERIODS, tr])].sort((a, b) => a - b).map((t) => ({ value: t, label: `${t} años` }))}
              />
            </Field>
            <Field label="Área de la cuenca (hectáreas)">
              <NumberInput value={area} onChange={setArea} step="0.1" />
            </Field>
            <Field label="Longitud del cauce L (metros)">
              <NumberInput value={longitud} onChange={setLongitud} step="10" />
            </Field>
            <Field label="Pendiente media del cauce (%)">
              <NumberInput value={pendiente} onChange={setPendiente} step="0.1" />
            </Field>
          </div>
          {trSel && (
            <p className="mt-2 text-xs text-muted-foreground">
              Tr {tr} años · {String((trSel.tabla === 'vial' ? TABLA_TR_VIAL : TABLA_TR_URBANO).filas[trSel.fila][0])} (elegido de la tabla). Puedes sobrescribirlo con el selector de arriba.
            </p>
          )}
          <details className="mt-3 rounded-lg border border-border" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-card-foreground">
              Elegir Tr por tipo de obra: clic en el valor de la tabla de la norma
            </summary>
            <div className="space-y-4 border-t border-border px-3 py-3">
              <TablaNormaView
                tabla={TABLA_TR_VIAL}
                colsValor={[1]}
                onCelda={(f, _c, v) => { setTr(Number(v)); setTrSel({ tabla: 'vial', fila: f }); }}
                activa={trSel?.tabla === 'vial' ? { fila: trSel.fila, col: 1 } : null}
              />
              <TablaNormaView
                tabla={TABLA_TR_URBANO}
                colsValor={[1]}
                onCelda={(f, _c, v) => { setTr(Number(v)); setTrSel({ tabla: 'urbano', fila: f }); }}
                activa={trSel?.tabla === 'urbano' ? { fila: trSel.fila, col: 1 } : null}
              />
            </div>
          </details>
        </SeccionColapsable>

        {/* 2 · Tiempo de concentración */}
        <SeccionColapsable titulo="2 · Tiempo de concentración (Tc)" descripcion="Kirpich · Témez · Giandotti: rango y recomendado">
          <SeccionTc tcs={tcs} metodo={tcMetodo} setMetodo={(m) => setTcMetodo(m as MetodoTc | 'recomendado')} tcUsado={tcUsado} recorrido={recorrido} setRecorrido={(r) => setRecorrido(r as Recorrido)} avisoKirpich={avisoKirpich} />
        </SeccionColapsable>

        {/* 3 · Coeficiente C */}
        <SeccionColapsable titulo="3 · Coeficiente de escorrentía C" descripcion="Por superficie, ajustado por factor de frecuencia Cf(Tr)">
          <SeccionCoefC contexto={cContexto} setContexto={setCContexto} cBase={cBase} setCBase={setCBase} tr={tr} cAjust={cAjust} />
        </SeccionColapsable>

        {/* 4 · Caudal de diseño */}
        <SeccionColapsable titulo="4 · Caudal de diseño Q" descripcion="Método racional Q = C·I·A/360" resaltada>
          {result ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Resultado titulo="Tc usado" valor={fmt(tcUsado, 1)} unidad="min" sub={tcMetodo === 'recomendado' ? 'recomendado' : tcMetodo} />
                <Resultado titulo={`Intensidad (Tr ${tr}a, D = Tc)`} valor={fmt(result.intensidad, 1)} unidad="mm/h" sub="curva IDF en D = Tc (supuesto del método racional)" />
                <Resultado
                  titulo="Caudal de diseño Q"
                  valor={fmt(result.q, 3)}
                  unidad="m³/s"
                  sub={<Formula><V>Q</V>&nbsp;=&nbsp;<Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} /></Formula>}
                  destacado
                />
              </div>
              {result.warnings.map((w) => (
                <div key={w} className="mt-3 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Completa los parámetros de cuenca para obtener el caudal.</p>
          )}
        </SeccionColapsable>

        {/* 4b · Cálculo paso a paso */}
        <SeccionColapsable titulo="Cálculo paso a paso" descripcion="La aritmética con tus valores, con su referencia" inicialAbierta={false}>
          {result && tcUsado != null ? (
            <CalculoPasoAPaso
              L={L}
              S={S}
              A={A}
              tcs={tcs}
              tcUsado={tcUsado}
              tcMetodo={tcMetodo}
              cBase={parseFloat(cBase)}
              cf={factorFrecuencia(tr)}
              cAjust={cAjust}
              tr={tr}
              equation={equation}
              intensidad={result.intensidad}
              q={result.q}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Completa los parámetros para ver el desarrollo.</p>
          )}
        </SeccionColapsable>

        {/* 5 · Verificación hidráulica */}
        <SeccionColapsable titulo="5 · Verificación hidráulica (Manning)" descripcion="Capacidad, llenado y velocidades del conducto" inicialAbierta={false}>
          {result ? (
            <SeccionManning q={result.q} pendienteCuenca={pendiente} />
          ) : (
            <p className="text-sm text-muted-foreground">Primero calcula el caudal de diseño.</p>
          )}
        </SeccionColapsable>

        {/* 6 · Método y referencias */}
        <SeccionColapsable titulo="6 · Método y referencias" descripcion="Fórmulas y citas" inicialAbierta={false}>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex flex-wrap items-center gap-x-2">
              <Formula className="text-sm text-card-foreground"><V>Q</V>&nbsp;=&nbsp;<Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} /></Formula>
              <span>·Método Racional (Q en m³/s, C adimensional, I en mm/h, A en hectáreas).</span>
            </p>
            <p className="flex flex-wrap items-center gap-x-2">
              <Formula className="text-sm text-card-foreground"><V>I</V>&nbsp;=&nbsp;<Frac num={<><V>K</V> · <V>T</V><Sup><V>m</V></Sup></>} den={<><V>D</V><Sup><V>n</V></Sup></>} /></Formula>
              <span>·curva IDF ajustada de esta estación (D = Tc).</span>
            </p>
            <p>· Validez del método racional: área &lt; 80 ha (RAS 0330/2017, Art. 135) y A ≤ 2,5 km² (Manual de Drenaje INVÍAS 2009, sección 2.5.5.1). C según la cobertura real del área aportante.</p>
            <p>· Frontera de alcance: producto HIDROLÓGICO (caudal e intensidad de diseño). El dimensionamiento estructural-hidráulico de la obra se rige por NSR-10 / AASHTO / INVÍAS y queda fuera de esta herramienta.</p>
            <p className="text-accent">· Resultado orientativo de pre-dimensionamiento; para diseño definitivo valida con la normativa y un especialista.</p>
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              <p className="font-semibold text-card-foreground">Referencias</p>
              {Object.values(CITAS).map((c) => (
                <p key={c.clave} className="text-[11px] leading-snug">{c.apa}</p>
              ))}
            </div>
          </div>
        </SeccionColapsable>
      </div>
    </div>
  );
}

function Resultado({ titulo, valor, unidad, sub, destacado }: { titulo: string; valor: string; unidad: string; sub: React.ReactNode; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destacado ? 'border-accent bg-accent/10' : 'border-border bg-background'}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`font-mono text-xl font-bold ${destacado ? 'text-accent' : 'text-card-foreground'}`}>
        {valor} <span className="text-sm font-normal">{unidad}</span>
      </p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
