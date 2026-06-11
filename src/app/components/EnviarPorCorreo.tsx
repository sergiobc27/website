import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Turnstile } from './Turnstile';
import { apiUrl } from '../lib/ideamApi';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  stationCode: string;
  // Genera el PDF on-demand y lo devuelve como base64 (sin prefijo dataURL) + filename.
  generarPdfBase64: () => Promise<{ base64: string; filename: string }>;
}

export function EnviarPorCorreo({ open, onOpenChange, stationName, stationCode, generarPdfBase64 }: Props) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());
  const puedeEnviar = emailOk && !!token && !busy;

  const enviar = async () => {
    if (!puedeEnviar) return;
    setBusy(true);
    try {
      const { base64, filename } = await generarPdfBase64();
      const res = await fetch(apiUrl('/api/email-idf'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: email.trim(),
          turnstileToken: token,
          pdfBase64: base64,
          filename,
          stationName,
          stationCode,
        }),
      });
      if (res.status === 429) {
        toast.error('Demasiados envíos. Intenta de nuevo en un rato.');
      } else if (!res.ok) {
        toast.error('No se pudo enviar el correo. Usa el botón Descargar PDF.');
      } else {
        toast.success('Te lo enviamos a tu correo');
        onOpenChange(false);
        setEmail('');
        setToken(null);
      }
    } catch {
      toast.error('No se pudo enviar el correo. Usa el botón Descargar PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar curvas IDF por correo</DialogTitle>
          <DialogDescription>
            Estación: {stationName}. Te llega el PDF como adjunto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="correo-idf" className="mb-1 block text-sm font-medium text-card-foreground">Tu correo</label>
            <input
              id="correo-idf"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-card-foreground outline-none focus:border-accent"
            />
          </div>
          <Turnstile onToken={setToken} />
          <button
            type="button"
            onClick={enviar}
            disabled={!puedeEnviar}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-accent px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
