import { useEffect, useState } from 'react';
import { Activity, BookMarked, BookOpenText, Building2, Calculator, Database, Download, Settings, BarChart3, ChevronLeft, ChevronRight, GitCompareArrows, MapPin, TrendingUp } from 'lucide-react';
import logoVertical from "../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png";
import logoCollapsed from "../../imports/u.png";
import logoIdeam from "../../imports/Ideam_(Colombia)_logo.png";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

// Items agrupados por intención de uso: 12 ítems planos superan el límite de
// escaneo (7±2). Tres secciones dan jerarquía sin esconder nada.
// EXPORTADO: el menú de vistas del Navbar y el buscador usan esta misma fuente única.
// NOTA: el "Asistente Hídrico" NO va aquí: no es un destino de navegación (abre un
// panel flotante, siempre accesible por su botón flotante y el buscador Ctrl+K).
// Tenerlo aquí dejaba un ítem que nunca se marcaba activo y duplicado en el buscador.
export const MENU_SECTIONS = [
  {
    title: 'Explorar',
    items: [
      { id: 'dashboard', icon: BarChart3, label: 'Panel general' },
      { id: 'analytics', icon: TrendingUp, label: 'Analítica' },
      { id: 'map', icon: MapPin, label: 'Mapa de Estaciones' },
      { id: 'compare', icon: GitCompareArrows, label: 'Comparador' },
      { id: 'ficha', icon: Building2, label: 'Ficha Climática' },
      { id: 'hydro', icon: Calculator, label: 'Calculadora de caudal (Hidrología)' },
      { id: 'historia', icon: BookOpenText, label: 'La historia del dato' },
      { id: 'metodologia', icon: BookMarked, label: 'Metodología' },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { id: 'extractor', icon: Database, label: 'Extractor de Datos' },
      { id: 'history', icon: Download, label: 'Historial' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'status', icon: Activity, label: 'Estado del Espejo' },
      { id: 'settings', icon: Settings, label: 'Ajustes de API' },
    ],
  },
];

const COLLAPSE_KEY = 'ideam-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

// Contenido del sidebar reutilizable: lo usa el sidebar fijo de escritorio y el
// drawer (Sheet) en móvil. `onToggleCollapse` solo aplica en escritorio.
export function SidebarContent({
  currentView,
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
}: {
  currentView: string;
  onNavigate: (view: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      <div className="relative border-b border-[#8a1216] p-4">
        {!isCollapsed ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              aria-label="Ir al inicio"
              className="block w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A227]"
            >
              <img src={logoVertical} alt="Universidad de la Costa CUC" className="mx-auto h-auto w-28" />
            </button>
            <div className="pt-1 text-center">
              <p className="text-xs font-bold leading-4 text-white">AUTOMATIZACIÓN DE DATOS HÍDRICOS DEL IDEAM</p>
              <p className="text-[0.7rem] text-white/80">Por: Sergio Beltran Coley</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              aria-label="Ir al inicio"
              className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A227]"
            >
              <img src={logoCollapsed} alt="CUC" className="h-10 w-10 object-contain" />
            </button>
          </div>
        )}

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="group absolute -right-3.5 top-8 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#A3161A] bg-[#C9A227] text-[#0f0f0f] shadow-lg transition-transform duration-200 hover:scale-110 hover:shadow-[0_0_14px_rgba(201,162,39,0.75)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title={isCollapsed ? 'Expandir panel' : 'Colapsar panel'}
            aria-label={isCollapsed ? 'Expandir panel' : 'Colapsar panel'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            ) : (
              <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            )}
          </button>
        )}
      </div>

      <nav aria-label="Navegación del panel" className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {MENU_SECTIONS.map((section, sectionIndex) => {
          // Índice global acumulado para que el escalonado de entrada sea monótono
          // (las secciones tienen 7/3/3 ítems, no bloques iguales).
          const itemsAntes = MENU_SECTIONS.slice(0, sectionIndex).reduce((n, s) => n + s.items.length, 0);
          return (
            <div key={section.title} role="group" aria-label={section.title} className="space-y-2">
              {!isCollapsed ? (
                <p className="px-4 pt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/70">{section.title}</p>
              ) : (
                sectionIndex > 0 && <div className="mx-auto my-2 h-px w-8 bg-white/20" aria-hidden="true" />
              )}
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                    style={{ animationDelay: `${(itemsAntes + index) * 30}ms` }}
                    className={`bento-enter group flex w-full items-center ${isCollapsed ? 'justify-center' : 'justify-start gap-3'} rounded-lg px-4 py-2.5 transition-[background-color,color,transform] duration-200 hover:translate-x-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
                      isActive
                        ? 'bg-[#C9A227] font-semibold text-[#0f0f0f] shadow-[0_0_20px_rgba(201,162,39,0.4)]'
                        : 'text-white/80 hover:bg-[#8a1216] hover:text-white'
                    }`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon className="anim-wiggle h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {!isCollapsed && <span className="truncate text-sm">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#8a1216] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 rounded-lg bg-white/10 p-3 backdrop-blur-sm">
            <img src={logoIdeam} alt="IDEAM" className="h-10 w-auto shrink-0" />
            <p className="text-left text-[0.7rem] leading-4 text-white/80">Instituto de Hidrología, Meteorología y Estudios Ambientales</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={logoIdeam} alt="IDEAM" className="h-8 w-8 object-contain" />
          </div>
        )}
      </div>
    </>
  );
}

// Sidebar fijo de escritorio. En móvil (<lg) se oculta; la navegación móvil se
// abre como drawer (Sheet) desde el Navbar/BarraInferior (ver App.tsx). El estado
// de colapso persiste en localStorage, igual que el tema y el historial.
export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  // Preferencia persistente del usuario (solo la toca el botón de colapsar) separada
  // del colapso transitorio del "modo enfoque": así el modo enfoque nunca pisa la
  // preferencia guardada (y al salir se restaura el valor real previo).
  const [userPref, setUserPref] = useState(readCollapsed);
  const [focusMode, setFocusMode] = useState(false);

  // Modo enfoque del Extractor: colapsa de forma transitoria mientras hay un job.
  useEffect(() => {
    const onFocus = (e: Event) => setFocusMode(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener('ideam-focus-mode', onFocus as EventListener);
    return () => window.removeEventListener('ideam-focus-mode', onFocus as EventListener);
  }, []);

  const isCollapsed = focusMode || userPref;

  const toggleCollapse = () =>
    setUserPref((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // localStorage no disponible (modo privado): el colapso sigue funcionando en memoria.
      }
      return next;
    });

  return (
    // z-40 (por encima del Navbar z-30): si no, el vidrio del Navbar tapaba el
    // botón circular de colapsar que sobresale del borde derecho.
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} relative z-40 hidden h-screen flex-shrink-0 flex-col border-r border-[#8a1216] bg-[#A3161A] transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:flex`}>
      <SidebarContent
        currentView={currentView}
        onNavigate={onNavigate}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
    </div>
  );
}
