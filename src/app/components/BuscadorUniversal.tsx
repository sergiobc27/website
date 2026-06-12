import { useEffect, useState } from 'react';
import { MessageCircle, SunMoon } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command';
import { MENU_SECTIONS } from './Sidebar';
import { OPEN_ASISTENTE_EVENT } from './AsistenteFlotante';
import { apiJson } from '../lib/ideamApi';
import { applyTheme, getThemeChoice } from '../lib/theme';
import type { IdfStationsResponse } from '../../shared/ideamContracts';

export const ABRIR_BUSCADOR_EVENT = 'ideam:abrir-buscador';

interface EstacionLigera {
  codigo: string;
  nombre: string;
  municipio: string;
  departamento: string;
}

/**
 * Buscador universal (Ctrl/⌘K): vistas, acciones y estaciones IDF.
 * Las estaciones se cargan UNA vez al primer uso (catálogo ya cacheado en el
 * edge); elegir una salta a Hidrología con la estación restaurada por su
 * deep-link existente (?est=CODIGO).
 */
export function BuscadorUniversal({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [open, setOpen] = useState(false);
  const [estaciones, setEstaciones] = useState<EstacionLigera[] | null>(null);

  useEffect(() => {
    const abrir = () => setOpen(true);
    const porTeclado = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener(ABRIR_BUSCADOR_EVENT, abrir);
    window.addEventListener('keydown', porTeclado);
    return () => {
      window.removeEventListener(ABRIR_BUSCADOR_EVENT, abrir);
      window.removeEventListener('keydown', porTeclado);
    };
  }, []);

  useEffect(() => {
    if (!open || estaciones !== null) return;
    apiJson<IdfStationsResponse>('/api/analytics/idf-stations', undefined, 'sin estaciones')
      .then((r) =>
        setEstaciones(
          (r.stations || []).map((s) => ({
            codigo: s.codigo,
            nombre: s.nombre,
            municipio: s.municipio,
            departamento: s.departamento,
          })),
        ),
      )
      .catch(() => setEstaciones([]));
  }, [open, estaciones]);

  const irA = (view: string) => {
    setOpen(false);
    onNavigate(view);
  };

  const irAEstacion = (codigo: string) => {
    setOpen(false);
    // Deep-link existente de Hidrología: la vista restaura la estación por código.
    window.history.pushState(null, '', `/hydro?est=${encodeURIComponent(codigo)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Buscador" description="Vistas, acciones y estaciones">
      <CommandInput placeholder="Busca vistas, estaciones o acciones…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {MENU_SECTIONS.map((section) => (
          <CommandGroup key={section.title} heading={section.title}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.id} value={`vista ${item.label}`} onSelect={() => irA(item.id)}>
                  <Icon className="text-accent" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Acciones">
          <CommandItem
            value="accion preguntar asistente hidrico chat"
            onSelect={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent(OPEN_ASISTENTE_EVENT));
            }}
          >
            <MessageCircle className="text-accent" />
            Preguntar al Asistente Hídrico
          </CommandItem>
          <CommandItem
            value="accion cambiar tema claro oscuro"
            onSelect={() => {
              const actual = getThemeChoice();
              const oscuroAhora =
                actual === 'dark' ||
                (actual === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              applyTheme(oscuroAhora ? 'light' : 'dark');
              setOpen(false);
            }}
          >
            <SunMoon className="text-accent" />
            Cambiar tema claro/oscuro
          </CommandItem>
        </CommandGroup>
        {estaciones !== null && estaciones.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Estaciones IDF (${estaciones.length})`}>
              {estaciones.map((e) => (
                <CommandItem
                  key={e.codigo}
                  value={`estacion ${e.nombre} ${e.municipio} ${e.departamento} ${e.codigo}`}
                  onSelect={() => irAEstacion(e.codigo)}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{e.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.municipio}, {e.departamento} · {e.codigo}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
