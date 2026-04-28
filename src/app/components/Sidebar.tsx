import { Database, Download, Settings, FileText, BarChart3, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import logoVertical from "../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png";
import logoCollapsed from "../../imports/u.png";
import logoIdeam from "../../imports/Ideam_(Colombia)_logo.png";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'extractor', icon: Database, label: 'Extractor de Datos' },
    { id: 'history', icon: Download, label: 'Historial' },
    { id: 'settings', icon: Settings, label: 'Ajustes de API' },
    { id: 'docs', icon: FileText, label: 'Documentación' },
  ];

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-[#A3161A] border-r border-[#8a1216] flex flex-col flex-shrink-0 transition-all duration-300`}>
      <div className="p-6 border-b border-[#8a1216] relative">
        {!isCollapsed ? (
          <div className="space-y-3">
            <img src={logoVertical} alt="Universidad de la Costa CUC" className="w-full h-auto" />
            <div className="text-center pt-2">
              <h1 className="text-white font-bold text-sm">AUTOMATIZACIÓN DE DATOS HÍDRICOS DEL IDEAM</h1>
              <p className="text-white/80 text-xs">Por: Sergio Beltrán Coley</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={logoCollapsed} alt="CUC" className="w-12 h-12 object-contain" />
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-[#C9A227] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
          title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-[#0f0f0f]" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-[#0f0f0f]" />
          )}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#C9A227] text-[#0f0f0f] font-semibold shadow-[0_0_20px_rgba(201,162,39,0.4)]'
                  : 'text-white/80 hover:bg-[#8a1216] hover:text-white'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#8a1216]">
        {!isCollapsed ? (
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <img src={logoIdeam} alt="IDEAM" className="w-full h-auto" />
            <p className="text-white/60 text-xs text-center mt-2">Instituto de Hidrología, Meteorología y Estudios Ambientales</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={logoIdeam} alt="IDEAM" className="w-10 h-10 object-contain" />
          </div>
        )}
      </div>

    </div>
  );
}
