import { ArrowRight, BookOpen } from 'lucide-react';
import { MascotaGota } from './MascotaGota';
import { BotonCelebracion } from './BotonCelebracion';

interface CierreConfetiProps {
  onNavigate: (view: string) => void;
}

export function CierreConfeti({ onNavigate }: CierreConfetiProps) {
  return (
    <section className="relative overflow-hidden bg-[#15110a] px-6 py-20 text-center md:px-10">
      <div className="mx-auto max-w-3xl">
        <MascotaGota size={110} className="landing-flota mx-auto mb-6" />
        <h2 className="text-3xl font-extrabold text-[#f5edda] md:text-4xl">
          Los datos abiertos también se celebran
        </h2>
        <p className="mt-3 text-[#bdb39a]">
          Entra a explorar la plataforma, o lánzate un pequeño festejo.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:scale-105"
          >
            Entrar a la plataforma <ArrowRight className="h-5 w-5" />
          </button>
          <BotonCelebracion />
        </div>
        <button
          type="button"
          onClick={() => onNavigate('historia')}
          className="mx-auto mt-6 inline-flex items-center gap-1.5 text-sm text-[#d8c98c] underline-offset-4 hover:underline"
        >
          <BookOpen className="h-4 w-4" /> Lee la historia completa del dato
        </button>
      </div>
    </section>
  );
}
