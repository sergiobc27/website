import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmt } from '../../lib/format';
import { factorFrecuencia } from '../../lib/hydro/runoff';
import { Field, NumberInput } from './SeccionColapsable';
import { TablaNormaView } from './TablaNormaView';
import { TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF } from '../../lib/hydro/tablasNorma';
import { VariablesLista } from '../VariablesLista';
import { variablesDe } from '../../lib/metodologia/contenido';

export type Contexto = 'urbana' | 'rural';

const parseNum = (s: string | number) => parseFloat(String(s).replace(',', '.'));
const parseRango = (s: string | number) => {
  const [a, b] = String(s).split(/[–—-]/).map((x) => parseNum(x));
  return { lo: a, hi: b, mid: (a + b) / 2 };
};

const URB_DEFAULT = { fila: 5, col: 1 }; // 'Distritos comerciales — áreas de centro de ciudad'
const RUR_DEFAULT = { fila: 6, col: 2 }; // 'Tierras cultivadas — plano' × 'Franco limo arcilloso'

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
  // Celda resaltada de la tabla activa (fila/columna).
  const [sel, setSel] = useState<{ fila: number; col: number }>(URB_DEFAULT);

  const cf = factorFrecuencia(tr);
  const cb = parseNum(cBase);

  // Rango de la fila urbana seleccionada, para el ajuste fino dentro del rango.
  const rangoUrb = contexto === 'urbana' ? parseRango(String(TABLA_C_URBANA.filas[sel.fila][1])) : null;
  const fueraDeRango = !!rangoUrb && Number.isFinite(cb) && (cb < rangoUrb.lo || cb > rangoUrb.hi);

  const cambiarContexto = (c: Contexto) => {
    setContexto(c);
    if (c === 'urbana') {
      setSel(URB_DEFAULT);
      setCBase(String(parseRango(String(TABLA_C_URBANA.filas[URB_DEFAULT.fila][1])).mid));
    } else {
      setSel(RUR_DEFAULT);
      setCBase(String(parseNum(TABLA_C_RURAL.filas[RUR_DEFAULT.fila][RUR_DEFAULT.col])));
    }
  };

  const pickUrbana = (fila: number, _col: number, valor: string | number) => {
    setSel({ fila, col: 1 });
    setCBase(String(parseRango(valor).mid));
  };
  const pickRural = (fila: number, col: number, valor: string | number) => {
    setSel({ fila, col });
    setCBase(String(parseNum(valor)));
  };

  return (
    <div className="space-y-3">
      {/* Contexto: qué tabla de la norma aplica (urbana 2.9 / rural 2.10). */}
      <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
        {([
          ['urbana', 'Área urbana (Tabla 2.9)'],
          ['rural', 'Área rural (Tabla 2.10)'],
        ] as Array<[Contexto, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => cambiarContexto(key)}
            className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
              contexto === key ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Elige el coeficiente C haciendo clic en la fila (urbana) o en la celda por textura del suelo (rural) que
        corresponda a la cobertura del área aportante. El valor entra directo al cálculo.
      </p>

      {contexto === 'urbana' ? (
        <>
          <TablaNormaView tabla={TABLA_C_URBANA} colsValor={[1]} onCelda={pickUrbana} activa={{ fila: sel.fila, col: 1 }} />
          {rangoUrb && (
            <Field
              label={`Ajustar C dentro del rango ${fmt(rangoUrb.lo, 2)}–${fmt(rangoUrb.hi, 2)}`}
              help="La norma da un rango por tipo de área; afina C dentro de él según la impermeabilidad y la pendiente (a mayor, más alto)."
            >
              <NumberInput value={cBase} onChange={setCBase} min="0" max="1" step="0.01" />
            </Field>
          )}
          {fueraDeRango && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
              <span>El C ({fmt(cb, 2)}) quedó fuera del rango de la fila elegida; verifica que corresponda a la cobertura real.</span>
            </div>
          )}
        </>
      ) : (
        <TablaNormaView tabla={TABLA_C_RURAL} colsValor={[1, 2, 3]} onCelda={pickRural} activa={sel} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Celda titulo="C base" valor={fmt(cb, 2)} />
        <Celda titulo={`Cf (Tr ${tr}a)`} valor={fmt(cf, 2)} />
        <Celda titulo="C de diseño" valor={fmt(cAjust, 2)} destacado />
      </div>

      <DetalleCf />

      <p className="text-xs text-muted-foreground">
        C de diseño = mín(1; C · Cf). El C sale directo de las tablas del Manual de Drenaje INVÍAS (2009): Tabla 2.9
        (áreas urbanas, pág. 2-39) o Tabla 2.10 (áreas rurales, por textura del suelo y topografía, pág. 2-40). El factor
        de frecuencia Cf eleva C para períodos de retorno altos (Chow, Maidment &amp; Mays, 1988).
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

function DetalleCf() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-card-foreground"
        aria-expanded={abierto}
      >
        Ver la tabla del factor de frecuencia Cf
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="border-t border-border px-3 py-3">
          <TablaNormaView tabla={TABLA_CF} />
        </div>
      )}
    </div>
  );
}
