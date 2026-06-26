interface CurvaIdfAnimadaProps {
  className?: string;
}

// Diseño animado del cierre que referencia al proyecto: las curvas IDF
// (Intensidad, Duración, Frecuencia), el resultado estrella del trabajo. Ejes en
// L con flechas y etiquetas; las tres curvas arrancan pegadas al eje Y y se
// dibujan solas en bucle, con un punto de dato que pulsa y gotas que caen. SVG
// puro. Las animaciones son CSS scoped en theme.css y prefers-reduced-motion las
// neutraliza (las curvas quedan dibujadas y visibles).
export function CurvaIdfAnimada({ className = '' }: CurvaIdfAnimadaProps) {
  return (
    <svg
      viewBox="0 0 280 200"
      role="img"
      aria-label="Curvas IDF (Intensidad, Duración y Frecuencia), el resultado del proyecto"
      className={`curva-idf-svg ${className}`}
    >
      <circle className="idf-gota idf-gota-1" cx="96" cy="0" r="3.2" fill="#5bb8ef" />
      <circle className="idf-gota idf-gota-2" cx="168" cy="0" r="2.6" fill="#5bb8ef" />

      {/* Ejes en L con punta de flecha en cada extremo. */}
      <path d="M48 18 L48 168 L264 168" fill="none" stroke="#a89f8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 24 L48 16 L52 24" fill="none" stroke="#a89f8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M258 164 L266 168 L258 172" fill="none" stroke="#a89f8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

      {/* Curvas IDF: arrancan sobre el eje Y (x=48) y decaen hacia el eje X. */}
      <path className="curva-idf curva-1" d="M48 38 C 112 66, 184 138, 252 152" fill="none" stroke="#C9A227" strokeWidth="3.2" strokeLinecap="round" />
      <path className="curva-idf curva-2" d="M48 56 C 112 92, 184 146, 252 158" fill="none" stroke="#5bb8ef" strokeWidth="3.2" strokeLinecap="round" />
      <path className="curva-idf curva-3" d="M48 76 C 112 114, 184 154, 252 162" fill="none" stroke="#5bd6a0" strokeWidth="3.2" strokeLinecap="round" />

      <circle className="idf-punto" cx="48" cy="38" r="4.5" fill="#fff7e6" />

      <text transform="rotate(-90 18 96)" x="18" y="96" fill="#ead9ad" fontSize="13" fontWeight="700" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.06em">INTENSIDAD</text>
      <text x="156" y="192" fill="#ead9ad" fontSize="13" fontWeight="700" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.06em">DURACIÓN</text>
    </svg>
  );
}
