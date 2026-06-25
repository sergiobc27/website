interface GotaAnimadaProps {
  className?: string;
}

// Gota de agua del hero: SVG puro con aspecto de vidrio/agua (degradado de cuerpo,
// destello especular, luz de borde inferior, brillo que recorre y burbujas que
// suben). Sin WebGL: fiable en cualquier equipo y determinista. Es una escena
// física (azul agua), por eso usa hex fijos y NO se invierte en modo oscuro.
// Las animaciones (flotación, brillo, burbujas) son CSS scoped en theme.css y el
// bloque global de prefers-reduced-motion las neutraliza.
export function GotaAnimada({ className = '' }: GotaAnimadaProps) {
  const cuerpo = 'M100 14 C100 14 38 104 38 150 a62 62 0 0 0 124 0 C162 104 100 14 100 14 Z';
  return (
    <svg viewBox="0 0 200 236" role="img" aria-label="Gota de agua" className={`gota-animada h-full w-full ${className}`}>
      <defs>
        <radialGradient id="ga-cuerpo" cx="38%" cy="30%" r="82%">
          <stop offset="0%" stopColor="#f1fbff" />
          <stop offset="30%" stopColor="#9fd6f5" />
          <stop offset="62%" stopColor="#3a9fe0" />
          <stop offset="100%" stopColor="#15598f" />
        </radialGradient>
        <linearGradient id="ga-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ga-rim" cx="50%" cy="84%" r="46%">
          <stop offset="70%" stopColor="#cdeeff" stopOpacity="0" />
          <stop offset="100%" stopColor="#d6f1ff" stopOpacity="0.75" />
        </radialGradient>
        <clipPath id="ga-clip">
          <path d={cuerpo} />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="222" rx="44" ry="8" fill="#15598f" opacity="0.18" />

      <g className="gota-flota">
        <path d={cuerpo} fill="url(#ga-cuerpo)" />
        <path d={cuerpo} fill="url(#ga-rim)" />
        <path d={cuerpo} fill="url(#ga-sheen)" />

        <g clipPath="url(#ga-clip)">
          <rect className="gota-shimmer" x="0" y="-10" width="46" height="256" fill="#ffffff" opacity="0.16" />
          <circle className="gota-burbuja gota-burbuja-1" cx="116" cy="168" r="4" fill="#eaf9ff" opacity="0.7" />
          <circle className="gota-burbuja gota-burbuja-2" cx="90" cy="182" r="2.6" fill="#eaf9ff" opacity="0.55" />
          <circle className="gota-burbuja gota-burbuja-3" cx="104" cy="190" r="3.2" fill="#eaf9ff" opacity="0.6" />
        </g>

        <ellipse cx="78" cy="118" rx="15" ry="29" fill="#ffffff" opacity="0.55" />
        <circle cx="70" cy="92" r="7" fill="#ffffff" opacity="0.9" />
      </g>
    </svg>
  );
}
