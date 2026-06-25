import { HeroGota } from './HeroGota';
import { SeccionProblemaSolucion } from './SeccionProblemaSolucion';
import { SeccionQueHace } from './SeccionQueHace';
import { SeccionCifras } from './SeccionCifras';
import { SeccionCreditos } from './SeccionCreditos';
import { CierreConfeti } from './CierreConfeti';

interface LandingProps {
  onNavigate: (view: string) => void;
}

// Portada del proyecto: institucional arriba, más ilustrada y lúdica hacia abajo,
// cerrando con la celebración. Pantalla completa propia (App no monta el chrome
// del panel para la vista 'landing'). Un solo <h1> para toda la página.
export function Landing({ onNavigate }: LandingProps) {
  return (
    <div className="landing h-screen overflow-y-auto bg-background text-foreground scrollbar-thin scrollbar-track-transparent">
      <h1 className="sr-only">Automatización de datos hídricos del IDEAM, trabajo de grado de Sergio Beltran Coley</h1>
      <HeroGota onNavigate={onNavigate} />
      <SeccionProblemaSolucion />
      <SeccionQueHace />
      <SeccionCifras />
      <SeccionCreditos />
      <CierreConfeti onNavigate={onNavigate} />
    </div>
  );
}
