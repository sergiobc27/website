import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmt } from '../../lib/format';
import { factorFrecuencia } from '../../lib/hydro/runoff';
import { Field, NumberInput, Select } from './SeccionColapsable';
import { TablaNormaView } from './TablaNormaView';
import { TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF } from '../../lib/hydro/tablasNorma';
import { VariablesLista } from '../VariablesLista';
import { variablesDe } from '../../lib/metodologia/contenido';

export type Contexto = 'urbana' | 'rural';

// Coma decimal → número; y "0,70 – 0,95" → {lo, hi, mid}. Se derivan de las tablas
// de la norma (única fuente: tablasNorma), así el selector = filas literales de 2.9/2.10.
const parseNum = (s: string | number) => parseFloat(String(s).replace(',', '.'));
const parseRango = (s: string | number) => {
  const [a, b] = String(s).split(/[–—-]/).map((x) => parseNum(x));
  return { lo: a, hi: b, mid: (a + b) / 2 };
};

const URBANA = TABLA_C_URBANA.filas.map((f) => ({ label: String(f[0]), ...parseRango(f[1]) }));
const RURAL_VEG = TABLA_C_RURAL.filas.map((f) => ({
  label: String(f[0]),
  valores: [parseNum(f[1]), parseNum(f[2]), parseNum(f[3])],
}));
const RURAL_SUELOS = TABLA_C_RURAL.columnas.slice(1); // Franco arenoso / limo arcilloso / arcilloso

const URB_DEFAULT = 5; // 'Distritos comerciales — áreas de centro de ciudad'
const VEG_DEFAULT = 6; // 'Tierras cultivadas — plano'

export function SeccionCoefC({
  contexto,
  setContexto,
  cBase,
  setCBase,
  tr,
  cAjust,
}: {
  contexto: Contexto;
  setContexto: (c: Contexto) => void;
  cBase: string;
  setCBase: (v: string) => void;
  tr: number;
  cAjust: number;
}) {
  const [urbIdx, setUrbIdx] = useState(URB_DEFAULT);
  const [vegIdx, setVegIdx] = useState(VEG_DEFAULT);
  const [sueloIdx, setSueloIdx] = useState(1);

  const cf = factorFrecuencia(tr);
  const cb = parseNum(cBase);
  const filaUrb = URBANA[urbIdx];
  const fueraDeRango = contexto === 'urbana' && Number.isFinite(cb) && (cb < filaUrb.lo || cb > filaUrb.hi);

  const onContexto = (v: string) => {
    const c = v as Contexto;
    setContexto(c);
    setCBase(String(c === 'urbana' ? URBANA[urbIdx].mid : RURAL_VEG[vegIdx].valores[sueloIdx]));
  };
  const onUrb = (v: string) => {
    const i = Number(v);
    setUrbIdx(i);
    setCBase(String(URBANA[i].mid));
  };
  const onVeg = (v: string) => {
    const i = Number(v);
    setVegIdx(i);
    setCBase(String(RURAL_VEG[i].valores[sueloIdx]));
  };
  const onSuelo = (v: string) => {
    const i = Number(v);
    setSueloIdx(i);
    setCBase(String(RURAL_VEG[vegIdx].valores[i]));
  };

  return (
    <div className="space-y-3">
      <Field label="Contexto (tabla de la norma)">
        <Select
          value={contexto}
          onChange={onContexto}
          options={[
            { value: 'urbana', label: 'Área urbana (INVÍAS Tabla 2.9)' },
            { value: 'rural', label: 'Área rural (INVÍAS Tabla 2.10)' },
          ]}
        />
      </Field>

      {contexto === 'urbana' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de área de drenaje (Tabla 2.9)">
            <Select
              value={urbIdx}
              onChange={onUrb}
              options={URBANA.map((o, i) => ({ value: i, label: `${o.label} (${fmt(o.lo, 2)}–${fmt(o.hi, 2)})` }))}
            />
          </Field>
          <Field
            label={`Coef. C dentro del rango ${fmt(filaUrb.lo, 2)}–${fmt(filaUrb.hi, 2)}`}
            help="La norma da un rango por tipo de área; elige dentro de él según la impermeabilidad y la pendiente (a mayor, más alto)."
          >
            <NumberInput value={cBase} onChange={setCBase} min="0" max="1" step="0.01" />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Vegetación y topografía (Tabla 2.10)">
            <Select value={vegIdx} onChange={onVeg} options={RURAL_VEG.map((o, i) => ({ value: i, label: o.label }))} />
          </Field>
          <Field label="Textura del suelo">
            <Select value={sueloIdx} onChange={onSuelo} options={RURAL_SUELOS.map((s, i) => ({ value: i, label: String(s) }))} />
          </Field>
        </div>
      )}

      {fueraDeRango && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
          <span>
            El C ({fmt(cb, 2)}) está fuera del rango de «{filaUrb.label}» ({fmt(filaUrb.lo, 2)}–{fmt(filaUrb.hi, 2)}); verifica
            que corresponda a la cobertura real.
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Celda titulo="C base" valor={fmt(cb, 2)} />
        <Celda titulo={`Cf (Tr ${tr}a)`} valor={fmt(cf, 2)} />
        <Celda titulo="C de diseño" valor={fmt(cAjust, 2)} destacado />
      </div>

      <DetalleTablas />

      <p className="text-xs text-muted-foreground">
        C de diseño = mín(1; C · Cf). El C se toma directamente de las tablas del Manual de Drenaje INVÍAS (2009):
        Tabla 2.9 (áreas urbanas, pág. 2-39) o Tabla 2.10 (áreas rurales, por textura del suelo y topografía, pág. 2-40).
        El factor de frecuencia Cf eleva C para períodos de retorno altos (Chow, Maidment &amp; Mays, 1988).
      </p>
      <VariablesLista variables={variablesDe('factor-cf')} />
    </div>
  );
}

function Celda({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destacado ? 'border-accent bg-accent/10' : 'border-border bg-background'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={`font-mono text-lg font-bold ${destacado ? 'text-accent' : 'text-card-foreground'}`}>{valor}</p>
    </div>
  );
}

function DetalleTablas() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-card-foreground"
        aria-expanded={abierto}
      >
        Ver las tablas de la norma (coeficiente C y factor Cf)
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="space-y-4 border-t border-border px-3 py-3">
          <TablaNormaView tabla={TABLA_C_URBANA} />
          <TablaNormaView tabla={TABLA_C_RURAL} />
          <TablaNormaView tabla={TABLA_CF} />
        </div>
      )}
    </div>
  );
}
