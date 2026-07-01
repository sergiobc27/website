import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { FileText, X, ExternalLink, Info } from 'lucide-react';
import { REFERENCIAS, pdfUrl, PDF_NOTAS } from '../lib/referencias';

/**
 * Visor de PDF embebido y animado, compartido por la biblioteca de referencias,
 * las citas (`CitaFuente`) y la metodología. Se sirve desde R2 en /fuentes/<id>.pdf.
 * Se renderiza por portal en <body> para sobreponerse a popovers/diálogos y
 * sobrevivir aunque el popover que lo abrió se cierre.
 */
export function VisorPdf({ refId, onClose }: { refId: string; onClose: () => void }) {
  const ref = REFERENCIAS.find((r) => r.id === refId);
  const src = pdfUrl(refId);
  const nota = PDF_NOTAS[refId];

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!ref || !src) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`PDF: ${ref.apa}`}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-accent/40 bg-card shadow-glow"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        {/* Barra de acento que se dibuja al abrir. */}
        <motion.div
          className="h-1 w-full bg-gradient-to-r from-accent/30 via-accent to-accent/30"
          style={{ transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div className="flex items-start gap-3 border-b border-border p-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <FileText className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 text-xs leading-snug text-card-foreground">{ref.apa}</p>
          <motion.a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Abrir <ExternalLink className="h-3.5 w-3.5" />
          </motion.a>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-1 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            aria-label="Cerrar visor"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
        {nota && (
          <p className="flex items-start gap-2 border-b border-border bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {nota}
          </p>
        )}
        <iframe src={src} title={ref.apa} className="min-h-0 w-full flex-1 bg-white" />
      </motion.div>
    </motion.div>,
    document.body,
  );
}
