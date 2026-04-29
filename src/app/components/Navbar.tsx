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
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`;
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
  const [isDark, setIsDark] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="relative h-16 bg-card border-b border-border px-6 flex items-center justify-between backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="w-4 h-4 text-[#CCCCCC]" />}
            <span className={`transition-colors ${index === breadcrumbs.length - 1 ? 'text-accent font-semibold' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}>
              {crumb}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {runtime.isBusy && (
          <button
            type="button"
            onClick={() => onNavigate('extractor')}
            className="hidden md:flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-left"
            title="Ver descarga en curso"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <span className="min-w-0">
              <span className="block max-w-52 truncate text-xs font-semibold text-card-foreground">{runtime.activeTask}</span>
              <span className="block text-[11px] text-muted-foreground">
                {runtime.progress}% · {runtime.downloadedRows.toLocaleString('es-CO')} / {runtime.totalRows.toLocaleString('es-CO')} filas ·{' '}
                {formatDuration(runtime.elapsedMs)}
              </span>
            </span>
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent transition-all hover:scale-110"
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => onNavigate('docs')}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent transition-all hover:scale-110"
          title="Ayuda"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setIsProfileOpen((current) => !current)}
          className="w-8 h-8 bg-gradient-to-br from-[#A3161A] to-[#C9A227] rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-[0_0_15px_rgba(201,162,39,0.3)] hover:shadow-[0_0_25px_rgba(201,162,39,0.5)]"
          title="Perfil"
        >
          <User className="w-4 h-4 text-white" />
        </button>
      </div>

      {isProfileOpen && (
        <div className="absolute right-6 top-14 z-30 w-80 rounded-xl border border-border bg-card p-4 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#A3161A] to-[#C9A227] flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-card-foreground font-bold">Sesion local</p>
              <p className="text-muted-foreground text-xs">Sin inicio de sesion requerido</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 py-4 text-sm">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-muted-foreground text-xs">Descargas</p>
              <p className="text-card-foreground font-mono font-bold">{readDownloadCount()}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-muted-foreground text-xs">Extractor</p>
              <p className="text-card-foreground font-mono font-bold">{runtime.isBusy ? `${runtime.progress}%` : 'Libre'}</p>
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
