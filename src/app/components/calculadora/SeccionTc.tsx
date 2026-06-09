import { Info } from 'lucide-react';
import { Formula, Sub, Sup, V } from '../Formula';
import { fmt } from '../../lib/format';
import type { MetodoTc, TiemposTc } from '../../lib/hydro/tc';
import { Field, Select } from './SeccionColapsable';

const METODOS: Array<{ key: MetodoTc; label: string; nota: string }> = [
  { key: 'kirpich', label: 'Kirpich (1940)', nota: 'rural, cauce definido' },
  { key: 'temez', label: 'Témez (1978)', nota: 'L en km' },
  { key: 'giandotti', label: 'Giandotti', nota: 'usa el área' },
];

export function SeccionTc({
  tcs,
  metodo,
  setMetodo,
  tcUsado,
  avisoKirpich,
}: {
  tcs: TiemposTc;
  metodo: MetodoTc | 'recomendado';
  setMetodo: (m: string) => void;
  tcUsado: number | null;
  avisoKirpich: boolean;
}) {
  const valores = [tcs.kirpich, tcs.temez, tcs.giandotti].filter((v): v is number => v != null);
  const min = valores.length ? Math.min(...valores) : null;
  const max = valores.length ? Math.max(...valores) : null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Método</th>
              <th className="px-3 py-2 text-right font-semibold">Tc (min)</th>
            </tr>
          </thead>
          <tbody>
            {METODOS.map(({ key, label, nota }) => {
              const v = tcs[key];
              const esRecomendado = tcs.metodoRecomendado === key;
              return (
                <tr key={key} className={`border-t border-border ${esRecomendado ? 'bg-accent/10' : ''}`}>
                  <td className="px-3 py-2 text-card-foreground">
                    {label} <span className="text-xs text-muted-foreground">· {nota}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-card-foreground">{fmt(v, 1)}</td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-background">
              <td className="px-3 py-2 text-xs text-muted-foreground">Rango (mín–máx)</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                {fmt(min, 1)} – {fmt(max, 1)}
              </td>
            </tr>
            <tr className="border-t border-border bg-accent/10">
              <td className="px-3 py-2 text-sm font-semibold text-accent">
                Recomendado (mediana{tcs.pisoAplicado ? ', piso 10 min' : ''})
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-accent">{fmt(tcs.recomendado, 1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Field label="Tc usado en el cálculo de Q">
        <Select
          value={metodo}
          onChange={setMetodo}
          options={[
            { value: 'recomendado', label: `Recomendado (${fmt(tcs.recomendado, 1)} min)` },
            { value: 'kirpich', label: `Kirpich (${fmt(tcs.kirpich, 1)} min)` },
            { value: 'temez', label: `Témez (${fmt(tcs.temez, 1)} min)` },
            { value: 'giandotti', label: `Giandotti (${fmt(tcs.giandotti, 1)} min)` },
          ]}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Tc usado: <span className="font-mono text-card-foreground">{fmt(tcUsado, 1)} min</span> · la intensidad se lee de la IDF en D = Tc.
      </p>

      {tcs.pisoAplicado && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>La mediana cae por debajo de 10 min; se aplica el piso de diseño de 10 min (RAS 0330) para evitar intensidades irreales.</span>
        </div>
      )}
      {avisoKirpich && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Kirpich subestima Tc en cuencas urbanas pavimentadas (Vélez &amp; Botero, 2011); considera Témez o Giandotti como referencia.</span>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <Formula className="text-sm text-card-foreground">
          <V>T</V><Sub>c</Sub>&nbsp;(Témez)&nbsp;=&nbsp;0,3 · (<V>L</V><Sub>km</Sub> / <V>S</V><Sup>0,25</Sup>)<Sup>0,76</Sup>
        </Formula>
      </div>
    </div>
  );
}
