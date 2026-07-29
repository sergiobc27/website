import type { FiabilidadNivel } from '../../shared/ideamContracts';

/**
 * Semáforo de fiabilidad del registro de la estación (largo, completitud y
 * estacionariedad). Vivía suelto dentro de la tarjeta de períodos de retorno, así
 * que la curva IDF y la calculadora de caudal, que dependen del MISMO registro,
 * se veían sin ninguna señal de su calidad. Aquí queda como pieza reutilizable
 * para acompañar a las tres.
 */
const CONFIG: Record<FiabilidadNivel, { cls: string; label: string }> = {
  verde: { cls: 'border-success/40 bg-success/10 text-success', label: 'Alta' },
  amarillo: { cls: 'border-accent/40 bg-accent/10 text-accent', label: 'Media' },
  rojo: { cls: 'border-red-500/40 bg-red-500/10 text-red-500', label: 'Baja' },
};

export function InsigniaFiabilidad({
  nivel,
  razones,
}: {
  nivel: FiabilidadNivel;
  razones?: string[];
}) {
  const cfg = CONFIG[nivel];
  return (
    <span
      title={
        razones && razones.length
          ? razones.join(' · ')
          : 'Registro largo, completo y estacionario.'
      }
      className={`cursor-help rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
    >
      Fiabilidad: {cfg.label}
    </span>
  );
}
