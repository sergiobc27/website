import { Clock, Zap } from 'lucide-react';
import { Reveal, RevealItem } from './Reveal';

export function SeccionProblemaSolucion() {
  return (
    <section id="landing-proyecto" className="bg-[#fbf7ee] px-6 py-16 dark:bg-[#15110a] md:px-10">
      <Reveal className="mx-auto max-w-5xl">
        <RevealItem>
          <p className="mb-8 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">
            Del problema a la solución
          </p>
        </RevealItem>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto]">
          <RevealItem className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-glow">
            <Clock className="mb-3 h-7 w-7 text-muted-foreground transition-transform duration-300 group-hover:scale-125" />
            <h3 className="font-bold text-card-foreground">Antes · manual</h3>
            <p className="mt-1 text-sm text-muted-foreground">Flujo de Python a PowerBI, días de trabajo por cada consulta.</p>
          </RevealItem>
          <RevealItem className="text-center text-4xl font-black text-primary">→</RevealItem>
          <RevealItem className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-glow">
            <Zap className="mb-3 h-7 w-7 text-success transition-transform duration-300 group-hover:scale-125" />
            <h3 className="font-bold text-card-foreground">Ahora · automático</h3>
            <p className="mt-1 text-sm text-muted-foreground">Plataforma web y paquete local. Resultados en segundos.</p>
          </RevealItem>
          <RevealItem className="text-center">
            <div className="text-6xl font-black leading-none text-success md:text-7xl">98%</div>
            <div className="mt-2 text-xs font-medium text-muted-foreground md:text-sm">menos tiempo</div>
          </RevealItem>
        </div>
      </Reveal>
    </section>
  );
}
