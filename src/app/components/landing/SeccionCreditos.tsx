import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';
import { Reveal, RevealItem } from './Reveal';

export function SeccionCreditos() {
  return (
    <section className="px-6 py-16 md:px-10">
      <Reveal className="mx-auto max-w-4xl text-center">
        <RevealItem>
          <p className="mb-8 text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">Créditos</p>
        </RevealItem>
        <RevealItem className="flex flex-wrap items-center justify-center gap-8">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-16 w-auto" />
          <img src={logoIdeam} alt="IDEAM, fuente de datos" className="h-12 w-auto" />
        </RevealItem>
        <RevealItem>
          <p className="mt-8 text-lg text-foreground">
            Creado por <span className="font-bold">Sergio Beltran Coley</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Universidad de la Costa CUC · Datos abiertos del IDEAM
          </p>
        </RevealItem>
      </Reveal>
    </section>
  );
}
