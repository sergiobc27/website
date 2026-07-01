import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Ilustración animada y sencilla para cada apartado de la metodología. Cada `id`
 * de METODOLOGIA tiene una escena representativa (lluvia, canal, curvas, barras…)
 * animada con motion/react, en el tema de acento (currentColor = acento CUC).
 * Objetivo: comunicar de un vistazo qué representa el apartado, sin recargar.
 */

const VB = '0 0 220 80';
const BASE = 64; // línea base para barras/escenas

function Marco({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure
      aria-label={label}
      className="overflow-hidden rounded-lg border border-border bg-gradient-to-br from-accent/10 via-accent/5 to-transparent"
    >
      <svg viewBox={VB} className="h-24 w-full text-accent" role="img" preserveAspectRatio="xMidYMid meet">
        <title>{label}</title>
        {children}
      </svg>
    </figure>
  );
}

// ── Primitivas reutilizables ──────────────────────────────────────────────────

function Suelo() {
  return <line x1="12" y1={BASE} x2="208" y2={BASE} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />;
}

function Lluvia({ n = 6, x0 = 34, dx = 26, top = 8, caida = 34, delay = 0 }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <motion.line
          key={i}
          x1={x0 + i * dx}
          y1={top}
          x2={x0 + i * dx}
          y2={top + 7}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, caida] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: delay + i * 0.16, ease: 'easeIn' }}
        />
      ))}
    </>
  );
}

function Barras({
  vals,
  color = 'currentColor',
  x0 = 26,
  ancho = 12,
  paso = 20,
  alto = 44,
}: {
  vals: number[];
  color?: string;
  x0?: number;
  ancho?: number;
  paso?: number;
  alto?: number;
}) {
  return (
    <>
      {vals.map((v, i) => {
        const h = Math.max(2, v * alto);
        return (
          <motion.rect
            key={i}
            x={x0 + i * paso}
            y={BASE - h}
            width={ancho}
            height={h}
            rx="1.5"
            fill={color}
            style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: i * 0.08, repeat: Infinity, repeatType: 'mirror', repeatDelay: 1.6 }}
          />
        );
      })}
    </>
  );
}

function Trazo({ d, color = 'currentColor', dur = 1.6, delay = 0, width = 2.4, dash = false }: { d: string; color?: string; dur?: number; delay?: number; width?: number; dash?: boolean }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash ? '4 4' : undefined}
      initial={{ pathLength: 0, opacity: 0.3 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: dur, delay, repeat: Infinity, repeatType: 'loop', repeatDelay: 0.8, ease: 'easeInOut' }}
    />
  );
}

function Flecha({ x1, y1, x2, y2, delay = 0 }: { x1: number; y1: number; x2: number; y2: number; delay?: number }) {
  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      markerEnd="url(#punta)"
      initial={{ opacity: 0.2 }}
      animate={{ opacity: [0.2, 1, 0.2] }}
      transition={{ duration: 1.6, repeat: Infinity, delay }}
    />
  );
}

function DefsFlecha() {
  return (
    <defs>
      <marker id="punta" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
      </marker>
    </defs>
  );
}

// ── Escenas por id ────────────────────────────────────────────────────────────

const ESCENAS: Record<string, ReactNode> = {
  // Método racional: lluvia → cuenca inclinada → caudal a la salida.
  'metodo-racional': (
    <>
      <DefsFlecha />
      <Lluvia />
      <path d="M14,40 L120,58 L120,64 L14,64 Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M14,40 L120,58" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
      <Flecha x1={124} y1={60} x2={196} y2={60} />
      <motion.circle
        cx={0}
        cy={0}
        r="3"
        fill="currentColor"
        animate={{ cx: [128, 196], cy: [60, 60], opacity: [0, 1, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeIn' }}
      />
    </>
  ),
  // Tiempo de concentración: una gota viaja del punto lejano a la salida.
  'tiempo-concentracion': (
    <>
      <Trazo d="M20,20 C70,26 60,54 120,56 C170,58 175,50 200,58" width={2} dash />
      <motion.circle
        r="4"
        fill="currentColor"
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: '100%' }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ offsetPath: "path('M20,20 C70,26 60,54 120,56 C170,58 175,50 200,58')" }}
      />
      <circle cx="20" cy="20" r="3" fill="currentColor" fillOpacity="0.5" />
      <circle cx="200" cy="58" r="3" fill="currentColor" fillOpacity="0.5" />
    </>
  ),
  // IDF: familia de curvas intensidad-duración que se dibujan.
  idf: (
    <>
      <Trazo d="M20,20 C70,26 120,30 200,32" delay={0} />
      <Trazo d="M20,34 C70,40 120,44 200,46" delay={0.25} width={2} />
      <Trazo d="M20,48 C70,53 120,56 200,58" delay={0.5} width={2} />
    </>
  ),
  // Coeficiente C: lluvia; parte escurre (flecha lateral) y parte infiltra (abajo).
  'coeficiente-c': (
    <>
      <DefsFlecha />
      <Lluvia n={5} x0={40} dx={30} />
      <Suelo />
      <Flecha x1={150} y1={58} x2={198} y2={58} delay={0.2} />
      <Flecha x1={70} y1={68} x2={70} y2={78} delay={0.6} />
      <Flecha x1={110} y1={68} x2={110} y2={78} delay={0.9} />
    </>
  ),
  // Factor de frecuencia Cf: un indicador que sube con el período de retorno.
  'factor-cf': (
    <>
      <Suelo />
      <Barras vals={[0.4, 0.55, 0.75, 1]} x0={44} ancho={20} paso={34} alto={46} />
      <Trazo d="M44,44 L64,36 L98,26 L146,16" width={2.4} dur={1.8} />
    </>
  ),
  // Manning: sección de canal con agua que fluye.
  manning: (
    <>
      <DefsFlecha />
      <path d="M40,26 L70,60 L150,60 L180,26" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.5" />
      <path d="M56,44 L80,52 L140,52 L164,44 L164,60 L56,60 Z" fill="currentColor" fillOpacity="0.18" />
      <motion.path
        d="M56,44 C80,40 140,48 164,44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1, opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <Flecha x1={92} y1={52} x2={128} y2={52} />
    </>
  ),
  // Períodos de retorno: distribución de extremos con la cola marcada.
  'periodos-retorno': (
    <>
      <Suelo />
      <Trazo d="M18,62 C60,62 74,18 110,18 C150,18 156,54 176,60 C186,62 196,62 204,63" dur={2} />
      <motion.circle
        cx="176"
        cy="60"
        r="4"
        fill="currentColor"
        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
    </>
  ),
  // SPI: barras de sequía (abajo, rojo) y humedad (arriba, azul) sobre el cero.
  spi: (
    <>
      <line x1="12" y1="40" x2="208" y2="40" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
      {[-0.5, 0.4, -0.8, 0.3, -0.3, 0.7, -0.6].map((v, i) => {
        const h = Math.abs(v) * 30;
        const up = v > 0;
        return (
          <motion.rect
            key={i}
            x={22 + i * 26}
            y={up ? 40 - h : 40}
            width="14"
            height={h}
            rx="1.5"
            fill={up ? '#2563eb' : '#dc7633'}
            style={{ transformBox: 'fill-box', transformOrigin: up ? 'bottom' : 'top' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity, repeatType: 'mirror', repeatDelay: 1.6 }}
          />
        );
      })}
    </>
  ),
  // Hietograma: barras de lluvia por mes (curva estacional).
  hietograma: (
    <>
      <Suelo />
      <Barras vals={[0.3, 0.5, 0.8, 1, 0.7, 0.4, 0.35, 0.5, 0.85, 0.95, 0.6, 0.4]} x0={20} ancho={11} paso={16} />
    </>
  ),
  // Histograma: distribución de frecuencias (campana asimétrica).
  histograma: (
    <>
      <Suelo />
      <Barras vals={[1, 0.85, 0.6, 0.4, 0.28, 0.18, 0.12, 0.08]} x0={30} ancho={16} paso={22} />
    </>
  ),
  // Serie temporal: una línea que se dibuja a lo largo del tiempo + área.
  'serie-temporal': (
    <>
      <path d="M20,52 L50,42 L80,54 L110,30 L140,46 L170,26 L200,40 L200,64 L20,64 Z" fill="currentColor" fillOpacity="0.12" />
      <Trazo d="M20,52 L50,42 L80,54 L110,30 L140,46 L170,26 L200,40" dur={2} />
    </>
  ),
  // Climatología: barras (media) con bigotes (máx/mín).
  climatologia: (
    <>
      <Suelo />
      <Barras vals={[0.4, 0.55, 0.8, 0.95, 0.7, 0.45, 0.5, 0.85, 0.9, 0.6]} x0={22} ancho={11} paso={19} />
      {[0.4, 0.55, 0.8, 0.95, 0.7, 0.45, 0.5, 0.85, 0.9, 0.6].map((v, i) => (
        <line key={i} x1={22 + i * 19 + 5.5} y1={BASE - v * 44 - 8} x2={22 + i * 19 + 5.5} y2={BASE - v * 44 + 6} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
      ))}
    </>
  ),
  // Anomalías: barras + y − respecto a la línea de cero (azul/rojo).
  anomalias: (
    <>
      <line x1="12" y1="40" x2="208" y2="40" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      {[0.5, -0.3, 0.7, -0.6, 0.2, -0.4, 0.6, -0.2].map((v, i) => {
        const h = Math.abs(v) * 30;
        const up = v > 0;
        return (
          <motion.rect
            key={i}
            x={20 + i * 24}
            y={up ? 40 - h : 40}
            width="13"
            height={h}
            rx="1.5"
            fill={up ? '#2563eb' : '#A3161A'}
            style={{ transformBox: 'fill-box', transformOrigin: up ? 'bottom' : 'top' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, delay: i * 0.09, repeat: Infinity, repeatType: 'mirror', repeatDelay: 1.6 }}
          />
        );
      })}
    </>
  ),
  // Heatmap: cuadrícula de celdas que se colorean.
  heatmap: (
    <>
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 9 }).map((_, c) => (
          <motion.rect
            key={`${r}-${c}`}
            x={22 + c * 20}
            y={12 + r * 15}
            width="17"
            height="12"
            rx="2"
            fill="currentColor"
            initial={{ opacity: 0.12 }}
            animate={{ opacity: [0.12, 0.85, 0.12] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: (r + c) * 0.12 }}
          />
        )),
      )}
    </>
  ),
  // Top departamentos: ranking de barras horizontales.
  'top-departamentos': (
    <>
      {[1, 0.78, 0.6, 0.45, 0.3].map((v, i) => (
        <motion.rect
          key={i}
          x="22"
          y={12 + i * 12}
          height="8"
          rx="2"
          fill="currentColor"
          style={{ transformBox: 'fill-box', transformOrigin: 'left' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          width={v * 176}
          transition={{ duration: 0.7, delay: i * 0.12, repeat: Infinity, repeatType: 'mirror', repeatDelay: 1.8 }}
        />
      ))}
    </>
  ),
  // Series comparadas: dos líneas de estaciones distintas.
  'comparador-series': (
    <>
      <Trazo d="M20,48 L52,40 L84,50 L116,32 L148,44 L180,30 L204,38" delay={0} />
      <Trazo d="M20,58 L52,54 L84,60 L116,50 L148,56 L180,46 L204,52" delay={0.3} color="#2563eb" width={2} />
    </>
  ),
  // IDF comparadas: dos curvas IDF de estaciones distintas.
  'comparador-idf': (
    <>
      <Trazo d="M20,22 C70,28 120,32 200,34" delay={0} />
      <Trazo d="M20,40 C70,46 120,50 200,52" delay={0.3} color="#2563eb" width={2} />
    </>
  ),
  // Mapa coropleta: regiones que se colorean según su valor.
  'mapa-coropleta': (
    <>
      {[
        { d: 'M30,20 L80,16 L88,44 L44,52 Z', delay: 0 },
        { d: 'M88,44 L80,16 L134,20 L138,50 Z', delay: 0.3 },
        { d: 'M44,52 L88,44 L138,50 L120,70 L54,68 Z', delay: 0.6 },
        { d: 'M134,20 L182,26 L188,58 L138,50 Z', delay: 0.9 },
      ].map((r, i) => (
        <motion.path
          key={i}
          d={r.d}
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.2"
          fill="currentColor"
          initial={{ fillOpacity: 0.1 }}
          animate={{ fillOpacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: r.delay }}
        />
      ))}
    </>
  ),
};

export function IlustracionMetodo({ id, className = '' }: { id: string; className?: string }) {
  const escena = ESCENAS[id];
  if (!escena) return null;
  return (
    <div className={className}>
      <Marco label={`Ilustración: ${id}`}>{escena}</Marco>
    </div>
  );
}
