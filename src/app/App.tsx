import { Suspense, lazy, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Cloud, Database, FileArchive, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { Analytics } from './components/Analytics';
import { EstadoEspejo } from './components/EstadoEspejo';

// El mapa carga MapLibre (~220KB gzip): lazy para no engordar el bundle inicial.
const MapaEstaciones = lazy(() => import('./components/MapaEstaciones'));
import { DataExtractor } from './components/DataExtractor';
import type { ExtractorRuntimeState } from './components/DataExtractor';
import { DownloadHistory } from './components/DownloadHistory';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [runtime, setRuntime] = useState<ExtractorRuntimeState>({
    isBusy: false,
    activeTask: 'Esperando configuración',
    progress: 0,
    elapsedMs: 0,
    downloadedRows: 0,
    totalRows: 0,
  });

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('ideam-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', storedTheme ? storedTheme === 'dark' : prefersDark);
  }, []);

  const getBreadcrumbs = () => {
    const breadcrumbMap: Record<string, string[]> = {
      dashboard: ['Inicio', 'Dashboard'],
      analytics: ['Inicio', 'Analítica'],
      map: ['Inicio', 'Mapa de Estaciones'],
      status: ['Inicio', 'Estado del Espejo'],
      extractor: ['Inicio', 'Extractor de Datos'],
      history: ['Inicio', 'Historial de Descargas'],
      settings: ['Inicio', 'Ajustes de API'],
      docs: ['Inicio', 'Documentación'],
    };
    return breadcrumbMap[currentView] || ['Inicio'];
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'analytics':
        return <Analytics />;
      case 'map':
        return (
          <Suspense fallback={<p className="text-muted-foreground text-sm">Cargando mapa...</p>}>
            <MapaEstaciones />
          </Suspense>
        );
      case 'status':
        return <EstadoEspejo />;
      case 'history':
        return <DownloadHistory />;
      case 'settings':
        return <SettingsView />;
      case 'docs':
        return <DocumentationView onOpenExtractor={() => setCurrentView('extractor')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar breadcrumbs={getBreadcrumbs()} runtime={runtime} onNavigate={setCurrentView} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
          <div className={currentView === 'extractor' ? 'block' : 'hidden'}>
            <DataExtractor onRuntimeChange={setRuntime} />
          </div>
          {currentView !== 'extractor' && renderContent()}
        </main>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-foreground text-2xl font-bold">Ajustes de API</h2>
        <p className="text-muted-foreground text-sm mt-1">Configuración operativa visible para ejecutar consultas Socrata desde la web.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard icon={Cloud} title="Origen" value="datos.gov.co" detail="Socrata SODA API" />
        <InfoCard icon={Database} title="Catálogo de estaciones" value="hp9r-jxuu" detail="Filtros territoriales y tecnicos" />
        <InfoCard icon={FileArchive} title="Salida" value="ZIP paginado" detail="CSV, JSON y Parquet opcional" />
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h3 className="text-card-foreground font-bold mb-4">Variables de entorno esperadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <ConfigRow name="SOCRATA_DOMAIN" value="https://www.datos.gov.co" />
          <ConfigRow name="CATALOG_DATASET_ID" value="hp9r-jxuu" />
          <ConfigRow name="PAGE_LIMIT" value="50000" />
          <ConfigRow name="EXPORT_PAGE_SIZE" value="10000" />
          <ConfigRow name="PREVIEW_LIMIT" value="200" />
          <ConfigRow name="MAX_CATALOG_STATIONS" value="Opcional" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h3 className="text-card-foreground font-bold mb-4">Controles de seguridad</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ChecklistItem text="No se exponen tokens de Socrata o Cloudflare al navegador." />
          <ChecklistItem text="Las consultas se paginan para evitar descargas masivas en una sola respuesta." />
          <ChecklistItem text="La validación territorial corre antes del ZIP cuando eliges departamentos." />
        </div>
      </div>
    </div>
  );
}

function DocumentationView({ onOpenExtractor }: { onOpenExtractor: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-card-foreground text-2xl font-bold">Documentación</h2>
          <p className="text-muted-foreground text-sm mt-1">Guía rápida del flujo web y de las validaciones que protegen la descarga.</p>
        </div>
        <button
          onClick={onOpenExtractor}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground sm:w-auto"
        >
          <Terminal className="h-4 w-4" />
          Abrir extractor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DocCard
          icon={ShieldCheck}
          title="Flujo recomendado"
          items={[
            'Aceptar el aviso legal.',
            'Seleccionar variable IDEAM.',
            'Elegir todo el país o departamentos puntuales.',
            'Aplicar filtros de catálogo o estaciones manuales.',
            'Definir temporalidad y descargar ZIP.',
          ]}
        />
        <DocCard
          icon={CheckCircle2}
          title="Validaciones automáticas"
          items={[
            'Rango temporal válido.',
            'Departamentos requeridos si el modo es puntual.',
            'Cobertura territorial antes de exportar ZIP.',
            'Partición automática para archivos grandes.',
            'Métricas de filas, estaciones, municipios, zonas, peso y tiempo.',
          ]}
        />
        <DocCard
          icon={BookOpen}
          title="Formatos disponibles"
          items={[
            'CSV para Excel y análisis general.',
            'JSON para integraciones web o APIs.',
            'Parquet para analítica eficiente cuando el navegador lo soporte.',
          ]}
        />
        <DocCard
          icon={KeyRound}
          title="Notas para despliegue"
          items={[
            'Cloudflare Worker sirve los endpoints /api.',
            'GitHub Actions publica los cambios del repositorio.',
            'Las credenciales deben vivir en secrets, nunca en el código fuente.',
          ]}
        />
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, value, detail }: { icon: React.ElementType; title: string; value: string; detail: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-[0_0_20px] shadow-accent/10">
      <Icon className="w-6 h-6 text-accent mb-4" />
      <p className="text-muted-foreground text-sm">{title}</p>
      <p className="text-card-foreground font-mono font-bold mt-1">{value}</p>
      <p className="text-muted-foreground text-xs mt-2">{detail}</p>
    </div>
  );
}

function ConfigRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-card-foreground font-mono text-sm font-bold">{name}</p>
      <p className="text-muted-foreground text-xs mt-1">{value}</p>
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      <p className="text-sm text-card-foreground">{text}</p>
    </div>
  );
}

function DocCard({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-5 w-5 text-accent" />
        <h3 className="text-card-foreground font-bold">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
