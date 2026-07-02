import { Calculator, Database, TrendingUp, Download, MessageCircle } from 'lucide-react';
import { Reveal, RevealItem } from './Reveal';

// Iconos alineados a la iconografía del panel lateral (Database = Extractor,
// Calculator = Calculadora de caudal (Hidrología), TrendingUp = Analítica,
// Download = Historial/descargas, MessageCircle = Asistente), para que la
// portada y el panel hablen el mismo idioma.
// Cada tarjeta con `view` navega a esa vista del panel (verbo de acción en el
// título: la calculadora de caudal es el entregable núcleo y debe ser
// alcanzable desde la portada, no solo tras explorar Hidrología).
const CAPACIDADES = [
  { icon: Database, titulo: 'Datos limpios', texto: 'Series del IDEAM saneadas y listas para usar.', view: 'extractor' },
  { icon: Calculator, titulo: 'Calcula el caudal de tu obra', texto: 'Dimensiona drenaje con curvas IDF reales, C y Manning.', view: 'hydro' },
  { icon: TrendingUp, titulo: 'Mapa y analítica', texto: 'Explora estaciones, climas y tendencias por región.', view: 'analytics' },
  { icon: Download, titulo: 'Extractor local', texto: 'Paquete de terminal (CLI y TUI) para descargar a tu PC.', view: 'extractor' },
  { icon: MessageCircle, titulo: 'Asistente de IA', texto: 'Pregúntale a tus datos en lenguaje natural.', view: 'dashboard' },
];

export function SeccionQueHace({ onNavigate }: { onNavigate?: (view: string) => void }) {
  return (
    <section className="px-6 py-16 md:px-10">
      <Reveal className="mx-auto max-w-6xl">
        <RevealItem>
          <p className="mb-10 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
            Qué hace la plataforma
          </p>
        </RevealItem>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CAPACIDADES.map(({ icon: Icon, titulo, texto, view }, i) => (
            <RevealItem key={titulo}>
              <button
                type="button"
                onClick={onNavigate ? () => onNavigate(view) : undefined}
                className="group w-full rounded-2xl border border-border bg-card p-5 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-secondary hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                {/* El wrapper flota en bucle (stagger por tarjeta); el icono crece y se
                    tiñe al pasar el mouse. Transforms en elementos distintos para no
                    pisarse. La flotación la neutraliza prefers-reduced-motion. */}
                <span className="anim-float mb-3 inline-flex" style={{ animationDelay: `${i * 0.25}s` }}>
                  <Icon className="h-9 w-9 text-secondary transition-transform duration-300 group-hover:scale-125 group-hover:text-primary" />
                </span>
                <h3 className="font-bold text-card-foreground">{titulo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
              </button>
            </RevealItem>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
