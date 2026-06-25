import type { CSSProperties } from 'react';

interface OndaDivisorProps {
  /** Color de la sección de ARRIBA (modo claro). Es el "cielo" sobre la ola. */
  colorArriba: string;
  /** Color de la sección de ABAJO (modo claro). Es el "agua" que sube en la ola. */
  colorAbajo: string;
  /** Color de la sección de ARRIBA en modo oscuro. */
  colorArribaDark: string;
  /** Color de la sección de ABAJO en modo oscuro. */
  colorAbajoDark: string;
  className?: string;
}

// Divisor de ola entre dos secciones apiladas. Decorativo: aria-hidden +
// pointer-events-none. El agua de la sección de abajo "sube" hacia la de arriba
// con un perfil de ripple suave (no un blob), fiel al tema hídrico.
//
// Sin costura: el bloque pinta su fondo con el color de la sección de ARRIBA y
// el path con el de ABAJO. Los cuatro colores entran como CSS vars en `style`
// (claro + oscuro); la utilidad `.onda-divisor` (theme.css) elige el par según
// la clase global `.dark`. Pasar los hex por `style` evita el problema del JIT
// de Tailwind, que no ve clases arbitrarias construidas en runtime.
//
// Estático (sin animación): no añade otro loop infinito; reduced-motion intacto.
// viewBox + preserveAspectRatio="none" → la ola escala a lo ancho sin px fijos
// y el wrapper `overflow-hidden w-full` garantiza cero overflow horizontal.
export function OndaDivisor({
  colorArriba,
  colorAbajo,
  colorArribaDark,
  colorAbajoDark,
  className,
}: OndaDivisorProps) {
  return (
    <div
      aria-hidden
      className={`onda-divisor pointer-events-none w-full overflow-hidden leading-[0] ${className ?? ''}`}
      style={
        {
          '--onda-arriba': colorArriba,
          '--onda-abajo': colorAbajo,
          '--onda-arriba-dark': colorArribaDark,
          '--onda-abajo-dark': colorAbajoDark,
        } as CSSProperties
      }
    >
      <svg
        className="block h-[56px] w-full md:h-[72px]"
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
        focusable="false"
      >
        {/* Ripple sereno y poco profundo: dos crestas amplias. El path cierra
            por la base, así el área rellena = sección de abajo subiendo. */}
        <path
          className="onda-divisor-agua"
          d="M0,40 C240,8 480,8 720,32 C960,56 1200,56 1440,28 L1440,72 L0,72 Z"
        />
      </svg>
    </div>
  );
}
