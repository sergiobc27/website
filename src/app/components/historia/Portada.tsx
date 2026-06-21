import { Droplets } from 'lucide-react';
import type { HistoriaIdfData } from '../../lib/historia';
import type { CapituloContenido } from './contenido';

/**
 * Cubierta del libro = el Capítulo I tratado como portada a altura completa.
 * No duplica el gancho: lo presenta con peso (título del libro + la pregunta +
 * la ficha de la estación). Lleva el id del capítulo I para el índice/stepper.
 */
export function Portada({
  cap,
  data,
  seccionRef,
}: {
  cap: CapituloContenido;
  data: HistoriaIdfData;
  seccionRef: (el: HTMLElement | null) => void;
}) {
  const est = data.estacion;
  return (
    <section
      id={cap.id}
      data-escena={1}
      ref={seccionRef}
      aria-label={`Capítulo 1: ${cap.titulo}`}
      className="hl-portada"
    >
      <span className="hl-badge">Universidad de la Costa · IDEAM</span>
      <p className="hl-kicker hl-kicker-centro">
        <span className="hl-filete" /> El viaje de una gota de dato <span className="hl-filete" />
      </p>
      <Droplets className="anim-float hl-portada-gota" />
      <h2 className="hl-portada-titulo">La historia del dato</h2>
      <p className="hl-portada-pregunta">{cap.titulo}</p>
      <div className="hl-portada-lead">{cap.cuerpo}</div>

      <div className="hl-ficha">
        <Celda k="Estación" v={est.nombre} />
        <Celda k="Ubicación" v={`${est.municipio}, ${est.departamento}`} />
        <Celda k="Años de registro" v={String(est.aniosValidos)} />
        <Celda k="Resolución" v="10 minutos" />
      </div>

      <p className="hl-hint">
        Desplázate para abrir el libro <span className="hl-hint-flecha">↓</span>
      </p>
    </section>
  );
}

function Celda({ k, v }: { k: string; v: string }) {
  return (
    <div className="hl-ficha-celda">
      <p className="hl-ficha-k">{k}</p>
      <p className="hl-ficha-v">{v}</p>
    </div>
  );
}
