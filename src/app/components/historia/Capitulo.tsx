import type { ReactNode } from 'react';
import { aRomano, TOTAL_ESCENAS, type HistoriaIdfData } from '../../lib/historia';
import { GraficaViva } from './GraficaViva';
import { Lamina } from './Lamina';
import type { CapituloContenido } from './contenido';

const PALABRAS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'];

/**
 * Un capítulo del libro (escenas II–VIII): cabecera con numeral romano, título,
 * cuerpo serif con capitular, y su lámina (gráfica enmarcada). En escritorio es
 * un "spread" de dos columnas (texto + lámina); en móvil se apila (lámina y luego
 * texto). `children` se usa para el epílogo del capítulo VIII (los CTAs).
 */
export function Capitulo({
  cap,
  data,
  seccionRef,
  children,
}: {
  cap: CapituloContenido;
  data: HistoriaIdfData;
  seccionRef: (el: HTMLElement | null) => void;
  children?: ReactNode;
}) {
  return (
    <section
      id={cap.id}
      data-escena={cap.n}
      ref={seccionRef}
      aria-label={`Capítulo ${cap.n}: ${cap.titulo}`}
      className="hl-capitulo"
    >
      <header className="hl-cabecera">
        <p className="hl-kicker">
          Capítulo {aRomano(cap.n)} <span className="hl-kicker-de">· de {aRomano(TOTAL_ESCENAS)}</span>
        </p>
        <h2 className="hl-titulo">{cap.titulo}</h2>
      </header>

      <div className="hl-spread">
        <div className="hl-texto">
          {cap.cuerpo}
          {children}
        </div>
        <div className="hl-col-lamina">
          <Lamina caption={cap.captionLamina}>
            <GraficaViva escena={cap.n} data={data} />
          </Lamina>
        </div>
      </div>

      <span className="hl-folio">capítulo {PALABRAS[cap.n] ?? cap.n}</span>
    </section>
  );
}
