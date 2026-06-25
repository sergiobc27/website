import logoCuc from '../../../imports/Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png';
import logoIdeam from '../../../imports/Ideam_(Colombia)_logo.png';

export function SeccionCreditos() {
  return (
    <section className="px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-8 text-xs font-extrabold uppercase tracking-[0.16em] text-secondary">Créditos</p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          <img src={logoCuc} alt="Universidad de la Costa CUC" className="h-16 w-auto" />
          <img src={logoIdeam} alt="IDEAM, fuente de datos" className="h-12 w-auto" />
        </div>
        <p className="mt-8 text-lg text-foreground">
          Creado por <span className="font-bold">Sergio Beltran Coley</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Universidad de la Costa CUC · Datos abiertos del IDEAM
        </p>
      </div>
    </section>
  );
}
