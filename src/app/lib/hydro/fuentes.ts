import { REFERENCIAS, type Referencia } from '../referencias';

/** Cita a una fuente del proyecto con el localizador EXACTO dentro de ella. */
export interface Fuente {
  /** id en REFERENCIAS (p. ej. 'invias-drenaje-2009', 'ras-0330', 'chow-applied-1988'). */
  ref: string;
  /** Localizador exacto: "Tabla 2.9 (pág. 2-39)", "Art. 135, Tabla 16", etc. */
  localizador: string;
  /** true solo si el localizador se confirmó contra la fuente primaria. */
  verificado: boolean;
  /** Nota honesta cuando verificado=false (qué falta por confirmar). */
  nota?: string;
}

export function referenciaDe(ref: string): Referencia | undefined {
  return REFERENCIAS.find((r) => r.id === ref);
}
