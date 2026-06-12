import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Asistente } from './Asistente';

export const OPEN_ASISTENTE_EVENT = 'ideam:open-asistente';

/**
 * Botón flotante (abajo-derecha, todas las vistas) + panel del Asistente.
 * El panel queda SIEMPRE montado (oculto con `hidden`) para que la
 * conversación sobreviva al cerrar/abrir el panel y al cambiar de pestaña.
 */
export function AsistenteFlotante({ currentView }: { currentView: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener(OPEN_ASISTENTE_EVENT, abrir);
    return () => window.removeEventListener(OPEN_ASISTENTE_EVENT, abrir);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div
        role="dialog"
        aria-label="Asistente Hídrico"
        className={`glass-chrome flex fixed bottom-24 right-4 z-50 h-[min(640px,calc(100dvh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border shadow-glow transition-[opacity,transform] duration-200 ease-out ${open ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible translate-y-2 scale-[0.98] opacity-0'}`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-bold text-card-foreground">
            <MessageCircle className="h-4 w-4 text-accent" /> Asistente Hídrico
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar asistente"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-card-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-3">
          <Asistente compact view={currentView} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Cerrar Asistente Hídrico' : 'Abrir Asistente Hídrico'}
        aria-expanded={open}
        className="asistente-flotante fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-glow transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  );
}
