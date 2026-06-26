import { ArrowRight, ChevronDown } from 'lucide-react';
import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { GotaAnimada } from './GotaAnimada';
import { Reveal, RevealItem } from './Reveal';

interface HeroGotaProps {
  onNavigate: (view: string) => void;
}

export function HeroGota({ onNavigate }: HeroGotaProps) {
  const reducido = usePrefersReducedMotion();

  const bajar = () => {
    document.getElementById('landing-proyecto')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  };

  return (
    <header className="relative flex min-h-screen flex-col bg-gradient-to-b from-background to-[#fbf7ee] dark:to-[#15110a]">
      <nav className="flex items-center px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-12 w-auto" />
          <span className="text-muted-foreground text-sm">+</span>
          <img src={logoIdeam} alt="IDEAM" className="h-9 w-auto" />
        </div>
      </nav>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-6 py-10 md:grid-cols-2 md:px-10">
        <Reveal className="relative z-10">
          <RevealItem>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Trabajo de grado · Ingeniería Civil
            </p>
          </RevealItem>
          <RevealItem>
            <h2 className="text-balance text-[2.4rem] font-black leading-[1.04] tracking-tight text-foreground sm:text-5xl md:text-6xl">
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

        <div className="relative flex min-h-[22rem] items-center justify-center md:min-h-[26rem]">
          {/* Capa de fondo: resplandor azul centrado + ondas concéntricas que emanan
              de la gota (una gota cayendo al agua). Decorativo. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-visible">
            <div className="hero-glow absolute h-72 w-72 rounded-full bg-[#3a9fe0]/30 blur-3xl dark:bg-[#3a9fe0]/22 md:h-[24rem] md:w-[24rem]" />
            <span className="onda-anillo" />
            <span className="onda-anillo onda-anillo-2" />
            <span className="onda-anillo onda-anillo-3" />
          </div>
          {/* La gota es el foco único: más grande, con halo azul. */}
          <div className="relative z-10 h-72 w-72 [filter:drop-shadow(0_18px_34px_rgba(43,143,214,0.4))] md:h-[24rem] md:w-[24rem] lg:scale-105">
            <GotaAnimada />
          </div>
        </div>
      </div>

      <button type="button" onClick={bajar} aria-label="Bajar a conocer el proyecto" className="mx-auto mb-6 text-muted-foreground">
        <ChevronDown className="landing-flota h-7 w-7" />
      </button>
    </header>
  );
}
