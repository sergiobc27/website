import {
  Calendar,
  CheckCircle2,
  Database,
  Download,
  Eye,
  Filter,
  GraduationCap,
  Info,
  MapPin,
  Scale,
  ShieldCheck,
} from 'lucide-react';

// Pasos del tutorial: reflejan el flujo real del extractor (variable → 1 depto →
// filtros opcionales → fechas → vista previa/descarga).
const PASOS = [
  { icon: Database, titulo: 'Elige la variable', detalle: 'La variable hídrica o meteorológica: precipitación, nivel, caudal, temperatura, etc.' },
  { icon: MapPin, titulo: 'Selecciona un departamento', detalle: 'Una descarga procesa un solo departamento. Búscalo en la lista o tócalo en el mapa.' },
  { icon: Filter, titulo: 'Afina (opcional)', detalle: 'Filtros avanzados: municipios, zona hidrográfica o estaciones específicas.' },
  { icon: Calendar, titulo: 'Define el periodo', detalle: 'Un rango de fechas a medida o todo el histórico disponible.' },
  { icon: Eye, titulo: 'Previsualiza', detalle: 'Genera una vista previa para revisar las primeras filas y el volumen estimado.' },
  { icon: Download, titulo: 'Descarga el ZIP', detalle: 'Obtén los datos limpios y listos para analizar. Puedes compartir la configuración por enlace.' },
];

/**
 * Puerta de consentimiento del Extractor: es lo PRIMERO que se ve y bloquea la
 * configuración hasta aceptar. Sin aceptar muestra una presentación amplia
 * (idea del proyecto + datos/licencia + tutorial de uso) y un botón ROJO; al
 * aceptar pasa a una confirmación VERDE y el padre desbloquea los filtros.
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
    <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card shadow-glow">
      {/* Encabezado */}
      <div className="flex items-start gap-4 border-b border-border bg-gradient-to-br from-accent/10 to-transparent p-6 sm:p-8">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <GraduationCap className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-card-foreground sm:text-2xl">Extractor de Datos del IDEAM</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Descarga automatizada de datos hidrometeorológicos del IDEAM, ya filtrados y listos para analizar.
            Antes de empezar, conoce de qué se trata, cómo usarlo y los términos de uso de los datos.
          </p>
        </div>
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-5">
        {/* Idea + datos/licencia */}
        <div className="space-y-6 bg-card p-6 sm:p-8 lg:col-span-2">
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-card-foreground">
              <Info className="h-4 w-4 text-accent" /> La idea
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              En lugar de navegar y descargar a mano desde los portales oficiales, aquí eliges qué necesitas
              (variable, territorio y periodo) y la herramienta arma la descarga por ti. Nace del trabajo de grado de
              Ingeniería Civil de la Universidad de la Costa (CUC) y busca facilitar el acceso a series históricas para
              estudios hidrológicos (incluidas las curvas IDF).
            </p>
          </section>
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-card-foreground">
              <Scale className="h-4 w-4 text-accent" /> Datos y uso
            </h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                <span><strong className="font-semibold text-card-foreground">Fuente:</strong> datos públicos del IDEAM, vía Datos Abiertos Colombia (datos.gov.co).</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                <span><strong className="font-semibold text-card-foreground">Fines:</strong> herramienta para uso académico e investigativo.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                <span><strong className="font-semibold text-card-foreground">Responsabilidad:</strong> el usuario conserva la responsabilidad sobre el uso e interpretación posteriores y debe citar al IDEAM como fuente.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                <span>Los datos se entregan tal cual provienen de la fuente; verifícalos antes de usarlos en decisiones.</span>
              </li>
            </ul>
          </section>
        </div>

        {/* Tutorial */}
        <div className="bg-card p-6 sm:p-8 lg:col-span-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-card-foreground">
            <ShieldCheck className="h-4 w-4 text-accent" /> Cómo usarlo, paso a paso
          </h3>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2">
            {PASOS.map((paso, i) => {
              const Icon = paso.icon;
              return (
                <li key={paso.titulo} className="flex gap-3 rounded-xl border border-border bg-background p-3">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{paso.titulo}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{paso.detalle}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Aceptación */}
      <div className="flex flex-col items-start gap-3 border-t border-border bg-warning/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <p className="text-sm text-muted-foreground">
          Debes aceptar el aviso legal para habilitar la configuración y la descarga.
        </p>
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow transition-[background-color,transform] duration-200 hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto"
        >
          <ShieldCheck className="h-4 w-4" />
          Acepto el aviso legal y continúo
        </button>
      </div>
    </div>
  );
}

export default AvisoLegalGate;
