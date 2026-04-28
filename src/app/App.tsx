import { useEffect, useState } from 'react';
import { Settings, FileText } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { DataExtractor } from './components/DataExtractor';
import { DownloadHistory } from './components/DownloadHistory';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const getBreadcrumbs = () => {
    const breadcrumbMap: Record<string, string[]> = {
      dashboard: ['Inicio', 'Dashboard'],
      extractor: ['Inicio', 'Extractor de Datos'],
      history: ['Inicio', 'Historial de Descargas'],
      settings: ['Inicio', 'Ajustes de API'],
      docs: ['Inicio', 'Documentacion'],
    };
    return breadcrumbMap[currentView] || ['Inicio'];
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'extractor':
        return <DataExtractor />;
      case 'history':
        return <DownloadHistory />;
      case 'settings':
        return <PlaceholderView icon={Settings} title="Ajustes de API" description="Configura credenciales y parametros de conexion" />;
      case 'docs':
        return <PlaceholderView icon={FileText} title="Documentacion" description="Guias y referencias de uso del sistema" />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar breadcrumbs={getBreadcrumbs()} />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function PlaceholderView({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/30">
          <Icon className="w-12 h-12 text-accent" />
        </div>
        <h2 className="text-card-foreground text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
