interface MascotaGotaProps {
  size?: number;
  className?: string;
}

// "Gotita": personaje SVG por código (sin assets externos). El parpadeo y la
// flotación se animan con CSS scoped en theme.css (.mascota-ojos, .landing-flota),
// que el bloque global de prefers-reduced-motion neutraliza.
export function MascotaGota({ size = 120, className = '' }: MascotaGotaProps) {
  return (
    <svg width={size} height={size * 1.17} viewBox="0 0 120 140" role="img" aria-label="Gotita, la mascota del proyecto" className={className}>
      <path d="M60 8 C60 8 18 62 18 92 a42 42 0 0 0 84 0 C102 62 60 8 60 8 Z" fill="#2b8fd6" />
      <ellipse cx="44" cy="74" rx="9" ry="15" fill="#bfe6ff" opacity="0.7" />
      <g className="mascota-ojos">
        <circle cx="48" cy="92" r="6" fill="#ffffff" />
        <circle cx="72" cy="92" r="6" fill="#ffffff" />
        <circle cx="49" cy="93" r="3" fill="#15324a" />
        <circle cx="73" cy="93" r="3" fill="#15324a" />
      </g>
      <path d="M50 106 q10 9 20 0" fill="none" stroke="#15324a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="39" cy="102" r="4" fill="#f6a6c0" opacity="0.7" />
      <circle cx="81" cy="102" r="4" fill="#f6a6c0" opacity="0.7" />
    </svg>
  );
}
