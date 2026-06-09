import { fmt } from '../../lib/format';
import { TIPOS_SUPERFICIE, factorFrecuencia } from '../../lib/hydro/runoff';
import { Field, NumberInput, Select } from './SeccionColapsable';

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
        <Field label={`Coef. C base (rango ${sup.rango})`}>
          <NumberInput value={cBase} onChange={setCBase} min="0" step="0.05" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Celda titulo="C base" valor={fmt(parseFloat(cBase), 2)} />
        <Celda titulo={`Cf (Tr ${tr}a)`} valor={fmt(cf, 2)} />
        <Celda titulo="C de diseño" valor={fmt(cAjust, 2)} destacado />
      </div>

      <p className="text-xs text-muted-foreground">
        C de diseño = mín(1; C base · Cf). El factor de frecuencia Cf (Ven Te Chow; adoptado por INVÍAS) eleva C para
        Tr altos. Ajusta C base dentro de su rango según la pendiente del terreno (a mayor pendiente, valor más alto).
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
