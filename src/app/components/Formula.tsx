import type { ReactNode } from 'react';

/**
 * Primitivas para renderizar fórmulas con aspecto formal (variables en cursiva
 * serif, barra de fracción real, exponentes/subíndices), sin dependencias ni
 * LaTeX. Para las pocas fórmulas de la plataforma (método racional, Kirpich,
 * ecuación IDF) basta y se integra con el tema (color heredado de currentColor).
 */

// Pila de fuentes con buenas glifas matemáticas, con degradado a serif.
const MATH_FONT = '"Cambria Math","Latin Modern Math","STIX Two Math",Georgia,"Times New Roman",serif';

export function Formula({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 align-middle leading-none ${className}`} style={{ fontFamily: MATH_FONT }}>
      {children}
    </span>
  );
}

/** Variable matemática (cursiva), p. ej. I, T, D, Q, C, A, L, S. */
export function V({ children }: { children: ReactNode }) {
  return <span style={{ fontStyle: 'italic' }}>{children}</span>;
}

// marginLeft: la cursiva se inclina a la derecha y el superíndice quedaba
// "pegado" al cuerpo de la variable; un pequeño bearing izquierdo lo separa.
export function Sup({ children }: { children: ReactNode }) {
  return <sup style={{ fontSize: '0.68em', lineHeight: 0, marginLeft: '0.12em' }}>{children}</sup>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <sub style={{ fontSize: '0.68em', lineHeight: 0, marginLeft: '0.06em' }}>{children}</sub>;
}

/** Barra superior de media (x̄), p. ej. el promedio P̄. */
export function Bar({ children }: { children: ReactNode }) {
  return <span style={{ textDecoration: 'overline' }}>{children}</span>;
}

/** Fracción con barra real: numerador sobre denominador. */
export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="inline-flex flex-col items-center text-center align-middle" style={{ lineHeight: 1.1 }}>
      <span className="px-1.5 pb-0.5">{num}</span>
      <span className="w-full border-t border-current px-1.5 pt-0.5">{den}</span>
    </span>
  );
}
