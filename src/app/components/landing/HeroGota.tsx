import { useState } from 'react';
import { ArrowRight, ChevronDown, Sun, Moon, Github, Package, Globe } from 'lucide-react';
import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { getThemeChoice, applyTheme, resolveIsDark, type ThemeChoice } from '../../lib/theme';
import { GotaAnimada } from './GotaAnimada';
import { Reveal, RevealItem } from './Reveal';

interface HeroGotaProps {
  onNavigate: (view: string) => void;
}

export function HeroGota({ onNavigate }: HeroGotaProps) {
  const reducido = usePrefersReducedMotion();
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);
  const oscuro = resolveIsDark(theme);
  const cambiarTema = () => {
    const next: ThemeChoice = oscuro ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const bajar = () => {
    document.getElementById('landing-proyecto')?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
  };

  return (
    <header className="relative flex min-h-screen flex-col bg-gradient-to-b from-background to-[#fbf7ee] dark:to-[#15110a]">
      <nav className="flex items-center justify-between px-6 py-4 md:px-10">
        {/* Lockup de co-marca: ambos logos sobre una placa blanca con divisor, a
            alturas balanceadas (la placa CUC es maciza, el emblema IDEAM más alto
            para igualar peso visual). La placa los presenta limpios en claro y oscuro. */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] ring-1 ring-black/5 md:gap-4 md:px-5 md:py-3">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-12 w-auto md:h-14" />
          <span className="h-9 w-px bg-black/10 md:h-11" aria-hidden="true" />
          <img src={logoIdeam} alt="IDEAM, fuente de datos" className="h-12 w-auto md:h-14" />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={cambiarTema}
            className="group rounded-lg p-2 text-muted-foreground transition-transform duration-150 hover:scale-110 hover:text-primary"
            title="Cambiar tema"
            aria-label="Cambiar tema (claro u oscuro)"
          >
            {oscuro ? <Sun className="anim-wiggle h-5 w-5" /> : <Moon className="anim-wiggle h-5 w-5" />}
          </button>
          <a
            href="https://github.com/sergiobc27/ideam-data-automator"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg p-2 text-muted-foreground transition-transform duration-150 hover:scale-110 hover:text-primary"
            title="Código en GitHub"
            aria-label="Repositorio del proyecto en GitHub (abre en una pestaña nueva)"
          >
            <Github className="anim-wiggle h-5 w-5" />
          </a>
          <a
            href="https://pypi.org/project/ideam-data-automator/"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg p-2 text-muted-foreground transition-transform duration-150 hover:scale-110 hover:text-primary"
            title="Paquete en PyPI (ideam-data-automator)"
            aria-label="Paquete en PyPI (abre en una pestaña nueva)"
          >
            <Package className="anim-wiggle h-5 w-5" />
          </a>
          <a
            href="https://sergiobc.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg p-2 text-muted-foreground transition-transform duration-150 hover:scale-110 hover:text-primary"
            title="Sitio personal: sergiobc.com"
            aria-label="Sitio personal de Sergio Beltran Coley (abre en una pestaña nueva)"
          >
            <Globe className="anim-wiggle h-5 w-5" />
          </a>
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
