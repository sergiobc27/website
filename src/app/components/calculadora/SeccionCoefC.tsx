import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmt } from '../../lib/format';
import { TIPOS_SUPERFICIE, factorFrecuencia } from '../../lib/hydro/runoff';
import { Field, NumberInput, Select } from './SeccionColapsable';
import { TablaNormaView } from './TablaNormaView';
import { TABLA_C_URBANA, TABLA_C_RURAL, TABLA_CF } from '../../lib/hydro/tablasNorma';

export function SeccionCoefC({
  superficieIdx,
  setSuperficieIdx,
  cBase,
  setCBase,
  tr,
  cAjust,
}: {
  superficieIdx: number;
  setSuperficieIdx: (i: string) => void;
  cBase: string;
  setCBase: (v: string) => void;
  tr: number;
  cAjust: number;
}) {
  const sup = TIPOS_SUPERFICIE[superficieIdx];
  const cf = factorFrecuencia(tr);
  const cb = parseFloat(cBase);
  const [lo, hi] = sup.rango.split('–').map((s) => parseFloat(s.replace(',', '.')));
  const fueraDeRango = Number.isFinite(cb) && Number.isFinite(lo) && Number.isFinite(hi) && (cb < lo || cb > hi);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tipo de superficie">
          <Select
            value={superficieIdx}
            onChange={setSuperficieIdx}
            options={TIPOS_SUPERFICIE.map((t, i) => ({ value: i, label: `${t.label} (${t.rango})` }))}
          />
        </Field>
        <Field
          label={`Coef. C base (rango ${sup.rango})`}
          help="Coeficiente de escorrentía: fracción de la lluvia que escurre. Elígelo dentro del rango típico de la superficie; a mayor pendiente o impermeabilidad, valor más alto."
        >
          <NumberInput value={cBase} onChange={setCBase} min="0" max="1" step="0.05" />
        </Field>
      </div>

      {fueraDeRango && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
          <span>El C base ({fmt(cb, 2)}) está fuera del rango típico de «{sup.label}» ({sup.rango}); verifica que corresponda a la cobertura real.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Celda titulo="C base" valor={fmt(parseFloat(cBase), 2)} />
        <Celda titulo={`Cf (Tr ${tr}a)`} valor={fmt(cf, 2)} />
        <Celda titulo="C de diseño" valor={fmt(cAjust, 2)} destacado />
      </div>

      <DetalleTablas />

      <p className="text-xs text-muted-foreground">
        C de diseño = mín(1; C base · Cf). El C base sale de la tabla de coeficiente de escorrentía del Manual de
        Drenaje INVÍAS (2009), Tablas 2.9 (urbano) y 2.10 (rural). El factor de frecuencia Cf eleva C para Tr altos
        (Chow, Maidment &amp; Mays, 1988). Ajusta C base dentro de su rango según la pendiente (a mayor pendiente, más alto).
      </p>
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
