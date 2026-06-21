import type { ReactNode } from 'react';
import { fmt } from '../../lib/format';
import type { HistoriaIdfData } from '../../lib/historia';

// El contenido de los 8 capítulos del libro "La historia del dato".
// Separado del layout para revisarlo como texto. El copy de los capítulos V–VIII
// se reescribió con definiciones al vuelo de la jerga (Gumbel, Tr, IC, IDF, R², C).

export interface CapituloContenido {
  n: number; // 1..8
  id: string; // ancla para el índice / stepper
  titulo: string;
  captionLamina: string;
  cuerpo: ReactNode; // párrafos JSX; el primero lleva la clase hl-cap (capitular)
}

/** Número clave en rojo CUC. */
function R({ children }: { children: ReactNode }) {
  return <b className="hl-red">{children}</b>;
}
/** Número clave en oro IDEAM. */
function O({ children }: { children: ReactNode }) {
  return <b className="hl-gold">{children}</b>;
}
/** Definición al vuelo: callout con filete dorado. */
function Defn({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <aside className="hl-defn">
      <b>{termino}.</b> <span>{children}</span>
    </aside>
  );
}

export function idCapitulo(n: number): string {
  return `cap-${n}`;
}

export function construirCapitulos(D: HistoriaIdfData): CapituloContenido[] {
  const est = D.estacion;
  const t = D.tormenta;
  const r2 = D.ecuacion?.r2;
  return [
    {
      n: 1,
      id: idCapitulo(1),
      titulo: '¿Qué tan fuerte puede llover aquí?',
      captionLamina: `Estación ${est.nombre}`,
      cuerpo: (
        <>
          <p className="hl-cap">
            De esa respuesta depende el tamaño de cada alcantarillado, cuneta y puente de Colombia. Si se queda corta, la
            calle se inunda; si se pasa, la obra cuesta de más.
          </p>
          <p>
            Esta es la historia de cómo una estación real del IDEAM ({est.nombre}, en {est.municipio},{' '}
            {est.departamento}) convierte gotas de lluvia en una herramienta de diseño.
          </p>
        </>
      ),
    },
    {
      n: 2,
      id: idCapitulo(2),
      titulo: 'El pulso de la lluvia',
      captionLamina: `Tormenta real del ${t.fecha} · el pico (rojo) resalta`,
      cuerpo: (
        <>
          <p className="hl-cap">
            El IDEAM no mide la lluvia «por días»: la registra <R>cada 10 minutos</R>. Esto que ves es una tormenta real
            del {t.fecha}: cada barra es lo que cayó en diez minutos.
          </p>
          <p>
            Ese día cayeron <R>{fmt(t.totalMm)} mm</R> en total, con una ráfaga que alcanzó una intensidad de{' '}
            <O>{fmt(t.maxIntensidadMmH)} mm/h</O>. La lluvia no es pareja: tiene picos cortos y violentos, y esos picos
            son los que inundan una calle.
          </p>
          <Defn termino="Intensidad (mm/h)">
            la «velocidad» de la lluvia. {fmt(t.maxIntensidadMmH)} mm/h significa que, si esa ráfaga durara una hora
            entera, caerían {fmt(t.maxIntensidadMmH)} milímetros.
          </Defn>
        </>
      ),
    },
    {
      n: 3,
      id: idCapitulo(3),
      titulo: '144 pulsos reales por día',
      captionLamina: 'Lo que ven los 10 minutos vs. un solo dato diario',
      cuerpo: (
        <>
          <p className="hl-cap">
            La práctica común en Colombia solo conoce el <R>total del día</R> (un número) y lo «desagrega» con fórmulas
            regionales para adivinar cómo se repartió esa lluvia.
          </p>
          <Defn termino="Desagregar">
            repartir un solo número (el total del día) en sus partes (cada hora, cada 10 minutos) usando una fórmula que
            asume una forma «típica» de tormenta. Es una conjetura informada, no la lluvia real.
          </Defn>
          <p>
            Esta plataforma no adivina: usa los <O>144 registros reales</O> de cada día. Esa es la diferencia entre{' '}
            <em>estimar</em> una curva IDF y <em>construirla</em>. Es el corazón de esta tesis.
          </p>
        </>
      ),
    },
    {
      n: 4,
      id: idCapitulo(4),
      titulo: 'Décadas de tormentas',
      captionLamina: `Peor tormenta de 24 h de cada año (${D.maximosAnuales.length} años)`,
      cuerpo: (
        <>
          <p className="hl-cap">
            Para diseñar no basta una tormenta: hay que conocerlas todas. De cada año de registro guardamos su peor
            tormenta de 24 horas. Aquí están las de {est.nombre} (<R>{D.maximosAnuales.length} años</R>).
          </p>
          <p>
            El <O>anillo dorado</O> es la misma tormenta que viste al inicio. A simple vista parecen puntos al azar; la
            hidrología existe para encontrarles el patrón.
          </p>
        </>
      ),
    },
    {
      n: 5,
      id: idCapitulo(5),
      titulo: 'Domar el azar',
      captionLamina: 'Ajuste de Gumbel · la línea marca Tr 25',
      cuerpo: (
        <>
          <p className="hl-cap">
            ¿Cómo se le pone número al azar? Con la distribución de <R>Gumbel</R>, la matemática de los valores extremos:
            ordena ese caos y a cada lámina de lluvia le asigna una probabilidad de ser superada.
          </p>
          <Defn termino="Gumbel">
            una curva pensada para los máximos (la creciente más grande de cada año). Aprende de tus peores tormentas y
            estima qué tan grande podría ser una aún peor.
          </Defn>
          <p>De ahí sale el período de retorno (Tr), el lenguaje con el que se diseña.</p>
          <Defn termino="Período de retorno (Tr)">
            «Tr = 25 años» <em>no</em> significa que ocurra cada 25 años. Significa que <O>cada año hay un 4%</O> de
            probabilidad de que se supere. Puede pasar dos años seguidos.
          </Defn>
          <p>
            La <O>franja dorada</O> es la incertidumbre del ajuste (IC 90%): con series de pocos años es honesta y ancha.
            La mostramos en vez de esconderla.
          </p>
        </>
      ),
    },
    {
      n: 6,
      id: idCapitulo(6),
      titulo: 'Nacen las curvas',
      captionLamina: `Curvas IDF de ${est.nombre} · Tr 25 encendida`,
      cuerpo: (
        <>
          <p className="hl-cap">
            Repitiendo ese análisis para cada duración (10 minutos, 30, una hora, un día) aparecen las curvas <R>IDF</R>.
          </p>
          <Defn termino="IDF = Intensidad · Duración · Frecuencia">
            cada curva responde a una pregunta de diseño: «para una lluvia de esta duración y esta frecuencia, ¿qué
            intensidad debo esperar?».
          </Defn>
          <p>
            Cada curva es un período de retorno. Cuando hablamos de <O>Tr 25</O> esa curva se enciende y las demás pasan
            a segundo plano. El cálculo que antes tomaba semanas sale aquí de los datos reales de la estación, listo para
            citarse.
          </p>
        </>
      ),
    },
    {
      n: 7,
      id: idCapitulo(7),
      titulo: 'Una fórmula que resume décadas',
      captionLamina: 'La ecuación IDF de esta estación',
      cuerpo: (
        <>
          <p className="hl-cap">
            Toda esa familia de curvas se condensa en una sola expresión: la forma canónica colombiana de Vargas &
            Díaz-Granados (1998), ajustada a esta estación.
          </p>
          <p>
            Sus tres parámetros (<R>K</R>, <R>m</R> y <R>n</R>) son el ADN hidrológico de {est.nombre}: con ellos cabe la
            estación entera en una calculadora.
          </p>
          {r2 != null && (
            <Defn termino="R² (bondad del ajuste)">
              qué tan bien la ecuación reproduce los datos reales, de 0 (nada) a 1 (perfecto). Aquí{' '}
              <O>R² = {fmt(r2, 3)}</O>: explica el {fmt(r2 * 100, 0)}% de lo observado.
            </Defn>
          )}
        </>
      ),
    },
    {
      n: 8,
      id: idCapitulo(8),
      titulo: 'De la curva al diseño',
      captionLamina: 'Del dato al caudal (método racional)',
      cuerpo: (
        <>
          <p className="hl-cap">
            Y así se cierra el círculo. El método racional toma una intensidad de la curva y la convierte en el{' '}
            <R>caudal</R> que una obra debe evacuar: Q = C · I · A / 360.
          </p>
          <Defn termino="C (coeficiente de escorrentía)">
            qué fracción de la lluvia corre por la superficie en vez de infiltrarse. En ciudad ≈ <O>0,80</O> (asfalto y
            techos); en zona verde, mucho menos.
          </Defn>
          <p>
            De gotas cada diez minutos a una decisión de ingeniería. Esta plataforma es <em>orientativa</em>: el diseño
            real lo rigen la RAS 0330, el manual del INVÍAS y el criterio profesional. Pero ahora ya sabes de dónde sale
            cada número.
          </p>
        </>
      ),
    },
  ];
}
