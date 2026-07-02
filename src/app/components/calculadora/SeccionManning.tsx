import { useEffect, useMemo, useState } from 'react';
import { Formula, Frac, Sup, V } from '../Formula';
import { VariablesLista } from '../VariablesLista';
import { variablesDe } from '../../lib/metodologia/contenido';
import { fmt } from '../../lib/format';
import {
  MATERIALES,
  TAU_MIN_AUTOLIMPIEZA,
  capacidadCircular,
  profundidadNormalCircular,
  profundidadNormalTrapecio,
  esfuerzoCortante,
  chequeoCortante,
  chequeoVelocidadMax,
  chequeoSuficiencia,
  chequeoLlenado,
} from '../../lib/hydro/manning';
import { Field, NumberInput, Select, Chequeo } from './SeccionColapsable';

type Seccion = 'circular' | 'trapezoidal';

export function SeccionManning({ q, pendienteCuenca }: { q: number; pendienteCuenca: string }) {
  const [seccion, setSeccion] = useState<Seccion>('circular');
  const [diametro, setDiametro] = useState('0.5'); // m
  const [base, setBase] = useState('1'); // m (canal)
  const [talud, setTalud] = useState('1'); // z (H:V); 0 = rectangular
  const [materialIdx, setMaterialIdx] = useState(0);
  const [nMann, setNMann] = useState(String(MATERIALES[0].n));
  const [vMax, setVMax] = useState(String(MATERIALES[0].vMax));
  const [tauMin, setTauMin] = useState(String(TAU_MIN_AUTOLIMPIEZA));
  const [sCond, setSCond] = useState(pendienteCuenca); // %, por defecto la de la cuenca
  const [sCondTocado, setSCondTocado] = useState(false);

  // Mientras el usuario no edite manualmente la pendiente del conducto, la mantiene
  // sincronizada con la pendiente de la cuenca (evita que queden inconsistentes).
  useEffect(() => {
    if (!sCondTocado) setSCond(pendienteCuenca);
  }, [pendienteCuenca, sCondTocado]);

  const onMaterial = (i: string) => {
    const idx = Number(i);
    setMaterialIdx(idx);
    setNMann(String(MATERIALES[idx].n));
    setVMax(String(MATERIALES[idx].vMax));
  };

  const res = useMemo(() => {
    const n = parseFloat(nMann);
    const s = parseFloat(sCond) / 100; // % → m/m
    const tmin = parseFloat(tauMin);
    const vmax = parseFloat(vMax);
    if (!(q > 0) || !(n > 0) || !(s > 0)) return null;

    if (seccion === 'circular') {
      const D = parseFloat(diametro);
      if (!(D > 0)) return null;
      const cap = capacidadCircular(D, n, s);
      const sol = profundidadNormalCircular(q, D, n, s);
      const tau = esfuerzoCortante(sol.r, s);
      return {
        tipo: 'circular' as const,
        cap,
        sol,
        tau,
        chequeos: [
          chequeoSuficiencia(q, cap.q),
          chequeoLlenado(sol.llenado),
          chequeoCortante(tau, tmin),
          chequeoVelocidadMax(sol.v, vmax),
        ],
      };
    }
    const b = parseFloat(base);
    const z = parseFloat(talud);
    if (!(b > 0) || !(z >= 0)) return null;
    const sol = profundidadNormalTrapecio(q, b, z, n, s);
    const tau = esfuerzoCortante(sol.r, s);
    const chequeos = sol.excedeCapacidad
      ? [{ estado: 'rojo' as const, motivo: 'La sección no transporta el Q de diseño: aumenta el ancho de base o el talud.' }]
      : [chequeoCortante(tau, tmin, 'canal'), chequeoVelocidadMax(sol.v, vmax)];
    return { tipo: 'trapezoidal' as const, sol, tau, chequeos };
  }, [q, seccion, diametro, base, talud, nMann, sCond, tauMin, vMax]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Verifica un conducto que transporte el caudal de diseño <span className="font-mono text-card-foreground">Q = {fmt(q, 3)} m³/s</span> por la ecuación de Manning.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Sección">
          <Select
            value={seccion}
            onChange={(v) => setSeccion(v as Seccion)}
            options={[
              { value: 'circular', label: 'Tubería circular' },
              { value: 'trapezoidal', label: 'Canal rect./trapezoidal' },
            ]}
          />
        </Field>
        {seccion === 'circular' ? (
          <Field label="Diámetro D (m)">
            <NumberInput value={diametro} onChange={setDiametro} step="0.05" />
          </Field>
        ) : (
          <>
            <Field label="Ancho de base b (m)">
              <NumberInput value={base} onChange={setBase} step="0.1" />
            </Field>
            <Field label="Talud z (H:V; 0 = rect.)" help="Inclinación de las paredes del canal: z metros en horizontal por cada metro en vertical (H:V). z = 0 es un canal rectangular; z = 1 es 45°.">
              <NumberInput value={talud} onChange={setTalud} step="0.25" />
            </Field>
          </>
        )}
        <Field label="Material">
          <Select value={materialIdx} onChange={onMaterial} options={MATERIALES.map((m, i) => ({ value: i, label: m.label }))} />
        </Field>
        <Field label="n de Manning" help="Coeficiente de rugosidad de Manning: cuanto más liso el conducto, menor n y mayor velocidad. Se prefija según el material; ajústalo con la fuente que uses.">
          <NumberInput value={nMann} onChange={setNMann} min="0.001" step="0.001" />
        </Field>
        <Field label="Pendiente del conducto (%)" help="Pendiente longitudinal del conducto. Por defecto sigue la pendiente de la cuenca; al editarla queda fija e independiente.">
          <NumberInput value={sCond} onChange={(v) => { setSCond(v); setSCondTocado(true); }} step="0.1" />
        </Field>
        <Field
          label="Esfuerzo cortante mín. τ (Pa)"
          help={seccion === 'circular'
            ? 'Criterio de autolimpieza del RAS 0330 (2017), Art. 149: la velocidad mínima en alcantarillado pluvial es la que genera un esfuerzo cortante de pared ≥ 2,0 Pa. τ = γ·R·S.'
            : 'El umbral de autolimpieza de 2,0 Pa (RAS 0330, Art. 149) está definido para tubería de alcantarillado; en el canal se aplica como criterio extendido del autor. Si tienes un τ admisible del material del canal, ponlo aquí. τ = γ·R·S.'}
        >
          <NumberInput value={tauMin} onChange={setTauMin} step="0.5" />
        </Field>
        <Field label="Vel. máx. material (m/s)" help="Velocidad máxima para no erosionar el material. RAS 0330 (2017), Art. 150: 5,0 m/s (hasta 10 m/s con revestimiento especial).">
          <NumberInput value={vMax} onChange={setVMax} step="0.5" />
        </Field>
      </div>

      {res && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {res.tipo === 'circular' && (
              <>
                <Resultado titulo="Capacidad a tubo lleno" valor={fmt(res.cap.q, 3)} unidad="m³/s" />
                <Resultado titulo="Relación de llenado y/D" valor={fmt(res.sol.llenado * 100, 0)} unidad="%" />
                <Resultado titulo="Velocidad (a Q diseño)" valor={fmt(res.sol.v, 2)} unidad="m/s" />
                <Resultado titulo="Esfuerzo cortante τ" valor={fmt(res.tau, 2)} unidad="Pa" />
              </>
            )}
            {res.tipo === 'trapezoidal' && (
              <>
                <Resultado titulo="Profundidad normal y" valor={fmt(res.sol.y, 3)} unidad="m" />
                <Resultado titulo="Velocidad (a Q diseño)" valor={fmt(res.sol.v, 2)} unidad="m/s" />
                <Resultado titulo="Esfuerzo cortante τ" valor={fmt(res.tau, 2)} unidad="Pa" />
              </>
            )}
          </div>
          <div className="space-y-2">
            {res.chequeos.map((c, i) => (
              <Chequeo key={i} estado={c.estado} motivo={c.motivo} />
            ))}
          </div>
        </>
      )}

      <Formula className="text-sm text-card-foreground">
        <V>Q</V>&nbsp;=&nbsp;<Frac num={<>1</>} den={<V>n</V>} /> · <V>A</V> · <V>R</V><Sup>2/3</Sup> · <V>S</V><Sup>1/2</Sup>
      </Formula>
      <VariablesLista variables={variablesDe('manning')} className="mt-1" />
      <p className="text-xs text-muted-foreground">
        Manning (1891) · R = A/P (radio hidráulico). Autolimpieza por esfuerzo cortante τ = γ·R·S ≥ 2,0 Pa
        {seccion === 'circular'
          ? ' (RAS 0330, Art. 149)'
          : ' (umbral de tubería del RAS 0330, Art. 149, extendido a canales como criterio del autor)'}
        ; velocidad máxima 5,0 m/s (Art. 150); llenado máximo y/D = 93% (Art. 151, tubería). Valores
        de n, τ mínimo y velocidad máxima editables; confírmalos con la norma vigente.
      </p>
    </div>
  );
}

function Resultado({ titulo, valor, unidad }: { titulo: string; valor: string; unidad: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="font-mono text-xl font-bold text-card-foreground">
        {valor} <span className="text-sm font-normal">{unidad}</span>
      </p>
    </div>
  );
}
