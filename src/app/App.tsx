import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Cloud, Database, FileArchive, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { DataExtractor } from './components/DataExtractor';
import type { ExtractorRuntimeState } from './components/DataExtractor';
import { DownloadHistory } from './components/DownloadHistory';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [runtime, setRuntime] = useState<ExtractorRuntimeState>({
    isBusy: false,
    activeTask: 'Esperando configuracion',
    progress: 0,
    elapsedMs: 0,
    downloadedRows: 0,
    totalRows: 0,
  });

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
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#2a2a2a] scrollbar-track-transparent">
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
        <p className="text-muted-foreground text-sm mt-1">Configuracion operativa visible para ejecutar consultas Socrata desde la web.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard icon={Cloud} title="Origen" value="datos.gov.co" detail="Socrata SODA API" />
        <InfoCard icon={Database} title="Catalogo de estaciones" value="hp9r-jxuu" detail="Filtros territoriales y tecnicos" />
        <InfoCard icon={FileArchive} title="Salida" value="ZIP paginado" detail="CSV, JSON y Parquet opcional" />
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h3 className="text-card-foreground font-bold mb-4">Variables de entorno esperadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <ConfigRow name="SOCRATA_DOMAIN" value="https://www.datos.gov.co" />
          <ConfigRow name="CATALOG_DATASET_ID" value="hp9r-jxuu" />
          <ConfigRow name="PAGE_LIMIT" value="50000" />
          <ConfigRow name="EXPORT_PAGE_SIZE" value="50000" />
          <ConfigRow name="PREVIEW_LIMIT" value="200" />
          <ConfigRow name="MAX_CATALOG_STATIONS" value="Opcional" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_40px_rgba(201,162,39,0.1)]">
        <h3 className="text-card-foreground font-bold mb-4">Controles de seguridad</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ChecklistItem text="No se exponen tokens de Socrata o Cloudflare al navegador." />
          <ChecklistItem text="Las consultas se paginan para evitar descargas masivas en una sola respuesta." />
          <ChecklistItem text="La validacion territorial corre antes del ZIP cuando eliges departamentos." />
        </div>
      </div>
    </div>
  );
}

function DocumentationView({ onOpenExtractor }: { onOpenExtractor: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-card-foreground text-2xl font-bold">Documentacion</h2>
          <p className="text-muted-foreground text-sm mt-1">Guia rapida del flujo web y de las validaciones que protegen la descarga.</p>
        </div>
        <button
          onClick={onOpenExtractor}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground"
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
            'Elegir todo el pais o departamentos puntuales.',
            'Aplicar filtros de catalogo o estaciones manuales.',
            'Definir temporalidad y descargar ZIP.',
          ]}
        />
        <DocCard
          icon={CheckCircle2}
          title="Validaciones automaticas"
          items={[
            'Rango temporal valido.',
            'Departamentos requeridos si el modo es puntual.',
            'Cobertura territorial antes de exportar ZIP.',
            'Particion automatica para archivos grandes.',
            'Metricas de filas, estaciones, municipios, zonas, peso y tiempo.',
          ]}
        />
        <DocCard
          icon={BookOpen}
          title="Formatos disponibles"
          items={[
            'CSV para Excel y analisis general.',
            'JSON para integraciones web o APIs.',
            'Parquet para analitica eficiente cuando el navegador lo soporte.',
          ]}
        />
        <DocCard
          icon={KeyRound}
          title="Notas para despliegue"
          items={[
            'Cloudflare Worker sirve los endpoints /api.',
            'GitHub Actions publica los cambios del repositorio.',
            'Las credenciales deben vivir en secrets, nunca en el codigo fuente.',
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
