import { BarChart3, Droplets, MapPin, Menu, TrendingUp } from 'lucide-react';

const TABS = [
  { id: 'dashboard', icon: BarChart3, label: 'Panel' },
  { id: 'analytics', icon: TrendingUp, label: 'Analítica' },
  { id: 'hydro', icon: Droplets, label: 'Hidrología' },
  { id: 'map', icon: MapPin, label: 'Mapa' },
] as const;

interface BarraInferiorProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onMore: () => void;
}

/**
 * Barra de pestañas inferior para móvil (lg:hidden): los 4 destinos principales
 * + "Más" (abre el drawer con todo). Vidrio del chrome + safe-area del iPhone.
 */
export function BarraInferior({ currentView, onNavigate, onMore }: BarraInferiorProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="glass-chrome fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const activa = currentView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={activa ? 'page' : undefined}
              className={`group flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:scale-95 ${
                activa ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`anim-bounce h-5 w-5 ${activa ? 'drop-shadow-[0_0_6px_rgba(201,162,39,0.5)]' : ''}`} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="group flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors duration-150 active:scale-95"
          aria-label="Abrir todas las vistas"
        >
          <Menu className="anim-bounce h-5 w-5" />
          <span className="text-[10px] font-semibold">Más</span>
        </button>
      </div>
    </nav>
  );
}
