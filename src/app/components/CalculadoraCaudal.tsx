import { useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { InfoGrafica } from './InfoGrafica';
import { Formula, Frac, V } from './Formula';
import { fmt } from '../lib/format';
import { tiemposConcentracion, FACTOR_RECORRIDO, PISO_TC_URBANO, PISO_TC_VIAL, type MetodoTc, type Recorrido } from '../lib/hydro/tc';
import { cAjustado, qRacional, factorFrecuencia, intensidadIdf, type ResultadoRacional } from '../lib/hydro/runoff';
import { CITAS } from '../lib/hydro/normas';
import { METODOLOGIA, variablesDe } from '../lib/metodologia/contenido';
import { SeccionColapsable, Field, NumberInput, Select } from './calculadora/SeccionColapsable';
import { SeccionTc } from './calculadora/SeccionTc';
import { SeccionCoefC, type Contexto } from './calculadora/SeccionCoefC';
import { SeccionManning } from './calculadora/SeccionManning';
import { TablaNormaView } from './calculadora/TablaNormaView';
import { TABLA_TR_VIAL, TABLA_TR_URBANO } from '../lib/hydro/tablasNorma';
import { CalculoPasoAPaso } from './calculadora/CalculoPasoAPaso';

const RETURN_PERIODS = [2, 5, 10, 25, 50, 100];

// "Cómo se consigue" de A (metodo-racional), L y S (tiempo-concentracion) del
// registro único de metodología, para mostrarlos como ayuda inline junto a cada
// campo (misma fuente que el desplegable de la sección 2, sin duplicar texto).
const comoSeObtiene = (id: string, simbolo: string) =>
  variablesDe(id).find((v) => v.simbolo === simbolo)?.comoSeObtiene;
const HELP_AREA = comoSeObtiene('metodo-racional', 'A');
const HELP_LONGITUD = comoSeObtiene('tiempo-concentracion', 'L');
const HELP_PENDIENTE = comoSeObtiene('tiempo-concentracion', 'S');

interface Props {
  equation: { K: number; m: number; n: number };
  durations: number[]; // duraciones con datos (para advertir extrapolación)
}

// Valores de ejemplo con los que arranca la calculadora (no son "los tuyos"):
// se muestran de entrada para que el resultado nunca aparezca vacío, pero un
// no técnico podría tomarlos como propios si no se avisa explícitamente.
const AREA_EJEMPLO = '5'; // hectáreas
const LONGITUD_EJEMPLO = '800'; // m
const PENDIENTE_EJEMPLO = '2'; // %
const C_BASE_EJEMPLO = '0.83'; // punto medio de 'Distritos comerciales, centro' (INVÍAS Tabla 2.9)

export function CalculadoraCaudal({ equation, durations }: Props) {
  const [tr, setTr] = useState(10);
  const [trSel, setTrSel] = useState<{ tabla: 'vial' | 'urbano'; fila: number } | null>(null);
  const [area, setArea] = useState(AREA_EJEMPLO);
  const [longitud, setLongitud] = useState(LONGITUD_EJEMPLO);
  const [pendiente, setPendiente] = useState(PENDIENTE_EJEMPLO);
  const [tcMetodo, setTcMetodo] = useState<MetodoTc | 'recomendado'>('recomendado');
  const [recorrido, setRecorrido] = useState<Recorrido>('rural');
  const [cContexto, setCContexto] = useState<Contexto>('urbana');
  const [cBase, setCBase] = useState(C_BASE_EJEMPLO);

  // Mientras nadie haya tocado cuenca ni superficie, los resultados son del
  // ejemplo sembrado, no "los del usuario": se avisa para que no se confundan.
  const sonValoresEjemplo =
    area === AREA_EJEMPLO && longitud === LONGITUD_EJEMPLO && pendiente === PENDIENTE_EJEMPLO && cBase === C_BASE_EJEMPLO;

  const A = parseFloat(area);
  const L = parseFloat(longitud);
  const S = parseFloat(pendiente);

  // Piso de diseño del Tc según el contexto de la obra elegida en las tablas de Tr:
  // 15 min si es vial (Manual INVÍAS 2009, pág. 2-8); 10 min si es urbana o no se
  // eligió obra (extremo del rango 3-10 min del RAS 0330, Art. 135, num. 4).
  const pisoTc = trSel?.tabla === 'vial' ? PISO_TC_VIAL : PISO_TC_URBANO;

  const tcs = useMemo(
    () => tiemposConcentracion(L, S / 100, A, FACTOR_RECORRIDO[recorrido], pisoTc),
    [L, S, A, recorrido, pisoTc],
  );

  const tcUsado = useMemo(() => {
    if (tcMetodo === 'recomendado') return tcs.recomendado;
    return tcs[tcMetodo];
  }, [tcMetodo, tcs]);

  const cAjust = useMemo(() => cAjustado(parseFloat(cBase), tr), [cBase, tr]);

  const result = useMemo(() => {
    if (!(A > 0) || tcUsado == null || !(tcUsado > 0)) return null;
    const intensidad = intensidadIdf(equation, tr, tcUsado);
    const q = qRacional(cAjust, intensidad, A);
    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);
    const warnings: string[] = [];
    // Límite de validez del método racional según el contexto de la obra elegida:
    // 80 ha en drenaje urbano (RAS 0330) y 250 ha (2,5 km²) en drenaje vial
    // (INVÍAS 2009, sección 2.5.5.1). Sin obra elegida se avisa desde 80 ha
    // mencionando ambos límites. El resultado no se bloquea: solo se advierte.
    if (trSel?.tabla === 'vial') {
      if (A > 250) warnings.push('Área > 250 ha (2,5 km²): el método racional deja de ser válido en drenaje vial (Manual de Drenaje INVÍAS 2009, sección 2.5.5.1); usa modelación hidrológica (hidrograma / HEC-HMS).');
    } else if (trSel?.tabla === 'urbano') {
      if (A > 80) warnings.push('Área > 80 ha: el método racional deja de ser válido en drenaje urbano (RAS 0330, Art. 135); usa modelación hidrológica (hidrograma / HEC-HMS).');
    } else if (A > 80) {
      warnings.push('Área > 80 ha: supera el límite del método racional en drenaje urbano (80 ha, RAS 0330); en drenaje vial el límite es 250 ha, es decir 2,5 km² (INVÍAS 2009). Por encima de esos límites usa modelación hidrológica (hidrograma / HEC-HMS).');
    }
    if (tcUsado < minDur) warnings.push(`Tc = ${fmt(tcUsado, 1)} min es menor que la duración mínima medida (${minDur} min): la intensidad se extrapola fuera del rango calibrado.`);
    if (tcUsado > maxDur) warnings.push(`Tc = ${fmt(tcUsado, 1)} min excede la duración máxima (${maxDur} min): intensidad extrapolada.`);
    return { intensidad, q, warnings };
  }, [A, tcUsado, cAjust, tr, equation, durations, trSel]);

  // Entradas + intermedios + salida de este cálculo racional, agrupados en un
  // único objeto (ResultadoRacional) en vez de pasarlos sueltos: reduce la
  // superficie de cambio de CalculoPasoAPaso a un solo tipo cuando se agregue un
  // parámetro nuevo (ya pasó con recorrido/Kirpich modificado).
  const resultadoRacional = useMemo<ResultadoRacional | null>(() => {
    if (!result || tcUsado == null) return null;
    return {
      L, S, A, tcs, tcUsado, tcMetodo,
      cBase: parseFloat(cBase),
      cf: factorFrecuencia(tr),
      cAjust, tr, equation,
      intensidad: result.intensidad,
      q: result.q,
    };
  }, [result, L, S, A, tcs, tcUsado, tcMetodo, cBase, tr, cAjust, equation]);

  const avisoKirpich = cContexto === 'urbana';
  // Giandotti se calibró en cuencas italianas grandes; cuando su valor domina la
  // mediana en una cuenca muy pequeña (< 100 ha) puede sobreestimar el Tc y
  // arrastrar el recomendado al alza, así que se avisa (sin cambiar el default).
  const avisoGiandotti = tcs.metodoRecomendado === 'giandotti' && A > 0 && A < 100;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-card-foreground">Calculadora de caudal de diseño (método racional)</h3>
          <p className="text-sm text-muted-foreground">
            Calcula cuánta agua de lluvia debe evacuar tu obra (cuneta, alcantarilla, canal) y comprueba si la tubería o el
            canal alcanzan.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <InfoGrafica id="metodo-racional" />
          <Calculator className="h-5 w-5 shrink-0 text-accent" />
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-card-foreground">Qué necesitas: </span>
          el área de la cuenca, la longitud y la pendiente del cauce, y el tipo de superficie (pavimento, techo, prado,
          tierra…) del área que drena hacia tu obra.
        </div>
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-card-foreground">En términos técnicos</summary>
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Tc por varios métodos → intensidad de la IDF → C ponderado por frecuencia → caudal pico → verificación con Manning.
          </p>
        </details>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">Sigue las secciones en orden 1 → 4; cada una parte del resultado de la anterior.</p>

      <div className="space-y-3">
        {/* 1 · Parámetros de cuenca */}
        <SeccionColapsable titulo="1 · Parámetros de cuenca" descripcion="Geometría y período de retorno de diseño" inicialAbierta={false}>
          {sonValoresEjemplo && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Estos son valores de <span className="font-semibold">ejemplo</span>: cámbialos por los de tu cuenca y tu
                superficie para que el caudal sea el de tu obra, no el de este ejemplo.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Período de retorno Tr (años)">
              <Select
                value={tr}
                onChange={(v) => { setTr(Number(v)); setTrSel(null); }}
                options={[...new Set([...RETURN_PERIODS, tr])].sort((a, b) => a - b).map((t) => ({ value: t, label: `${t} años` }))}
              />
            </Field>
            <Field label="Área de la cuenca (hectáreas)" help={HELP_AREA}>
              <NumberInput value={area} onChange={setArea} step="0.1" />
            </Field>
            <Field label="Longitud del cauce L (metros)" help={HELP_LONGITUD}>
              <NumberInput value={longitud} onChange={setLongitud} step="10" />
            </Field>
            <Field label="Pendiente media del cauce (%)" help={HELP_PENDIENTE}>
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
        <SeccionColapsable titulo="2 · Tiempo de concentración (Tc)" descripcion="Kirpich · Témez · Giandotti: rango y recomendado" inicialAbierta={false}>
          <SeccionTc tcs={tcs} metodo={tcMetodo} setMetodo={(m) => setTcMetodo(m as MetodoTc | 'recomendado')} tcUsado={tcUsado} recorrido={recorrido} setRecorrido={(r) => setRecorrido(r as Recorrido)} avisoKirpich={avisoKirpich} avisoGiandotti={avisoGiandotti} />
        </SeccionColapsable>

        {/* 3 · Coeficiente C */}
        <SeccionColapsable titulo="3 · Coeficiente de escorrentía C" descripcion="Por superficie, ajustado por factor de frecuencia Cf(Tr)" inicialAbierta={false}>
          <SeccionCoefC contexto={cContexto} setContexto={setCContexto} cBase={cBase} setCBase={setCBase} tr={tr} cAjust={cAjust} />
        </SeccionColapsable>

        {/* 4 · Caudal de diseño */}
        <SeccionColapsable titulo="4 · Caudal de diseño Q" descripcion="Método racional Q = C·I·A/360" resaltada inicialAbierta={false}>
          {result ? (
            <>
              {sonValoresEjemplo && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Este caudal es del ejemplo (sección 1), todavía no de tu obra: cambia el área, la cuenca y la superficie por las tuyas.</span>
                </div>
              )}
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
          {resultadoRacional ? (
            <CalculoPasoAPaso resultado={resultadoRacional} />
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
            {/* Mismas fórmulas que METODOLOGIA['metodo-racional']/['idf'] (registro único
                de contenido.tsx): se reutiliza el nodo para que no diverjan en silencio. */}
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="text-sm text-card-foreground">{METODOLOGIA['metodo-racional'].formula}</span>
              <span>·Método Racional (Q en m³/s, C adimensional, I en mm/h, A en hectáreas).</span>
            </p>
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="text-sm text-card-foreground">{METODOLOGIA['idf'].formula}</span>
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
