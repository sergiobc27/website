interface CurvaIdfAnimadaProps {
  className?: string;
}

// Diseño animado del cierre que referencia al proyecto: las curvas IDF
// (Intensidad, Duración, Frecuencia), el resultado estrella del trabajo. Unas
// gotas caen y las tres curvas se dibujan solas en bucle, con un punto de dato
// que pulsa. SVG puro, sin dependencias. Sobre el fondo nocturno del cierre.
// Las animaciones son CSS scoped en theme.css y el bloque global de
// prefers-reduced-motion las neutraliza (las curvas quedan dibujadas y visibles).
export function CurvaIdfAnimada({ className = '' }: CurvaIdfAnimadaProps) {
  return (
    <svg
      viewBox="0 0 260 200"
      role="img"
      aria-label="Curvas IDF (Intensidad, Duración y Frecuencia), el resultado del proyecto"
      className={`curva-idf-svg ${className}`}
    >
      <circle className="idf-gota idf-gota-1" cx="78" cy="0" r="3.2" fill="#5bb8ef" />
      <circle className="idf-gota idf-gota-2" cx="150" cy="0" r="2.6" fill="#5bb8ef" />

      <line x1="40" y1="28" x2="40" y2="176" stroke="#6b6353" strokeWidth="1.5" />
      <line x1="40" y1="176" x2="242" y2="176" stroke="#6b6353" strokeWidth="1.5" />

      <path className="curva-idf curva-1" d="M44 46 C 98 88, 170 140, 238 158" fill="none" stroke="#C9A227" strokeWidth="3" strokeLinecap="round" />
      <path className="curva-idf curva-2" d="M44 66 C 98 110, 170 154, 238 168" fill="none" stroke="#5bb8ef" strokeWidth="3" strokeLinecap="round" />
      <path className="curva-idf curva-3" d="M44 90 C 98 130, 170 164, 238 172" fill="none" stroke="#5bd6a0" strokeWidth="3" strokeLinecap="round" />

      <circle className="idf-punto" cx="44" cy="46" r="4.5" fill="#fff7e6" />

      <text x="246" y="180" fill="#8a8071" fontSize="9" textAnchor="end" fontFamily="ui-sans-serif, system-ui, sans-serif">duración</text>
    </svg>
  );
}
