import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Sección plegable reutilizable para el acordeón de la calculadora. */
export function SeccionColapsable({
  titulo,
  descripcion,
  inicialAbierta = true,
  resaltada = false,
  children,
}: {
  titulo: string;
  descripcion?: string;
  inicialAbierta?: boolean;
  resaltada?: boolean;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(inicialAbierta);
  return (
    <div className={`rounded-lg border ${resaltada ? 'border-accent/60 bg-accent/5' : 'border-border bg-background'}`}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={abierta}
      >
        <span>
          <span className="block text-sm font-semibold text-card-foreground">{titulo}</span>
          {descripcion && <span className="block text-xs text-muted-foreground">{descripcion}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && <div className="border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}

/** Campo etiquetado (label vertical) reutilizado en las secciones. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground outline-none focus:border-accent';

export function NumberInput({
  value,
  onChange,
  min = '0',
  step = '0.1',
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    />
  );
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: string) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const COLOR: Record<'verde' | 'amarillo' | 'rojo', string> = {
  verde: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  amarillo: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  rojo: 'border-red-500/40 bg-red-500/10 text-red-400',
};

/** Fila de chequeo con semáforo (misma convención del Lote 3A). */
export function Chequeo({ estado, motivo }: { estado: 'verde' | 'amarillo' | 'rojo'; motivo: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${COLOR[estado]}`}>
      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current" />
      <span>{motivo}</span>
    </div>
  );
}
