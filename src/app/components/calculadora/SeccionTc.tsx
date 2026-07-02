import { Info } from 'lucide-react';
import { Formula, Frac, Sub, Sup, V } from '../Formula';
import { VariablesLista } from '../VariablesLista';
import { variablesDe } from '../../lib/metodologia/contenido';
import { fmt } from '../../lib/format';
import type { MetodoTc, Recorrido, TiemposTc } from '../../lib/hydro/tc';
import { Field, Select } from './SeccionColapsable';

const METODOS: Array<{ key: MetodoTc; label: string; nota: string }> = [
  { key: 'kirpich', label: 'Kirpich (1940)', nota: 'rural, cauce definido' },
  { key: 'temez', label: 'Témez (1978)', nota: 'L en km' },
  { key: 'giandotti', label: 'Giandotti', nota: 'usa el área y la pendiente' },
];

// Superficie del recorrido para el Kirpich modificado (factor de ajuste).
const RECORRIDOS: Array<{ key: Recorrido; label: string }> = [
  { key: 'rural', label: 'Natural / rural (×1,0)' },
  { key: 'urbano', label: 'Urbano pavimentado, asfalto o concreto (×0,4)' },
  { key: 'canal', label: 'Canal revestido en concreto (×0,2)' },
];

export function SeccionTc({
  tcs,
  metodo,
  setMetodo,
  tcUsado,
  recorrido,
  setRecorrido,
  avisoKirpich,
  avisoGiandotti,
}: {
  tcs: TiemposTc;
  metodo: MetodoTc | 'recomendado';
  setMetodo: (m: string) => void;
  tcUsado: number | null;
  recorrido: Recorrido;
  setRecorrido: (r: string) => void;
  avisoKirpich: boolean;
  avisoGiandotti: boolean;
}) {
  const valores = [tcs.kirpich, tcs.temez, tcs.giandotti].filter((v): v is number => v != null);
  const min = valores.length ? Math.min(...valores) : null;
  const max = valores.length ? Math.max(...valores) : null;

  return (
    <div className="space-y-3">
      <Field label="Tipo de recorrido del flujo (ajusta el Tc de Kirpich)">
        <Select
          value={recorrido}
          onChange={setRecorrido}
          options={RECORRIDOS.map((r) => ({ value: r.key, label: r.label }))}
        />
      </Field>
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
              const esKirpichMod = key === 'kirpich' && tcs.kirpichModificado;
              const dispLabel = esKirpichMod ? 'Kirpich modificado' : label;
              const dispNota = esKirpichMod ? `${nota} · ×${fmt(tcs.factorRecorrido, 1)}` : nota;
              return (
                <tr key={key} className={`border-t border-border ${esRecomendado ? 'bg-accent/10' : ''}`}>
                  <td className="px-3 py-2 text-card-foreground">
                    {dispLabel} <span className="text-xs text-muted-foreground">· {dispNota}</span>
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
                Recomendado (mediana de los métodos, criterio del autor{tcs.pisoAplicado ? `, piso ${fmt(tcs.piso, 0)} min` : ''})
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-accent">{fmt(tcs.recomendado, 1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        La mediana de los métodos válidos es un criterio de ingeniería del autor, no un mandato de norma: evita
        depender de un solo método y amortigua el que se dispare. El Manual INVÍAS recomienda Kirpich; puedes
        elegirlo (o cualquier otro método) en el selector de abajo.
      </p>

      <Field label="Tc usado en el cálculo de Q">
        <Select
          value={metodo}
          onChange={setMetodo}
          options={[
            { value: 'recomendado', label: `Recomendado (${fmt(tcs.recomendado, 1)} min)` },
            { value: 'kirpich', label: `Kirpich${tcs.kirpichModificado ? ' mod.' : ''} (${fmt(tcs.kirpich, 1)} min)` },
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
          <span>
            {tcs.piso === 15
              ? 'La mediana cae por debajo de 15 min; como la obra elegida es vial, se aplica el piso de diseño de 15 min (mínimo del Manual de Drenaje INVÍAS 2009) para evitar intensidades irreales.'
              : 'La mediana cae por debajo de 10 min; se aplica el piso de diseño de 10 min (extremo del rango de 3 a 10 min del RAS 0330, Art. 135, num. 4) para evitar intensidades irreales.'}
          </span>
        </div>
      )}
      {avisoKirpich && !tcs.kirpichModificado && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>La superficie elegida es pavimentada: Kirpich (rural) subestima el Tc en cuencas urbanizadas (Vélez y Botero, 2011). Elige arriba un recorrido urbano para aplicar el Kirpich modificado, con los factores de ajuste de Chow, Maidment y Mays (1988, Tabla 15.1.2).</span>
        </div>
      )}
      {avisoGiandotti && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Giandotti domina la mediana y la cuenca es muy pequeña: esa fórmula se calibró en cuencas grandes y tiende a sobreestimar el Tc en áreas pequeñas. Compara con Kirpich (el método que recomienda el Manual INVÍAS) antes de aceptar el valor recomendado.</span>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <Formula className="text-sm text-card-foreground">
          <V>T</V><Sub>c</Sub>&nbsp;(Témez)&nbsp;=&nbsp;0,3 · (<Frac num={<><V>L</V><Sub>km</Sub></>} den={<><V>S</V><Sup>0,25</Sup></>} />)<Sup>0,76</Sup>
        </Formula>
        <VariablesLista variables={variablesDe('tiempo-concentracion')} className="mt-2" />
      </div>
    </div>
  );
}
