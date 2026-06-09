import { useMemo, useState } from 'react';
import { Formula, Sup, V } from '../Formula';
import { fmt } from '../../lib/format';
import {
  MATERIALES,
  V_MIN_AUTOLIMPIEZA,
  capacidadCircular,
  profundidadNormalCircular,
  profundidadNormalTrapecio,
  chequeoVelocidad,
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
  const [vMin, setVMin] = useState(String(V_MIN_AUTOLIMPIEZA));
  const [sCond, setSCond] = useState(pendienteCuenca); // %, por defecto la de la cuenca

  const onMaterial = (i: string) => {
    const idx = Number(i);
    setMaterialIdx(idx);
    setNMann(String(MATERIALES[idx].n));
    setVMax(String(MATERIALES[idx].vMax));
  };

  const res = useMemo(() => {
    const n = parseFloat(nMann);
    const s = parseFloat(sCond) / 100;
    const vmin = parseFloat(vMin);
    const vmax = parseFloat(vMax);
    if (!(q > 0) || !(n > 0) || !(s > 0)) return null;

    if (seccion === 'circular') {
      const D = parseFloat(diametro);
      if (!(D > 0)) return null;
      const cap = capacidadCircular(D, n, s);
      const sol = profundidadNormalCircular(q, D, n, s);
      return {
        tipo: 'circular' as const,
        cap,
        sol,
        chequeos: [
          chequeoSuficiencia(q, cap.q),
          chequeoLlenado(sol.llenado),
          chequeoVelocidad(sol.v, vmin, vmax),
        ],
      };
    }
    const b = parseFloat(base);
    const z = parseFloat(talud);
    if (!(b > 0) || !(z >= 0)) return null;
    const sol = profundidadNormalTrapecio(q, b, z, n, s);
    return {
      tipo: 'trapezoidal' as const,
      sol,
      chequeos: [chequeoVelocidad(sol.v, vmin, vmax)],
    };
  }, [q, seccion, diametro, base, talud, nMann, sCond, vMin, vMax]);

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
            <Field label="Talud z (H:V; 0 = rect.)">
              <NumberInput value={talud} onChange={setTalud} step="0.25" />
            </Field>
          </>
        )}
        <Field label="Material">
          <Select value={materialIdx} onChange={onMaterial} options={MATERIALES.map((m, i) => ({ value: i, label: m.label }))} />
        </Field>
        <Field label="n de Manning">
          <NumberInput value={nMann} onChange={setNMann} step="0.001" />
        </Field>
        <Field label="Pendiente del conducto (%)">
          <NumberInput value={sCond} onChange={setSCond} step="0.1" />
        </Field>
        <Field label="Vel. mín. autolimpieza (m/s)">
          <NumberInput value={vMin} onChange={setVMin} step="0.05" />
        </Field>
        <Field label="Vel. máx. material (m/s)">
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
              </>
            )}
            {res.tipo === 'trapezoidal' && (
              <>
                <Resultado titulo="Profundidad normal y" valor={fmt(res.sol.y, 3)} unidad="m" />
                <Resultado titulo="Velocidad (a Q diseño)" valor={fmt(res.sol.v, 2)} unidad="m/s" />
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
        <V>Q</V>&nbsp;=&nbsp;(1/<V>n</V>) · <V>A</V> · <V>R</V><Sup>2/3</Sup> · <V>S</V><Sup>1/2</Sup>
      </Formula>
      <p className="text-xs text-muted-foreground">
        Manning (1891) · R = A/P (radio hidráulico). Velocidad mínima de autolimpieza y máxima por material según RAS 0330
        (2017); valores de n y velocidad máxima editables — confírmalos con la norma vigente.
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
