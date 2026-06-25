interface GotaEstaticaProps {
  className?: string;
}

// Respaldo de la gota 3D para equipos sin WebGL o con "reducir movimiento".
// Es una escena física (azul agua): colores fijos, no se invierte en dark mode.
export function GotaEstatica({ className = '' }: GotaEstaticaProps) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Gota de agua" className={`h-full w-full ${className}`}>
      <defs>
        <radialGradient id="gota-estatica-grad" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#cfeeff" />
          <stop offset="55%" stopColor="#2b8fd6" />
          <stop offset="100%" stopColor="#155a92" />
        </radialGradient>
      </defs>
      <path d="M100 18 C100 18 36 96 36 132 a64 64 0 0 0 128 0 C164 96 100 18 100 18 Z" fill="url(#gota-estatica-grad)" />
      <ellipse cx="74" cy="108" rx="15" ry="26" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
