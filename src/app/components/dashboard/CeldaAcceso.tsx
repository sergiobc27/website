import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { Celda } from './Celda';

interface CeldaAccesoProps {
  icon: LucideIcon;
  titulo: string;
  subtitulo: string;
  ariaLabel: string;
  onClick: () => void;
  indice?: number;
  className?: string;
}

/** Celda pequeña de acceso directo: icono + título + subtítulo. */
export function CeldaAcceso({ icon: Icon, titulo, subtitulo, ariaLabel, onClick, indice, className }: CeldaAccesoProps) {
  return (
    <Celda ariaLabel={ariaLabel} onClick={onClick} indice={indice} className={className}>
      <div className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex items-start justify-between">
          <Icon className="h-6 w-6 text-accent" />
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent" />
        </div>
        <div>
          <p className="font-bold text-card-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground">{subtitulo}</p>
        </div>
      </div>
    </Celda>
  );
}
