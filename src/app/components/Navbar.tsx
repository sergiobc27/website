import { Sun, Moon, HelpCircle, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ExtractorRuntimeState } from './DataExtractor';

interface NavbarProps {
  breadcrumbs: string[];
  runtime: ExtractorRuntimeState;
  onNavigate: (view: string) => void;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 s';
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
  const totalSeconds = Math.round(value / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

function readDownloadCount() {
  try {
    const history = JSON.parse(localStorage.getItem('ideam-history') || '[]');
    return Array.isArray(history) ? history.length : 0;
  } catch {
    return 0;
  }
}

export function Navbar({ breadcrumbs, runtime, onNavigate }: NavbarProps) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const toggleTheme = () => {
    const nextValue = !isDark;
    setIsDark(nextValue);
    document.documentElement.classList.toggle('dark', nextValue);
    window.localStorage.setItem('ideam-theme', nextValue ? 'dark' : 'light');
  };

  return (
    <div className="relative flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 backdrop-blur-sm md:px-6">
      <div className="min-w-0 flex items-center gap-2 overflow-hidden text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            {index > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-[#CCCCCC]" />}
            <span
              className={`truncate transition-colors ${
                index === breadcrumbs.length - 1 ? 'font-semibold text-accent' : 'cursor-pointer text-muted-foreground hover:text-foreground'
              }`}
            >
              {crumb}
            </span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {runtime.isBusy && (
          <button
            type="button"
            onClick={() => onNavigate('extractor')}
            className="hidden items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-left lg:flex"
            title="Ver descarga en curso"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <span className="min-w-0">
              <span className="block max-w-52 truncate text-xs font-semibold text-card-foreground">{runtime.activeTask}</span>
              <span className="block text-[11px] text-muted-foreground">
                {runtime.progress}% | {runtime.downloadedRows.toLocaleString('es-CO')} / {runtime.totalRows.toLocaleString('es-CO')} filas |{' '}
                {formatDuration(runtime.elapsedMs)}
              </span>
            </span>
          </button>
        )}

        {runtime.isBusy && (
          <button
            type="button"
            onClick={() => onNavigate('extractor')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent lg:hidden"
            title={`${runtime.progress}% completado`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground transition-all hover:scale-110 hover:bg-muted hover:text-accent"
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => onNavigate('docs')}
          className="rounded-lg p-2 text-muted-foreground transition-all hover:scale-110 hover:bg-muted hover:text-accent"
          title="Ayuda"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setIsProfileOpen((current) => !current)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#A3161A] to-[#C9A227] shadow-[0_0_15px_rgba(201,162,39,0.3)] transition-transform hover:scale-110 hover:shadow-[0_0_25px_rgba(201,162,39,0.5)]"
          title="Perfil"
        >
          <User className="h-4 w-4 text-white" />
        </button>
      </div>

      {isProfileOpen && (
        <div className="absolute right-4 top-14 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-2xl md:right-6">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#A3161A] to-[#C9A227]">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-card-foreground">Sesion local</p>
              <p className="text-xs text-muted-foreground">Sin inicio de sesion requerido</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 py-4 text-sm">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Descargas</p>
              <p className="font-mono font-bold text-card-foreground">{readDownloadCount()}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Extractor</p>
              <p className="font-mono font-bold text-card-foreground">{runtime.isBusy ? `${runtime.progress}%` : 'Libre'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                onNavigate('extractor');
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-card-foreground hover:border-accent/40"
            >
              Extractor
            </button>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                onNavigate('history');
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-card-foreground hover:border-accent/40"
            >
              Historial
            </button>
          </div>
        </div>
      )}

      {runtime.isBusy && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-accent transition-all duration-300" style={{ width: `${Math.max(2, runtime.progress)}%` }} />
      )}
    </div>
  );
}
