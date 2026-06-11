import { Database, ArrowRight, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  hint?: string;
  icon?: LucideIcon;
}

// Estado vacío reutilizable y parametrizable. Antes mostraba un texto único
// ("presiona el botón de extracción") en 3 contextos distintos, equivocado en
// vista previa y métricas. Cada uso pasa ahora su propio copy.
export function EmptyState({
  title = 'Ninguna consulta activa',
  description = 'Configura los filtros en el panel izquierdo y presiona el botón de extracción para comenzar a obtener datos del IDEAM.',
  hint = 'Configura tus filtros',
  icon: Icon = Database,
}: EmptyStateProps = {}) {
  return (
    <div className="h-[400px] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl mx-auto flex items-center justify-center float-animation border border-accent/30">
            <Icon className="w-16 h-16 text-accent" />
          </div>
          <div className="absolute top-0 right-1/4 w-4 h-4 bg-primary rounded-full shadow-[0_0_15px] shadow-primary/80 animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-3 h-3 bg-accent rounded-full shadow-[0_0_10px] shadow-accent/80 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
        <h3 className="text-card-foreground text-xl font-bold mb-3">{title}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>
        {hint && (
          <div className="flex items-center justify-center gap-2 text-accent text-sm font-semibold">
            <span>{hint}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
