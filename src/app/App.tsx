import { Suspense, useEffect, useState } from 'react';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { Sidebar, SidebarContent } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './components/ui/sheet';
import { Dashboard } from './components/Dashboard';
import { FichaClimatica } from './components/FichaClimatica';

// Vistas no iniciales: lazy para aligerar el bundle inicial (Dashboard y la
// Ficha —que puede abrirse por hash compartible— se mantienen estáticas).
const MapaEstaciones = lazyWithRetry(() => import('./components/MapaEstaciones'));
const Analytics = lazyWithRetry(() => import('./components/Analytics').then((m) => ({ default: m.Analytics })));
const EstadoEspejo = lazyWithRetry(() => import('./components/EstadoEspejo').then((m) => ({ default: m.EstadoEspejo })));
const ComparadorEstaciones = lazyWithRetry(() => import('./components/ComparadorEstaciones').then((m) => ({ default: m.ComparadorEstaciones })));
const Hidrologia = lazyWithRetry(() => import('./components/Hidrologia').then((m) => ({ default: m.Hidrologia })));
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
      hydro: ['Inicio', 'Curvas IDF y caudal'],
      historia: ['Inicio', 'La historia del dato'],
      metodologia: ['Inicio', 'Metodología'],
      status: ['Inicio', 'Estado del Espejo'],
      extractor: ['Inicio', 'Extractor de Datos'],
      history: ['Inicio', 'Historial de Descargas'],
    };
    const labels = breadcrumbMap[currentView] || ['Inicio'];
    // El primer crumb ('Inicio') vuelve a la portada de bienvenida (landing),
    // igual que el logo del sidebar; el último es la vista actual y no es clicable.
    return labels.map((label, i) => (i === 0 ? { label, view: 'landing' } : { label }));
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
          <SheetDescription className="sr-only">Explora las vistas y herramientas de la plataforma.</SheetDescription>
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
        <main className="flex-1 overflow-y-auto p-4 pt-20 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-6 md:pt-20 scrollbar-thin scrollbar-track-transparent">
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
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

