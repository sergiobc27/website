interface CaudalAnimadoProps {
  className?: string;
}

// Hidrograma animado (caudal contra tiempo): hace juego con CurvaIdfAnimada
// (misma técnica: ejes en L con flechas, la curva se dibuja sola en bucle, un
// punto en el pico que pulsa y gotas que caen). Representa el caudal de diseño,
// la salida de la calculadora. SVG puro; reutiliza las clases CSS compartidas de
// theme.css (curva-idf, idf-punto, idf-gota); prefers-reduced-motion las neutraliza.
export function CaudalAnimado({ className = '' }: CaudalAnimadoProps) {
  return (
    <svg
      viewBox="0 0 280 200"
      role="img"
      aria-label="Hidrograma de caudal (caudal contra tiempo), la salida de la calculadora"
      className={`curva-idf-svg ${className}`}
    >
      <circle className="idf-gota idf-gota-1" cx="132" cy="0" r="3.2" fill="#5bb8ef" />
      <circle className="idf-gota idf-gota-2" cx="150" cy="0" r="2.6" fill="#5bb8ef" />

      {/* Ejes en L con punta de flecha en cada extremo (igual que la curva IDF). */}
      <path d="M48 18 L48 168 L264 168" fill="none" stroke="#a89f8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 24 L48 16 L52 24" fill="none" stroke="#a89f8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M258 164 L266 168 L258 172" fill="none" stroke="#a89f8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

      {/* Hidrograma: sube a un pico y decae (forma clásica del caudal de una obra). */}
      <path
        className="curva-idf"
        d="M48 156 C 92 154, 110 54, 138 50 C 180 46, 214 140, 252 152"
        fill="none"
        stroke="#5bb8ef"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle className="idf-punto" cx="138" cy="50" r="4.5" fill="#eaf9ff" />

      <text transform="rotate(-90 18 96)" x="18" y="96" fill="#ead9ad" fontSize="13" fontWeight="700" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.06em">CAUDAL</text>
      <text x="156" y="192" fill="#ead9ad" fontSize="13" fontWeight="700" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.06em">TIEMPO</text>
    </svg>
  );
}
