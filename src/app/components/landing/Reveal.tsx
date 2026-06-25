import { motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

const contenedor: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor que revela a sus `RevealItem` hijos al entrar en pantalla, con un
 * stagger suave. El respeto a prefers-reduced-motion lo centraliza
 * `<MotionConfig reducedMotion="user">` en Landing: con esa preferencia motion no
 * anima el desplazamiento y el contenido aparece de inmediato.
 */
export function Reveal({ children, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={contenedor}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-10% 0px' }}
    >
      {children}
    </motion.div>
  );
}

/** Elemento individual revelado por un `Reveal` padre (fundido + leve subida). */
export function RevealItem({ children, className }: RevealProps) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
