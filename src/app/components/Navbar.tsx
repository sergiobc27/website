import { Sun, Moon, ChevronRight, Search, Home, Menu, Github, Package, Linkedin } from 'lucide-react';
import { useState } from 'react';
import type { ExtractorRuntimeState } from './DataExtractor';
import { getThemeChoice, applyTheme, type ThemeChoice } from '../lib/theme';
import { CopyLinkButton } from './CopyLinkButton';

interface NavbarProps {
  breadcrumbs: Array<{ label: string; view?: string }>;
  runtime: ExtractorRuntimeState;
  onNavigate: (view: string) => void;
  // Abre el panel lateral (drawer) en móvil/tablet. Único acceso a la navegación
  // completa en <lg (ya no hay barra inferior).
  onOpenMenu?: () => void;
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 s';
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
  const totalSeconds = Math.round(value / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

// El botón rápido sol/luna alterna entre claro y oscuro explícitos, partiendo
// del tema efectivo actual (si está en 'system', usa la preferencia del SO).
function resolveQuickToggle(current: ThemeChoice): ThemeChoice {
  const isDarkNow =
    current === 'dark' ||
    (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return isDarkNow ? 'light' : 'dark';
}

export function Navbar({ breadcrumbs, runtime, onNavigate, onOpenMenu }: NavbarProps) {
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);

  const onThemeChange = (value: string) => {
    const choice = value as ThemeChoice;
    setTheme(choice);
    applyTheme(choice);
  };
  const quickToggle = () => onThemeChange(resolveQuickToggle(theme));

  return (
    <div className="glass-chrome absolute inset-x-0 top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
      <div className="min-w-0 flex items-center gap-1 overflow-hidden text-sm md:gap-2">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menú de navegación"
            className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const clickable = !isLast && crumb.view;
          const isHome = index === 0;
          return (
            // En movil/tablet (<lg) solo se muestra el inicio, como icono de casa
            // (vuelta al landing); los niveles siguientes se ocultan por redundar
            // con el titulo de la vista (h1) y con la barra inferior. Ahorra espacio.
            <div key={index} className={`min-w-0 items-center gap-2 ${index > 0 ? 'hidden lg:flex' : 'flex'}`}>
              {index > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-border" />}
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.view!)}
                  aria-label={isHome ? 'Ir al inicio' : undefined}
                  className={
                    isHome
                      ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:h-auto lg:w-auto lg:rounded lg:px-0 lg:hover:bg-transparent lg:hover:underline'
                      : '-my-1 truncate rounded py-1 text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                  }
                >
                  {isHome ? (
                    <>
                      <Home className="h-5 w-5 lg:hidden" />
                      <span className="hidden lg:inline">{crumb.label}</span>
                    </>
                  ) : (
                    crumb.label
                  )}
                </button>
              ) : (
                <span className={`truncate transition-colors ${isLast ? 'font-semibold text-accent' : 'text-muted-foreground'}`}>
                  {crumb.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 md:gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('ideam:abrir-buscador'))}
          className="group inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-[border-color,color,transform] duration-150 hover:border-accent/50 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0"
          aria-label="Abrir buscador universal (Ctrl+K)"
        >
          <Search className="anim-wiggle h-4 w-4" />
          <span className="hidden md:inline">Buscar</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold md:inline">⌘K</kbd>
        </button>

        {runtime.isBusy && (
          <button
            type="button"
            onClick={() => onNavigate('extractor')}
            className="hidden items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-left transition-colors duration-150 hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:flex"
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
          className="group inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-muted hover:text-accent active:scale-95 md:h-10 md:w-10"
          title="Cambiar tema"
          aria-label="Cambiar tema rápido"
        >
          {resolveQuickToggle(theme) === 'light' ? <Sun className="anim-wiggle h-5 w-5" /> : <Moon className="anim-wiggle h-5 w-5" />}
        </button>

        <CopyLinkButton />

        {/* Enlaces del proyecto (abren en otra pestaña). Visibles también en móvil
            (paridad con escritorio); el divisor los separa de las acciones. */}
        <span className="mx-0.5 inline-block h-5 w-px bg-border" aria-hidden="true" />
        <a
          href="https://github.com/sergiobc27/ideam-data-automator"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex rounded-lg p-1.5 text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-muted hover:text-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:p-2"
          title="Código en GitHub"
          aria-label="Repositorio del proyecto en GitHub (abre en una pestaña nueva)"
        >
          <Github className="anim-wiggle h-5 w-5" />
        </a>
        <a
          href="https://pypi.org/project/ideam-data-automator/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex rounded-lg p-1.5 text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-muted hover:text-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:p-2"
          title="Paquete en PyPI (ideam-data-automator)"
          aria-label="Paquete en PyPI (abre en una pestaña nueva)"
        >
          <Package className="anim-wiggle h-5 w-5" />
        </a>
        <a
          href="https://www.linkedin.com/in/sergiobeltrancoley/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex rounded-lg p-1.5 text-muted-foreground transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-muted hover:text-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:p-2"
          title="LinkedIn de Sergio Beltrán Coley"
          aria-label="Perfil de LinkedIn de Sergio Beltrán Coley (abre en una pestaña nueva)"
        >
          <Linkedin className="anim-wiggle h-5 w-5" />
        </a>
      </div>

      {runtime.isBusy && (
        <div
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-accent transition-transform duration-300"
          style={{ transform: `scaleX(${Math.max(2, runtime.progress) / 100})` }}
        />
      )}
    </div>
  );
}
