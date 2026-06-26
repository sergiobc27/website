import { Database, Droplets, TrendingUp, Download, MessageCircle } from 'lucide-react';
import { Reveal, RevealItem } from './Reveal';

// Iconos alineados a la iconografía del panel lateral (Database = Extractor,
// Droplets = Hidrología, TrendingUp = Analítica, Download = Historial/descargas,
// MessageCircle = Asistente), para que la portada y el panel hablen el mismo idioma.
const CAPACIDADES = [
  { icon: Database, titulo: 'Datos limpios', texto: 'Series del IDEAM saneadas y listas para usar.' },
  { icon: Droplets, titulo: 'Curvas IDF reales', texto: 'Intensidad, duración y frecuencia desde datos sub-horarios.' },
  { icon: TrendingUp, titulo: 'Mapa y analítica', texto: 'Explora estaciones, climas y tendencias por región.' },
  { icon: Download, titulo: 'Extractor local', texto: 'Paquete de terminal (CLI y TUI) para descargar a tu PC.' },
  { icon: MessageCircle, titulo: 'Asistente de IA', texto: 'Pregúntale a tus datos en lenguaje natural.' },
];

export function SeccionQueHace() {
  return (
    <section className="px-6 py-16 md:px-10">
      <Reveal className="mx-auto max-w-6xl">
        <RevealItem>
          <p className="mb-10 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
            Qué hace la plataforma
          </p>
        </RevealItem>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CAPACIDADES.map(({ icon: Icon, titulo, texto }, i) => (
            <RevealItem key={titulo} className="group rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-secondary hover:shadow-glow">
              {/* El wrapper flota en bucle (stagger por tarjeta); el icono crece y se
                  tiñe al pasar el mouse. Transforms en elementos distintos para no
                  pisarse. La flotación la neutraliza prefers-reduced-motion. */}
              <span className="anim-float mb-3 inline-flex" style={{ animationDelay: `${i * 0.25}s` }}>
                <Icon className="h-9 w-9 text-secondary transition-transform duration-300 group-hover:scale-125 group-hover:text-primary" />
              </span>
              <h3 className="font-bold text-card-foreground">{titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
            </RevealItem>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
