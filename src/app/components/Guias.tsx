import { useEffect, useState } from 'react';
import { MonitorPlay, Info, ExternalLink } from 'lucide-react';
import { Reveal, RevealItem } from './landing/Reveal';

// Videoguías del proyecto. Los MP4 viven en R2 y los sirve el Worker en
// /videos/<id>.mp4 con soporte de Range (ver src/worker/index.js), así que la
// barra de tiempo se puede arrastrar sin descargar el archivo completo. El
// póster es un asset estático (public/videoguias/) para que la tarjeta se vea
// desde el primer momento, antes de tocar el video.
interface Guia {
  id: string;
  titulo: string;
  duracion: string;
  paraQuien: string;
  resumen: string;
  pasos: string[];
}

const GUIAS: Guia[] = [
  {
    id: 'explorar-plataforma-web',
    titulo: 'Explorar la plataforma web',
    duracion: '3 min',
    paraQuien: 'Para consultar y visualizar los datos desde el navegador, sin instalar nada.',
    resumen:
      'Recorrido completo por esta plataforma, de la analítica al extractor. Es la vista de conjunto: qué hay en cada pestaña y cómo se trabaja con las series del IDEAM sin salir del navegador.',
    pasos: [
      'Analítica del espejo y mapa de estaciones',
      'Comparador, curvas IDF y calculadora de caudal',
      'La historia del dato y la metodología detrás de cada fórmula',
      'Extractor: una descarga real de 972.934 filas y su historial',
    ],
  },
  {
    id: 'instalar-desde-pypi',
    titulo: 'Instalar la herramienta desde PyPI',
    duracion: '1 min',
    paraQuien: 'Para descargar series completas a tu computador. Es la vía más corta si ya tienes Python.',
    resumen:
      'Desde la página del proyecto en PyPI: copiar el comando de instalación, pegarlo en PowerShell y abrir la interfaz visual de la herramienta.',
    pasos: [
      'Copiar pip install ideam-data-automator desde PyPI',
      'Pegarlo en PowerShell y esperar a que termine',
      'Abrir la interfaz con ideam-socrata tui y elegir la variable',
    ],
  },
  {
    id: 'instalar-desde-github',
    titulo: 'Instalar siguiendo la guía de GitHub',
    duracion: '1 min',
    paraQuien: 'Para ver el código, citar el proyecto o seguir la guía escrita, captura por captura.',
    resumen:
      'Un paseo por el repositorio y la misma instalación, esta vez con la forma python -m pip install que funciona aunque el PATH de Windows falle.',
    pasos: [
      'El repositorio: código, documentación y releases',
      'La guía del README, paso por paso',
      'python -m pip install ideam-data-automator y abrir la herramienta',
    ],
  },
];

export function Guias() {
  const [destacado, setDestacado] = useState<string | null>(null);

  // Deep-link: /guias#instalar-desde-pypi abre la página en esa guía. Lo usan
  // los enlaces del README en GitHub y en PyPI, que apuntan a una guía concreta.
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setDestacado(id);
    }, 120);
    const t2 = window.setTimeout(() => setDestacado(null), 2800);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <MonitorPlay className="h-6 w-6 text-accent" />
          <h2 className="text-2xl font-bold text-card-foreground">Videoguías</h2>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          El paso a paso en pantalla, sin cortes: cómo se explora esta plataforma y cómo se instala la herramienta
          local por sus dos vías. Empieza por la que se parezca a lo que necesitas hacer.
        </p>
        <div className="mt-3 flex max-w-3xl items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Los videos no llevan narración: son la pantalla real, grabada de corrido. Cada uno trae abajo la lista
            de lo que va mostrando, para que puedas seguirlo o saltar al minuto que te interesa.
          </span>
        </div>
      </div>

      <Reveal className="space-y-6">
        {GUIAS.map((guia) => (
          <TarjetaGuia key={guia.id} guia={guia} destacado={destacado === guia.id} />
        ))}
      </Reveal>

      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-glow">
        <h3 className="mb-2 font-bold text-card-foreground">¿Prefieres leerlo?</h3>
        <p>
          La guía escrita, con una captura por pantalla, está en el repositorio del proyecto. Ahí mismo hay una
          infografía del flujo completo y un instructivo en PDF.
        </p>
        <a
          className="mt-3 inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
          href="https://github.com/sergiobc27/ideam-data-automator"
          target="_blank"
          rel="noreferrer"
        >
          Abrir el repositorio en GitHub
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function TarjetaGuia({ guia, destacado }: { guia: Guia; destacado: boolean }) {
  return (
    <RevealItem>
      {/* scroll-mt para que el deep-link no quede tapado por la navbar overlay. */}
      <article
        id={guia.id}
        className={`scroll-mt-24 overflow-hidden rounded-xl border bg-card shadow-glow transition-colors ${
          destacado ? 'border-accent ring-2 ring-accent' : 'border-border'
        }`}
      >
        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <video
            className="w-full rounded-lg border border-border bg-black"
            src={`/videos/${guia.id}.mp4`}
            poster={`/videoguias/${guia.id}.jpg`}
            controls
            preload="metadata"
            playsInline
            aria-label={`Video: ${guia.titulo}`}
          />
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-card-foreground">{guia.titulo}</h3>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {guia.duracion}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-accent">{guia.paraQuien}</p>
            <p className="mt-2 text-sm text-muted-foreground">{guia.resumen}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {guia.pasos.map((paso) => (
                <li key={paso} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{paso}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </RevealItem>
  );
}
