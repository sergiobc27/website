import { Droplets, LineChart, Map, Terminal, Bot } from 'lucide-react';
import { Reveal, RevealItem } from './Reveal';

const CAPACIDADES = [
  { icon: Droplets, titulo: 'Datos limpios', texto: 'Series del IDEAM saneadas y listas para usar.' },
  { icon: LineChart, titulo: 'Curvas IDF reales', texto: 'Intensidad, duración y frecuencia desde datos sub-horarios.' },
  { icon: Map, titulo: 'Mapa y analítica', texto: 'Explora estaciones, climas y tendencias por región.' },
  { icon: Terminal, titulo: 'Extractor local', texto: 'Paquete de terminal (CLI y TUI) para descargar a tu PC.' },
  { icon: Bot, titulo: 'Asistente de IA', texto: 'Pregúntale a tus datos en lenguaje natural.' },
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
          {CAPACIDADES.map(({ icon: Icon, titulo, texto }) => (
            <RevealItem key={titulo} className="group rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-1">
              <Icon className="anim-bounce mb-3 h-7 w-7 text-secondary" />
              <h3 className="font-bold text-card-foreground">{titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
            </RevealItem>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
