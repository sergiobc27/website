import { useState } from 'react';
import { Activity, BookOpenText, Building2, Database, Download, Droplets, Settings, FileText, BarChart3, ChevronLeft, ChevronRight, GitCompareArrows, MapPin, MessageCircle, TrendingUp } from 'lucide-react';
import logoVertical from "../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png";
import logoCollapsed from "../../imports/u.png";
import logoIdeam from "../../imports/Ideam_(Colombia)_logo.png";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

// Items agrupados por intención de uso: 12 ítems planos superan el límite de
// escaneo (7±2). Tres secciones dan jerarquía sin esconder nada.
// EXPORTADO: el menú de vistas del Navbar usa esta misma fuente única.
export const MENU_SECTIONS = [
  {
    title: 'Explorar',
    items: [
      { id: 'dashboard', icon: BarChart3, label: 'Panel general' },
      { id: 'analytics', icon: TrendingUp, label: 'Analítica' },
      { id: 'map', icon: MapPin, label: 'Mapa de Estaciones' },
      { id: 'compare', icon: GitCompareArrows, label: 'Comparador' },
      { id: 'ficha', icon: Building2, label: 'Ficha Climática' },
      { id: 'hydro', icon: Droplets, label: 'Hidrología' },
      { id: 'historia', icon: BookOpenText, label: 'La historia del dato' },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { id: 'asistente', icon: MessageCircle, label: 'Asistente Hídrico' },
      { id: 'extractor', icon: Database, label: 'Extractor de Datos' },
      { id: 'history', icon: Download, label: 'Historial' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'status', icon: Activity, label: 'Estado del Espejo' },
      { id: 'settings', icon: Settings, label: 'Ajustes de API' },
      { id: 'docs', icon: FileText, label: 'Documentación' },
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
      <div className="p-6 border-b border-[#8a1216] relative">
        {!isCollapsed ? (
          <div className="space-y-3">
            <img src={logoVertical} alt="Universidad de la Costa CUC" className="w-full h-auto" />
            <div className="text-center pt-2">
              <h1 className="text-white font-bold text-sm leading-5">AUTOMATIZACIÓN DE DATOS HÍDRICOS DEL IDEAM</h1>
              <p className="text-white/80 text-xs">Por: Sergio Beltran Coley</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={logoCollapsed} alt="CUC" className="w-12 h-12 object-contain" />
          </div>
        )}

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="absolute -right-3 top-8 w-6 h-6 bg-[#C9A227] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            aria-label={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-[#0f0f0f]" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-[#0f0f0f]" />
            )}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {MENU_SECTIONS.map((section, sectionIndex) => (
          <div key={section.title} className="space-y-2">
            {!isCollapsed ? (
              <p className="px-4 pt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">{section.title}</p>
            ) : (
              sectionIndex > 0 && <div className="mx-auto my-2 h-px w-8 bg-[#8a1216]" aria-hidden="true" />
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 justify-start'} px-4 py-3 rounded-lg transition-[background-color,color,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
                    isActive
                      ? 'bg-[#C9A227] text-[#0f0f0f] font-semibold shadow-[0_0_20px_rgba(201,162,39,0.4)]'
                      : 'text-white/80 hover:bg-[#8a1216] hover:text-white'
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon className="anim-wiggle w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#8a1216]">
        {!isCollapsed ? (
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <img src={logoIdeam} alt="IDEAM" className="w-full h-auto" />
            <p className="text-white/60 text-xs text-center mt-2 leading-5">Instituto de Hidrologia, Meteorologia y Estudios Ambientales</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={logoIdeam} alt="IDEAM" className="w-10 h-10 object-contain" />
          </div>
        )}
      </div>
    </>
  );
}

// Sidebar fijo de escritorio. En móvil (<lg) se oculta; la navegación móvil se
// abre como drawer (Sheet) desde el Navbar (ver App.tsx). El estado de colapso
// persiste en localStorage, igual que el tema y el historial.
export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  const toggleCollapse = () =>
    setIsCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // localStorage no disponible (modo privado): el colapso sigue funcionando en memoria.
      }
      return next;
    });

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} h-screen bg-[#A3161A] border-r border-[#8a1216] hidden lg:flex flex-col flex-shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]`}>
      <SidebarContent
        currentView={currentView}
        onNavigate={onNavigate}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
    </div>
  );
}
