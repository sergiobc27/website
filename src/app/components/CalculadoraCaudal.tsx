import { useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { Formula, Frac, Sub, Sup, V } from './Formula';
import { fmt } from '../lib/format';

// Coeficientes de escorrentía C típicos (rango y valor de referencia) — basados
// en tablas de uso común en Colombia (RAS 0330 / manuales de drenaje).
const TIPOS_SUPERFICIE: Array<{ label: string; c: number; rango: string }> = [
  { label: 'Pavimento asfáltico / concreto', c: 0.85, rango: '0,70–0,95' },
  { label: 'Techos / cubiertas', c: 0.85, rango: '0,75–0,95' },
  { label: 'Zona comercial / densa', c: 0.7, rango: '0,60–0,85' },
  { label: 'Residencial', c: 0.5, rango: '0,40–0,65' },
  { label: 'Zonas verdes / parques', c: 0.2, rango: '0,10–0,30' },
  { label: 'Suelo natural / cultivos', c: 0.2, rango: '0,10–0,35' },
];

const RETURN_PERIODS = [2, 5, 10, 25, 50, 100];

interface Props {
  equation: { K: number; m: number; n: number };
  durations: number[]; // duraciones con datos (para advertir extrapolación)
}

// Tiempo de concentración de Kirpich (1940): Tc[min] = 0.0195 · L^0.77 · S^-0.385
// con L en metros y S la pendiente media del cauce (m/m).
function kirpich(longitudM: number, pendientePct: number): number | null {
  const s = pendientePct / 100;
  if (!(longitudM > 0) || !(s > 0)) return null;
  return 0.0195 * Math.pow(longitudM, 0.77) * Math.pow(s, -0.385);
}

export function CalculadoraCaudal({ equation, durations }: Props) {
  const [tr, setTr] = useState(10);
  const [area, setArea] = useState('5'); // hectáreas
  const [coefC, setCoefC] = useState(0.7);
  const [longitud, setLongitud] = useState('800'); // m
  const [pendiente, setPendiente] = useState('2'); // %

  const result = useMemo(() => {
    const A = parseFloat(area);
    const L = parseFloat(longitud);
    const S = parseFloat(pendiente);
    if (!(A > 0) || !Number.isFinite(coefC)) return null;
    const tc = kirpich(L, S);
    if (tc === null) return null;
    // Intensidad de la ecuación IDF de la estación, evaluada en D = Tc.
    const intensidad = equation.K * Math.pow(tr, equation.m) / Math.pow(tc, equation.n);
    // Método racional: Q[m³/s] = C·I·A / 360  (A en ha, I en mm/h).
    const q = (coefC * intensidad * A) / 360;
    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);
    const warnings: string[] = [];
    if (A > 80) warnings.push('Área > 80 ha: el método racional deja de ser válido (RAS 0330); usa modelación hidrológica (hidrograma / HEC-HMS).');
    if (tc < minDur) warnings.push(`Tc = ${fmt(tc, 1)} min es menor que la duración mínima medida (${minDur} min): la intensidad se extrapola fuera del rango calibrado.`);
    if (tc > maxDur) warnings.push(`Tc = ${fmt(tc, 1)} min excede la duración máxima (${maxDur} min): intensidad extrapolada.`);
    return { tc, intensidad, q, warnings };
  }, [area, coefC, longitud, pendiente, tr, equation, durations]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-card-foreground">Calculadora de caudal de diseño (método racional)</h3>
          <p className="text-sm text-muted-foreground">Convierte la curva IDF de esta estación en un caudal pico, con tus datos de cuenca.</p>
        </div>
        <Calculator className="h-5 w-5 shrink-0 text-accent" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Período de retorno (años)">
          <select value={tr} onChange={(e) => setTr(Number(e.target.value))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent">
            {RETURN_PERIODS.map((t) => <option key={t} value={t}>{t} años</option>)}
          </select>
        </Field>
        <Field label="Área de la cuenca (hectáreas)">
          <input type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent" />
        </Field>
        <Field label="Coef. de escorrentía C (superficie)">
          <select
            value={coefC}
            onChange={(e) => setCoefC(Number(e.target.value))}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent"
          >
            {TIPOS_SUPERFICIE.map((t) => (
              <option key={t.label} value={t.c}>{t.label} (C≈{fmt(t.c, 2)}, {t.rango})</option>
            ))}
          </select>
        </Field>
        <Field label="Longitud del cauce L (metros)">
          <input type="number" min="0" step="10" value={longitud} onChange={(e) => setLongitud(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent" />
        </Field>
        <Field label="Pendiente media del cauce (%)">
          <input type="number" min="0" step="0.1" value={pendiente} onChange={(e) => setPendiente(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent" />
        </Field>
      </div>

      {result && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Resultado titulo="Tiempo de concentración" valor={fmt(result.tc, 1)} unidad="min" sub="Kirpich (1940)" />
          <Resultado titulo={`Intensidad (Tr ${tr}a, D = Tc)`} valor={fmt(result.intensidad, 1)} unidad="mm/h" sub="de la curva IDF" />
          <Resultado
            titulo="Caudal de diseño Q"
            valor={fmt(result.q, 3)}
            unidad="m³/s"
            sub={<Formula><V>Q</V>&nbsp;=&nbsp;<Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} /></Formula>}
            destacado
          />
        </div>
      )}

      {result?.warnings.map((w) => (
        <div key={w} className="mt-3 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}

      <div className="mt-4 space-y-1 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-card-foreground">Método y referencias</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>·</span>
          <Formula className="text-sm text-card-foreground">
            <V>Q</V>&nbsp;=&nbsp;<Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} />
          </Formula>
          <span>— Método Racional (Q en m³/s, C adimensional, I en mm/h, A en hectáreas).</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>·</span>
          <Formula className="text-sm text-card-foreground">
            <V>T</V><Sub>c</Sub>&nbsp;=&nbsp;0,0195 · <V>L</V><Sup>0,77</Sup> · <V>S</V><Sup>−0,385</Sup>
          </Formula>
          <span>— Tiempo de concentración de Kirpich (L en m, S en m/m, Tc en min).</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>·</span>
          <Formula className="text-sm text-card-foreground">
            <V>I</V>&nbsp;=&nbsp;<Frac num={<><V>K</V> · <V>T</V><Sup><V>m</V></Sup></>} den={<><V>D</V><Sup><V>n</V></Sup></>} />
          </Formula>
          <span>— curva IDF ajustada de esta estación (D = Tc).</span>
        </p>
        <p>· Validez del método racional: áreas pequeñas — RAS 0330/2017 (urbano, A &lt; 80 ha) y Manual de Drenaje INVÍAS (A ≤ 2.5 km²). C debe escogerse según la cobertura real del área aportante.</p>
        <p className="text-accent">· Resultado orientativo de pre-dimensionamiento; para diseño definitivo valida con la normativa y un especialista.</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      {children}
    </label>
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
