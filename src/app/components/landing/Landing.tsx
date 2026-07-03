import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { HeroGota } from './HeroGota';
import { SeccionProblemaSolucion } from './SeccionProblemaSolucion';
import { SeccionQueHace } from './SeccionQueHace';
import { SeccionCifras } from './SeccionCifras';
import { SeccionCreditos } from './SeccionCreditos';
import { CierreConfeti } from './CierreConfeti';
import { OndaDivisor } from './OndaDivisor';
import { OndasClic } from './OndasClic';
import { LloviznaLigera } from './LloviznaLigera';

interface LandingProps {
  onNavigate: (view: string) => void;
}

// Portada del proyecto: institucional arriba, más ilustrada y lúdica hacia abajo,
// cerrando con la celebración. Pantalla completa propia (App no monta el chrome
// del panel para la vista 'landing'). Un solo <h1> para toda la página.
// MotionConfig reducedMotion="user" centraliza el respeto a prefers-reduced-motion
// para todas las animaciones de motion de la landing (WCAG 2.3.3).
export function Landing({ onNavigate }: LandingProps) {
  const reducido = usePrefersReducedMotion();

  // Resplandor que sigue el cursor por toda la portada: un mousemove actualiza
  // las variables CSS de posición (coords de viewport). No se monta con
  // prefers-reduced-motion.
  useEffect(() => {
    if (reducido) return;
    const onMove = (e: MouseEvent) => {
      const root = document.documentElement;
      root.style.setProperty('--cursor-x', `${e.clientX}px`);
      root.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [reducido]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing h-screen overflow-y-auto bg-background text-foreground scrollbar-thin scrollbar-track-transparent">
        <LloviznaLigera />
        {!reducido && <div className="cursor-glow" aria-hidden />}
        <OndasClic />
        <h1 className="sr-only">Automatización de datos hídricos del IDEAM, trabajo de grado de Sergio Beltran Coley</h1>
        <HeroGota onNavigate={onNavigate} />
        <SeccionProblemaSolucion />
        <SeccionQueHace onNavigate={onNavigate} />
        {/* QueHace (bg-background) → Cifras (banda cálida). El agua cálida sube
            hacia la sección neutra. Colores = bgs reales de ambas secciones. */}
        <OndaDivisor
          colorArriba="#ffffff"
          colorAbajo="#fbf7ee"
          colorArribaDark="#0f0f0f"
          colorAbajoDark="#15110a"
        />
        <SeccionCifras />
        <SeccionCreditos />
        {/* Créditos (bg-background) → Cierre (noche #15110a en ambos modos). El
            agua oscura sube: el dato fluye hacia la noche de la celebración. */}
        <OndaDivisor
          colorArriba="#ffffff"
          colorAbajo="#15110a"
          colorArribaDark="#0f0f0f"
          colorAbajoDark="#15110a"
        />
        <CierreConfeti onNavigate={onNavigate} />
      </div>
    </MotionConfig>
  );
}
