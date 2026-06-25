interface LandingProps {
  onNavigate: (view: string) => void;
}

// Placeholder navegable; se reemplaza por la landing completa en la Task 10.
export function Landing({ onNavigate }: LandingProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center text-foreground">
      <h1 className="text-3xl font-extrabold">Automatización de datos hídricos del IDEAM</h1>
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground"
      >
        Entrar a la plataforma
      </button>
    </div>
  );
}
