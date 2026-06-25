import { Suspense, useEffect, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { soporteWebgl } from '../../lib/soporteWebgl';
import { GotaEstatica } from './GotaEstatica';
import { MascotaGota } from './MascotaGota';
import { Reveal, RevealItem } from './Reveal';

const GotaTresD = lazyWithRetry(() => import('./GotaTresD'));

interface HeroGotaProps {
  onNavigate: (view: string) => void;
}

export function HeroGota({ onNavigate }: HeroGotaProps) {
  const reducido = usePrefersReducedMotion();
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    setWebgl(soporteWebgl());
  }, []);
  const usar3d = webgl && !reducido;

  const bajar = () => {
    document.getElementById('landing-proyecto')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  };

  return (
    <header className="relative flex min-h-screen flex-col bg-gradient-to-b from-background to-[#fbf7ee] dark:to-[#15110a]">
      <nav className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-12 w-auto" />
          <span className="text-muted-foreground text-sm">+</span>
          <img src={logoIdeam} alt="IDEAM" className="h-9 w-auto" />
        </div>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#d8c98c] px-4 py-1.5 text-sm font-semibold text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          Entrar <ArrowRight className="h-4 w-4" />
        </button>
      </nav>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-6 py-10 md:grid-cols-2 md:px-10">
        <Reveal className="relative z-10">
          <RevealItem>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Trabajo de grado · Ingeniería Civil
            </p>
          </RevealItem>
          <RevealItem>
            <h2 className="text-balance text-[2.6rem] font-black leading-[1.02] tracking-tight text-foreground md:text-6xl lg:text-7xl">
              Automatización de datos hídricos del <span className="text-primary">IDEAM</span>
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mt-5 max-w-md text-pretty text-base font-normal leading-relaxed text-muted-foreground md:text-lg">
              De millones de registros crudos a datos limpios, curvas IDF y una plataforma viva. En segundos.
            </p>
          </RevealItem>
          <RevealItem>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105"
              >
                Entrar a la plataforma <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={bajar}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8c98c] px-5 py-3 font-semibold text-secondary transition-colors hover:border-primary hover:text-primary"
              >
                Conoce el proyecto <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </RevealItem>
        </Reveal>

        <div className="relative flex items-center justify-center">
          {/* Capa de profundidad media: orbes difuminados detrás de la gota. Decorativos. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-visible">
            <div className="landing-orbe absolute left-1/2 top-1/2 h-64 w-64 -translate-x-[58%] -translate-y-[60%] rounded-full bg-[#A3161A]/25 blur-3xl dark:bg-[#A3161A]/30 md:h-80 md:w-80" />
            <div className="landing-orbe-lento absolute left-1/2 top-1/2 h-56 w-56 -translate-x-[30%] -translate-y-[34%] rounded-full bg-[#C9A227]/25 blur-3xl dark:bg-[#C9A227]/25 md:h-72 md:w-72" />
          </div>
          {/* La gota rompe ligeramente su columna en lg para una composición con tensión. */}
          <div className="relative z-10 h-64 w-64 md:h-80 md:w-80 lg:scale-110 lg:-translate-x-2">
            {usar3d ? (
              <Suspense fallback={<GotaEstatica />}>
                <GotaTresD />
              </Suspense>
            ) : (
              <GotaEstatica />
            )}
          </div>
          <MascotaGota size={92} className="landing-flota absolute -bottom-2 right-0 z-10 md:-right-4" />
        </div>
      </div>

      <button type="button" onClick={bajar} aria-label="Bajar a conocer el proyecto" className="mx-auto mb-6 text-muted-foreground">
        <ChevronDown className="landing-flota h-7 w-7" />
      </button>
    </header>
  );
}
