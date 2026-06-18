import { useEffect, useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { seleccionarCuriosidades, siguienteIndice } from '../lib/curiosidades';

const ROTACION_MS = 6500;
// Anti-flash: no montar el panel si la espera es muy corta (parpadeo).
const ANTI_FLASH_MS = 800;

/**
 * Datos curiosos contextuales que rotan durante la espera de la descarga.
 * Ocupa el tiempo de espera (Maister) sin estorbar el progreso real.
 * Accesibilidad: el panel va aria-hidden (el estado real ya se anuncia en el
 * progressbar); las animaciones se desactivan solas con prefers-reduced-motion
 * (definido en theme.css).
 */
export function CuriosidadEspera({
  activo,
  esPrecipitacion,
  departamentos,
}: {
  activo: boolean;
  esPrecipitacion: boolean;
  departamentos: string[];
}) {
  const curiosidades = useMemo(
    () => seleccionarCuriosidades({ esPrecipitacion, departamentos }),
    [esPrecipitacion, departamentos]
  );
  const [visible, setVisible] = useState(false);
  const [indice, setIndice] = useState(0);

  // Anti-flash: solo aparecer si la espera supera ANTI_FLASH_MS.
  useEffect(() => {
    if (!activo) {
      setVisible(false);
      return undefined;
    }
    const t = window.setTimeout(() => setVisible(true), ANTI_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [activo]);

  // Reinicia el índice cuando cambian las curiosidades (cambió variable/depto).
  useEffect(() => {
    setIndice(0);
  }, [curiosidades]);

  // Rotación periódica sin repetir el último.
  useEffect(() => {
    if (!visible || curiosidades.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndice((actual) => siguienteIndice(actual, curiosidades.length));
    }, ROTACION_MS);
    return () => window.clearInterval(id);
  }, [visible, curiosidades.length]);

  if (!visible || curiosidades.length === 0) return null;
  const actual = curiosidades[Math.min(indice, curiosidades.length - 1)];

  return (
    <div
      className="animate-fade-in-up flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4"
      aria-hidden="true"
    >
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent">¿Sabías que…?</p>
        <p key={indice} className="mt-1 animate-fade-in-up text-sm leading-relaxed text-card-foreground">
          {actual.texto}
        </p>
      </div>
    </div>
  );
}

export default CuriosidadEspera;
