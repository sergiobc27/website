import { Link2 } from 'lucide-react';
import { toast } from 'sonner';

// Copia la URL actual (que ya incluye el estado de la vista en la query).
export function CopyLinkButton() {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar; copia la dirección manualmente desde la barra del navegador');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-10 md:w-10"
      title="Copiar enlace de esta vista"
      aria-label="Copiar enlace de esta vista"
    >
      <Link2 className="h-5 w-5" />
    </button>
  );
}
