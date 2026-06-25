import { Clock, Zap } from 'lucide-react';

export function SeccionProblemaSolucion() {
  return (
    <section id="landing-proyecto" className="bg-[#fbf7ee] px-6 py-16 dark:bg-[#15110a] md:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-center text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">
          Del problema a la solución
        </p>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Clock className="mb-3 h-6 w-6 text-muted-foreground" />
            <h3 className="font-bold text-card-foreground">Antes · manual</h3>
            <p className="mt-1 text-sm text-muted-foreground">Flujo de Python a PowerBI, días de trabajo por cada consulta.</p>
          </div>
          <div className="text-center text-3xl font-extrabold text-primary">→</div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Zap className="mb-3 h-6 w-6 text-success" />
            <h3 className="font-bold text-card-foreground">Ahora · automático</h3>
            <p className="mt-1 text-sm text-muted-foreground">Plataforma web y paquete local. Resultados en segundos.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-extrabold leading-none text-success">98%</div>
            <div className="mt-1 text-xs text-muted-foreground">menos tiempo</div>
          </div>
        </div>
      </div>
    </section>
  );
}
