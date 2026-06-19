import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Search } from 'lucide-react';

function norm(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface FacetOption {
  value: string;
  label?: string;
  total?: number;
}

export type FacetStatus = 'idle' | 'loading' | 'warming' | 'ready' | 'error';

/**
 * Selector facetado: un disparador compacto que abre un popover buscable con
 * checkboxes (en vez de una nube de chips "regados"). Popover propio (sin
 * dependencia nueva): cierra con click-afuera y Escape, enfoca la búsqueda al
 * abrir. NO administra estado de selección: lo refleja vía props/callbacks, así
 * que no cambia la forma del estado del extractor (deep-links/Compartir intactos).
 */
export function FacetCombobox({
  label,
  options,
  selected,
  onToggle,
  onAll,
  onNone,
  status = 'ready',
  statusMessage,
  disabled = false,
  single = false,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onAll?: () => void;
  onNone?: () => void;
  status?: FacetStatus;
  statusMessage?: string;
  disabled?: boolean;
  /**
   * Modo selección única: oculta "Todos/Ninguno", usa círculo (radio) en vez de
   * checkbox, cierra el popover al elegir y muestra el nombre elegido en el
   * disparador. La forma del estado sigue siendo string[] (con 0 o 1 elemento),
   * así que el padre no cambia su modelo de datos.
   */
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  // Limpia la búsqueda al cerrar el popover. Sin esto, el texto previo persistía y
  // al reabrir la lista quedaba filtrada a un solo resultado (en modo `single`,
  // elegir cierra el popover → reabrir mostraba solo lo ya elegido y parecía "atascado").
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const filtered = options.filter((o) => norm(`${o.label || o.value} ${o.total ?? ''}`).includes(norm(q)));
  const count = selected.length;
  const busy = status === 'loading' || status === 'warming';
  const selectedLabel = single && count ? options.find((o) => o.value === selected[0])?.label || selected[0] : null;
  const triggerLabel = single ? (selectedLabel ? `${label}: ${selectedLabel}` : label) : count > 0 ? `${label} · ${count}` : label;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
          count > 0
            ? 'border-accent/50 bg-accent/10 text-accent'
            : 'border-border bg-background text-card-foreground hover:border-accent/40'
        }`}
      >
        <span className="max-w-[12rem] truncate">{triggerLabel}</span>
        {busy ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable={!single}
          // Ancho que se ajusta a la opción más larga (w-max), con mínimo cómodo y
          // tope para no desbordar en pantallas chicas. Antes era `w-72` fijo y los
          // nombres largos (p. ej. departamentos) se cortaban horizontalmente.
          className="absolute z-30 mt-2 w-max min-w-[16rem] max-w-[min(92vw,34rem)] rounded-xl border border-border bg-card p-2 shadow-glow"
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar ${label.toLowerCase()}`}
              className="w-full rounded-lg border border-border bg-input py-1.5 pl-8 pr-2 text-sm text-card-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          {!single && (onAll || onNone) && (
            <div className="mb-2 flex gap-2">
              {onAll && (
                <button
                  type="button"
                  onClick={onAll}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-card-foreground transition-colors hover:border-accent/40"
                >
                  Todos
                </button>
              )}
              {onNone && (
                <button
                  type="button"
                  onClick={onNone}
                  disabled={!count}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent/40 disabled:opacity-50"
                >
                  Ninguno
                </button>
              )}
            </div>
          )}
          <div className="max-h-60 overflow-y-auto pr-1">
            {status === 'error' ? (
              <p className="px-1 py-2 text-sm text-destructive">{statusMessage || 'No fue posible cargar este catálogo.'}</p>
            ) : status === 'idle' ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">{statusMessage || 'Aún no disponible.'}</p>
            ) : !filtered.length ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">{busy ? 'Cargando…' : 'Sin opciones.'}</p>
            ) : (
              filtered.map((o) => {
                const sel = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => {
                      onToggle(o.value);
                      if (single) setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                      sel ? 'text-accent' : 'text-card-foreground'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center border ${single ? 'rounded-full' : 'rounded'} ${
                        sel ? 'border-accent bg-accent text-white' : 'border-border'
                      }`}
                    >
                      {sel && (single ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Check className="h-3 w-3" />)}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{o.label || o.value}</span>
                    {o.total != null && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{o.total.toLocaleString('es-CO')}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FacetCombobox;
