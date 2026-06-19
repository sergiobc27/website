import { useId, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const TEXTO =
  'Herramienta para fines académicos e investigativos. Los datos provienen de IDEAM y Datos Abiertos Colombia; el usuario conserva la responsabilidad sobre su uso posterior.';

function Texto() {
  return (
    <span className="min-w-0 text-sm">
      <span className="block font-semibold text-card-foreground">Aviso legal</span>
      <span className="mt-1 block text-muted-foreground">{TEXTO}</span>
    </span>
  );
}

/**
 * Consentimiento "slide-to-accept" accesible. Misma firma que la antigua ConsentBar
 * ({accepted, onChange}) para no tocar el estado ni la persistencia (acceptedTerms).
 * Accesibilidad: el control es un <input type="range"> nativo (hereda foco, teclado,
 * flechas, Home/End). Con prefers-reduced-motion degrada a un checkbox seco.
 */
export function SlideToAccept({ accepted, onChange }: { accepted: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  const [val, setVal] = useState(accepted ? 100 : 0);
  const reduce = useRef(
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Fallback reduced-motion: checkbox seco (sin desplazamiento ni animación).
  if (reduce.current) {
    return (
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
          accepted ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'
        }`}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        <Texto />
      </label>
    );
  }

  const commit = (v: number) => {
    if (v >= 95) {
      setVal(100);
      onChange(true);
    } else {
      setVal(0);
      onChange(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        accepted ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'
      }`}
    >
      <Texto />
      <div className="relative mt-3 h-12 select-none overflow-hidden rounded-full border border-border bg-background">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-success/25 transition-[width] duration-150"
          style={{ width: `${val}%` }}
          aria-hidden="true"
        />
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={val}
          disabled={accepted}
          aria-label={accepted ? 'Aviso legal aceptado' : 'Desliza para aceptar el aviso legal'}
          aria-valuetext={accepted ? 'Aceptado' : `${val}% — desliza hasta el final para aceptar`}
          onChange={(e) => setVal(Number(e.target.value))}
          onMouseUp={() => commit(val)}
          onTouchEnd={() => commit(val)}
          onKeyUp={() => commit(val)}
          className="absolute inset-0 z-10 h-full w-full cursor-grab opacity-0 disabled:cursor-default"
        />
        <span
          className="pointer-events-none absolute top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-white shadow transition-[left] duration-150"
          style={{ left: `calc(${val}% * 0.78 + 0.375rem)`, background: accepted ? 'var(--success)' : 'var(--primary)' }}
          aria-hidden="true"
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-muted-foreground">
          {accepted ? '✓ Aviso legal aceptado' : 'Desliza para aceptar →'}
        </span>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {accepted ? 'Aviso legal aceptado' : ''}
      </p>
    </div>
  );
}

export default SlideToAccept;
