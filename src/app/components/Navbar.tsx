import { Sun, Moon, Monitor, HelpCircle, User, ChevronRight, History, Trash2, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExtractorRuntimeState } from './DataExtractor';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './ui/alert-dialog';
import { toast } from 'sonner';
import { getThemeChoice, applyTheme, type ThemeChoice } from '../lib/theme';
import { clearLocalData } from '../lib/localData';

interface NavbarProps {
  breadcrumbs: string[];
  runtime: ExtractorRuntimeState;
  onNavigate: (view: string) => void;
  onOpenMobileNav: () => void;
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

// El botón rápido sol/luna alterna entre claro y oscuro explícitos, partiendo
// del tema efectivo actual (si está en 'system', usa la preferencia del SO).
function resolveQuickToggle(current: ThemeChoice): ThemeChoice {
  const isDarkNow =
    current === 'dark' ||
    (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return isDarkNow ? 'light' : 'dark';
}

export function Navbar({ breadcrumbs, runtime, onNavigate, onOpenMobileNav }: NavbarProps) {
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);
  const [downloadCount, setDownloadCount] = useState(0);

  const refreshCount = () => setDownloadCount(readDownloadCount());
  useEffect(() => {
    refreshCount();
  }, []);

  const onThemeChange = (value: string) => {
    const choice = value as ThemeChoice;
    setTheme(choice);
    applyTheme(choice);
  };
  const quickToggle = () => onThemeChange(resolveQuickToggle(theme));

  return (
    <div className="relative flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 backdrop-blur-sm md:px-6">
      <div className="min-w-0 flex items-center gap-2 overflow-hidden text-sm">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent lg:hidden"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" />
        </button>
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            {index > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-border" />}
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
          onClick={quickToggle}
          className="rounded-lg p-2 text-muted-foreground transition-all hover:scale-110 hover:bg-muted hover:text-accent"
          title="Cambiar tema"
          aria-label="Cambiar tema rápido"
        >
          {resolveQuickToggle(theme) === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => onNavigate('docs')}
          className="rounded-lg p-2 text-muted-foreground transition-all hover:scale-110 hover:bg-muted hover:text-accent"
          title="Ayuda"
          aria-label="Ayuda y documentación"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#A3161A] to-[#C9A227] shadow-[0_0_15px_rgba(201,162,39,0.3)] transition-transform hover:scale-110 hover:shadow-[0_0_25px_rgba(201,162,39,0.5)]"
              title="Perfil"
              aria-label="Perfil y sesión"
            >
              <User className="h-4 w-4 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-bold">Sesión local</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Sin inicio de sesión · {downloadCount} {downloadCount === 1 ? 'descarga' : 'descargas'}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={onThemeChange}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4" />Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4" />Oscuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4" />Sistema
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => onNavigate('history')}>
              <History className="mr-2 h-4 w-4" />Historial de descargas
            </DropdownMenuItem>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e: Event) => e.preventDefault()} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />Limpiar datos locales
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Limpiar datos locales?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se borrarán el historial de descargas, la configuración del extractor y las estaciones del comparador guardadas en este navegador. Tu preferencia de tema se conserva. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      clearLocalData();
                      refreshCount();
                      toast.success('Datos locales borrados');
                    }}
                  >
                    Borrar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <p>Por: Sergio Beltrán Coley</p>
              <p>Versión {__APP_VERSION__}</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {runtime.isBusy && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-accent transition-all duration-300" style={{ width: `${Math.max(2, runtime.progress)}%` }} />
      )}
    </div>
  );
}
