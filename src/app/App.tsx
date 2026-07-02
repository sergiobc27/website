import { Suspense, useEffect, useState } from 'react';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { BookOpen, CheckCircle2, Cloud, Database, FileArchive, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { Sidebar, SidebarContent } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Sheet, SheetContent, SheetTitle } from './components/ui/sheet';
import { Dashboard } from './components/Dashboard';
import { FichaClimatica } from './components/FichaClimatica';

// Vistas no iniciales: lazy para aligerar el bundle inicial (Dashboard y la
// Ficha —que puede abrirse por hash compartible— se mantienen estáticas).
const MapaEstaciones = lazyWithRetry(() => import('./components/MapaEstaciones'));
const Analytics = lazyWithRetry(() => import('./components/Analytics').then((m) => ({ default: m.Analytics })));
const EstadoEspejo = lazyWithRetry(() => import('./components/EstadoEspejo').then((m) => ({ default: m.EstadoEspejo })));
const ComparadorEstaciones = lazyWithRetry(() => import('./components/ComparadorEstaciones').then((m) => ({ default: m.ComparadorEstaciones })));
const Hidrologia = lazyWithRetry(() => import('./components/Hidrologia').then((m) => ({ default: m.Hidrologia })));
const BibliotecaReferencias = lazyWithRetry(() => import('./components/BibliotecaReferencias').then((m) => ({ default: m.BibliotecaReferencias })));
const HistoriaIdf = lazyWithRetry(() => import('./components/HistoriaIdf').then((m) => ({ default: m.HistoriaIdf })));
const Metodologia = lazyWithRetry(() => import('./components/Metodologia').then((m) => ({ default: m.Metodologia })));
const Landing = lazyWithRetry(() => import('./components/landing/Landing').then((m) => ({ default: m.Landing })));

// Compatibilidad hacia atrás: convierte un enlace viejo de ficha por hash
// (#/ficha/DEP/MUN) a la ruta nueva con query (/ficha?dep=DEP&mun=MUN).
// Devuelve true si hizo la conversión. La ficha lee su estado de la query
// mediante useUrlSync (ver FichaClimatica).
function migrateLegacyFichaHash(): boolean {
  const match = window.location.hash.match(/^#\/ficha\/([^/]+)\/([^/]+)/);
  if (!match) return false;
  try {
    const dep = decodeURIComponent(match[1]);
    const mun = decodeURIComponent(match[2]);
    const search = new URLSearchParams({ dep, mun }).toString();
    window.history.replaceState(null, '', `/ficha?${search}`);
    return true;
  } catch {
    return false;
  }
}
import { DataExtractor } from './components/DataExtractor';
import type { ExtractorRuntimeState } from './components/DataExtractor';
import { DownloadHistory } from './components/DownloadHistory';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { initTheme } from './lib/theme';
import { viewToPath, pathToView, NAVIGATE_EVENT, ACCION_VIEWS, type NavigateDetail, type View } from './lib/navigation';
import { buildSearch } from './lib/urlState';
import { detectarPlataforma } from './lib/plataforma';
import { AsistenteFlotante, OPEN_ASISTENTE_EVENT } from './components/AsistenteFlotante';
import { BarraInferior } from './components/BarraInferior';
import { BuscadorUniversal } from './components/BuscadorUniversal';

export default function App() {
  const [currentView, setCurrentView] = useState<View>(() =>
    migrateLegacyFichaHash() ? 'ficha' : pathToView(window.location.pathname),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [runtime, setRuntime] = useState<ExtractorRuntimeState>({
    isBusy: false,
    activeTask: 'Esperando configuración',
    progress: 0,
    elapsedMs: 0,
    downloadedRows: 0,
    totalRows: 0,
  });

  useEffect(() => {
    return initTheme();
  }, []);

  // Marca la plataforma en <html> para el tratamiento Liquid Glass del chrome
  // (iOS: vidrio pleno; Android: entintado; desktop: sutil). Ver theme.css.
  useEffect(() => {
    document.documentElement.dataset.plataforma = detectarPlataforma();
  }, []);

  // Shim de URLs viejas: /asistente ya no es vista — abre el panel flotante
  // sobre el dashboard (mismo espíritu del shim de ficha por hash).
  useEffect(() => {
    if (window.location.pathname.replace(/\/+$/, '') === '/asistente') {
      window.history.replaceState(null, '', '/app');
      setCurrentView('dashboard');
      window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT));
    }
  }, []);

  // Sincroniza la vista con la URL ante atrás/adelante (popstate) y ante un
  // hash viejo de ficha pegado/navegado (hashchange). Todas las pestañas son
  // rutas reales (/map, /hydro, /ficha…); cada vista lee su propio estado de la
  // query con useUrlSync. El hash viejo de ficha se migra a la ruta con query.
  useEffect(() => {
    const sync = () => {
      if (migrateLegacyFichaHash()) {
        setCurrentView('ficha');
      } else {
        setCurrentView(pathToView(window.location.pathname));
      }
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  // Deep-links del Asistente (botones de acción): navega a la vista con los
  // filtros YA en la URL (?est, ?dep&var&years), que la vista destino lee con
  // useUrlSync.onRestore al montar. Distinto de navigate(): aquí la URL lleva
  // los params. Whitelist ACCION_VIEWS por seguridad. Si la vista ya está
  // montada (mismo currentView), un popstate sintético la fuerza a releerlos.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<NavigateDetail>).detail;
      if (!detail || typeof detail.view !== 'string' || !ACCION_VIEWS.has(detail.view)) return;
      const search = buildSearch(detail.params || {});
      const yaEnVista = pathToView(window.location.pathname) === detail.view;
      window.history.pushState(null, '', viewToPath(detail.view) + (search ? `?${search}` : ''));
      // detail.view viene filtrado por ACCION_VIEWS (subconjunto de VIEWS), así que
      // es una View válida aunque el tipo del evento siga siendo string.
      setCurrentView(detail.view as View);
      if (yaEnVista) window.dispatchEvent(new PopStateEvent('popstate'));
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, onNavigate);
  }, []);

  // Recibe string (no View): la llaman children tipados de forma genérica
  // (Sidebar/Navbar/BarraInferior) y también 'asistente', que ya no es una vista
  // real sino un atajo para abrir el panel flotante.
  const navigate = (view: string) => {
    if (view === 'asistente') {
      // El asistente ya no es una vista: el sidebar/breadcrumbs abren el panel.
      window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT));
      return;
    }
    // pushState a la ruta de la pestaña; fijar un pathname sin hash limpia de
    // paso el hash de ficha si veníamos de una ficha compartida.
    window.history.pushState(null, '', viewToPath(view));
    // Los únicos llamadores reales pasan literales de VIEWS (ver Sidebar/Navbar/
    // Dashboard/BarraInferior); 'asistente' ya se atajó arriba. Cast, no lógica nueva.
    setCurrentView(view as View);
  };

  const getBreadcrumbs = (): Array<{ label: string; view?: string }> => {
    // Record<View, string[]>: si se agrega una vista a VIEWS y se olvida aquí,
    // TypeScript lo marca en vez de caer en silencio al fallback ['Inicio'].
    const breadcrumbMap: Record<View, string[]> = {
      landing: ['Inicio'],
      dashboard: ['Inicio', 'Panel general'],
      analytics: ['Inicio', 'Analítica'],
      map: ['Inicio', 'Mapa de Estaciones'],
      compare: ['Inicio', 'Comparador'],
      ficha: ['Inicio', 'Ficha Climática'],
      hydro: ['Inicio', 'Hidrología'],
      historia: ['Inicio', 'La historia del dato'],
      metodologia: ['Inicio', 'Metodología'],
      status: ['Inicio', 'Estado del Espejo'],
      extractor: ['Inicio', 'Extractor de Datos'],
      history: ['Inicio', 'Historial de Descargas'],
      settings: ['Inicio', 'Ajustes de API'],
      docs: ['Inicio', 'Documentación'],
    };
    const labels = breadcrumbMap[currentView] || ['Inicio'];
    // El primer crumb ('Inicio') navega al dashboard; el último es la vista
    // actual y no es clicable. Antes todos parecían clicables pero ninguno lo era.
    return labels.map((label, i) => (i === 0 ? { label, view: 'dashboard' } : { label }));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'analytics':
        return <Analytics />;
      case 'map':
        return <MapaEstaciones />;
      case 'compare':
        return <ComparadorEstaciones />;
      case 'hydro':
        return <Hidrologia />;
      case 'historia':
        return <HistoriaIdf onNavigate={navigate} />;
      case 'metodologia':
        return <Metodologia />;
      case 'ficha':
        // La ficha lee dep/mun de la query (useUrlSync); no necesita props.
        return <FichaClimatica />;
      case 'status':
        return <EstadoEspejo />;
      case 'history':
        return <DownloadHistory />;
      case 'settings':
        return <SettingsView />;
      case 'docs':
        return <DocumentationView onOpenExtractor={() => navigate('extractor')} />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  // La landing es portada a pantalla completa: sin sidebar, navbar ni barras.
  if (currentView === 'landing') {
    return (
      <ErrorBoundary key="landing">
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-sm">Cargando…</div>}>
          <Landing onNavigate={navigate} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={navigate} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="glass-rojo w-72 border-r border-[#8a1216] p-0 text-white [&>button]:text-white">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <div className="flex h-full flex-col">
            <SidebarContent
              currentView={currentView}
              onNavigate={(view) => {
                navigate(view);
                setMobileNavOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        {/* La navbar es overlay: el contenido scrollea POR DEBAJO del vidrio. */}
        <Navbar breadcrumbs={getBreadcrumbs()} runtime={runtime} onNavigate={navigate} onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 pt-20 pb-24 md:p-6 md:pt-20 lg:pb-6 scrollbar-thin scrollbar-track-transparent">
          {/* h1 único de la página = título de la vista activa (la marca del panel ya no es h1). */}
          <h1 className="sr-only">{getBreadcrumbs().slice(-1)[0]?.label || 'IDEAM'}</h1>
          {/* Se mantiene SIEMPRE montado (a diferencia del resto de vistas, que se
              desmontan al navegar): preserva su configuración y deja los timers de
              un export en curso corriendo en segundo plano bajo cualquier vista.
              Boundary propio (sin key) para que un error de render aquí no tumbe
              el shell entero, ya que el boundary de abajo no lo cubre. */}
          <ErrorBoundary>
            <div className={currentView === 'extractor' ? 'block' : 'hidden'}>
              <DataExtractor onRuntimeChange={setRuntime} />
            </div>
          </ErrorBoundary>
          {currentView !== 'extractor' && (
            // key={currentView}: al navegar se remonta el boundary y se limpia
            // un error previo, así un fallo en una vista no bloquea las demás.
            <ErrorBoundary key={currentView}>
              <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-sm">Cargando…</div>}>
                {renderContent()}
              </Suspense>
            </ErrorBoundary>
          )}
        </main>
      </div>
      <AsistenteFlotante currentView={currentView} />
      <BuscadorUniversal onNavigate={navigate} />
      <BarraInferior currentView={currentView} onNavigate={navigate} onMore={() => setMobileNavOpen(true)} />
      <Toaster richColors position="bottom-right" />
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

      <div className="bg-card border border-border rounded-xl p-6 shadow-glow">
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

      <div className="bg-card border border-border rounded-xl p-6 shadow-glow">
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
            'Elegir un departamento (uno por descarga).',
            'Aplicar filtros de catálogo y estaciones específicas (opcional).',
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

      <BibliotecaReferencias />
    </div>
  );
}

function InfoCard({ icon: Icon, title, value, detail }: { icon: React.ElementType; title: string; value: string; detail: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-glow">
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
    <div className="bg-card border border-border rounded-xl p-6 shadow-glow">
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
