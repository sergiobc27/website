import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, ExternalLink } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { referenciaDe, type Fuente } from '../../lib/hydro/fuentes';
import { pdfUrl, doiDe } from '../../lib/referencias';
import { VisorPdf } from '../VisorPdf';

/** Muestra "INVÍAS (2009), Tabla 2.9" con tooltip de la cita APA completa y, si
 * la fuente tiene PDF hospedado, un botón "Ver PDF" que abre el visor embebido.
 * Si la fuente no está verificada, lo dice de forma honesta (no inventa). */
export function CitaFuente({ fuente }: { fuente: Fuente }) {
  const ref = referenciaDe(fuente.ref);
  const [ver, setVer] = useState(false);
  const autorAnio = ref ? `${ref.apa.split('(')[0].trim()} (${ref.anio})` : fuente.ref;
  const etiqueta = `${autorAnio}, ${fuente.localizador}`;
  const tienePdf = ref ? !!pdfUrl(ref.id) : false;
  const doi = doiDe(ref);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Tooltip content={ref?.apa ?? 'Referencia no encontrada'}>
        <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2">
          Fuente: {etiqueta}
          {!fuente.verificado && (
            <span className="text-amber-400" title={fuente.nota ?? 'Localizador por confirmar'}>
              (localizador por confirmar)
            </span>
          )}
        </span>
      </Tooltip>
      {ref?.url && (
        <a
          href={ref.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-mono text-[10px] text-accent hover:underline"
          title={doi ? `DOI: ${doi}` : ref.url}
        >
          {doi ? `DOI: ${doi}` : 'fuente'}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {tienePdf && ref && (
        <motion.button
          type="button"
          onClick={() => setVer(true)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-inset ring-accent/30 transition-colors hover:bg-accent/20"
          aria-label={`Ver PDF: ${ref.apa}`}
        >
          <FileText className="h-3 w-3" /> Ver PDF
        </motion.button>
      )}
      {ver && ref && <VisorPdf refId={ref.id} onClose={() => setVer(false)} />}
    </span>
  );
}
