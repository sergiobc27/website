import { Database, ArrowRight } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="h-[400px] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl mx-auto flex items-center justify-center float-animation border border-accent/30">
            <Database className="w-16 h-16 text-accent" />
          </div>
          <div className="absolute top-0 right-1/4 w-4 h-4 bg-primary rounded-full shadow-[0_0_15px] shadow-primary/80 animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-3 h-3 bg-accent rounded-full shadow-[0_0_10px] shadow-accent/80 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
        <h3 className="text-card-foreground text-xl font-bold mb-3">Ninguna consulta activa</h3>
        <p className="text-muted-foreground mb-6">
          Configura los filtros en el panel izquierdo y presiona el botón de extracción para comenzar a obtener datos del IDEAM.
        </p>
        <div className="flex items-center justify-center gap-2 text-accent text-sm font-semibold">
          <span>Configura tus filtros</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
