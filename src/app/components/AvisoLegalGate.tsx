import { CheckCircle2, ShieldAlert } from 'lucide-react';

const TEXTO =
  'Herramienta para fines académicos e investigativos. Los datos provienen de IDEAM y Datos Abiertos Colombia; el usuario conserva la responsabilidad sobre su uso posterior.';

/**
 * Puerta de consentimiento del Extractor: es lo PRIMERO que se ve y bloquea la
 * configuración hasta aceptar. Sin aceptar muestra el aviso + un botón ROJO; al
 * aceptar pasa a una confirmación VERDE y el padre desbloquea los filtros.
 * Misma firma mínima ({accepted, onAccept}) para no enredar el estado del padre.
 */
export function AvisoLegalGate({ accepted, onAccept }: { accepted: boolean; onAccept: () => void }) {
  if (accepted) {
    return (
      <div className="animate-fade-in-up flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 px-5 py-3 shadow-glow">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <span className="text-sm font-semibold text-success">Aviso legal aceptado</span>
        <span className="text-sm text-muted-foreground">Ya puedes configurar y descargar.</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-4 rounded-2xl border border-warning/40 bg-warning/5 p-6 shadow-glow">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-6 w-6 shrink-0 text-warning" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-card-foreground">Aviso legal</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{TEXTO}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAccept}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow transition-[background-color,transform] duration-200 hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto"
      >
        Acepto el aviso legal y continúo
      </button>
      <p className="text-xs text-muted-foreground">Debes aceptar para habilitar la configuración y la descarga.</p>
    </div>
  );
}

export default AvisoLegalGate;
