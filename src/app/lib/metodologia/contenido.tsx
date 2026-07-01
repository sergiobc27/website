import type { ReactNode } from 'react';
import { Formula, Frac, Sub, Sup, V, Bar } from '../../components/Formula';
import type { Fuente } from '../hydro/fuentes';

/**
 * Registro único de explicaciones (qué es / cómo se lee / para qué sirve) y de
 * la procedencia (fórmulas y citas con localizador) de cada gráfica y método de
 * la plataforma. Lo leen el botón (i) de cada gráfica (`InfoGrafica`) y la página
 * de Metodología (`Metodologia`), para que nunca se desincronicen.
 */
/** Significado de cada símbolo de una fórmula, para que cualquier persona sepa qué
 * representa cada letra. Va SIEMPRE junto a la fórmula. */
export interface Variable {
  simbolo: ReactNode;
  definicion: string;
}

export interface EntradaMetodo {
  id: string;
  titulo: string;
  /** Capa 1: una frase. */
  resumen: string;
  queEs: string;
  /** Para gráficas: ejes, colores, leyenda. */
  comoSeLee: string;
  paraQueSirve: string;
  formula?: ReactNode;
  /** Definición de cada variable de la fórmula (obligatorio si hay fórmula con letras). */
  variables?: Variable[];
  /** Citas con localizador exacto (vacío si es una visualización sin método propio). */
  fuentes: Fuente[];
}

// Atajo para citas a una fuente canónica (la referencia ES el origen del método).
const cita = (ref: string, localizador: string): Fuente => ({ ref, localizador, verificado: true });

export const METODOLOGIA: Record<string, EntradaMetodo> = {
  // ───────────────────────── Cálculo de diseño ─────────────────────────
  'metodo-racional': {
    id: 'metodo-racional',
    titulo: 'Método racional (caudal de diseño)',
    resumen: 'Estima el caudal pico de una cuenca pequeña a partir de la lluvia, la cobertura y el área.',
    queEs:
      'El método racional supone que, para una lluvia de intensidad constante, el caudal pico ocurre cuando toda la cuenca aporta a la vez (cuando la duración de la lluvia iguala el tiempo de concentración). Relaciona ese caudal con la intensidad de la lluvia, el coeficiente de escorrentía y el área aportante.',
    comoSeLee:
      'No es una gráfica sino el resultado de la calculadora: el caudal Q en m³/s. Cada factor (C, I, A) se elige y se muestra por separado en las secciones de la calculadora.',
    paraQueSirve:
      'Dimensionar obras de drenaje en cuencas pequeñas (cunetas, alcantarillas, canales, drenaje urbano). Su validez se limita a áreas pequeñas: A < 80 ha en drenaje urbano (RAS 0330) y A ≤ 2,5 km² en drenaje vial (INVÍAS).',
    formula: (
      <Formula className="text-base">
        <V>Q</V>&nbsp;=&nbsp;<Frac num={<><V>C</V> · <V>I</V> · <V>A</V></>} den={<>360</>} />
      </Formula>
    ),
    variables: [
      { simbolo: 'Q', definicion: 'caudal pico de diseño (m³/s)' },
      { simbolo: 'C', definicion: 'coeficiente de escorrentía (0 a 1, sin unidad)' },
      { simbolo: 'I', definicion: 'intensidad de la lluvia de diseño (mm/h)' },
      { simbolo: 'A', definicion: 'área de la cuenca que aporta (ha)' },
      { simbolo: '360', definicion: 'factor que ajusta las unidades (de mm/h y ha a m³/s)' },
    ],
    fuentes: [
      cita('ras-0330', 'Art. 135 (caudal de aguas lluvias)'),
      cita('invias-drenaje-2009', '§ 2.5.5.2 (método racional)'),
    ],
  },
  'tiempo-concentracion': {
    id: 'tiempo-concentracion',
    titulo: 'Tiempo de concentración (Tc)',
    resumen: 'El tiempo que tarda el agua en viajar desde el punto más lejano de la cuenca hasta la salida.',
    queEs:
      'El tiempo de concentración fija la duración de la lluvia de diseño en el método racional. Se estima con fórmulas empíricas (Kirpich, Témez, Giandotti) a partir de la longitud, la pendiente y el área del cauce; la calculadora toma la mediana de los métodos válidos para no depender de uno solo.',
    comoSeLee:
      'La tabla muestra el Tc de cada método y el valor recomendado (mediana). Si la mediana baja de 10 min se aplica un piso de diseño de 10 min.',
    paraQueSirve:
      'Leer la intensidad de la curva IDF en la duración correcta (D = Tc). El Manual INVÍAS recomienda Kirpich y un mínimo de 15 min; el RAS admite mínimos de 3 a 10 min.',
    formula: (
      <Formula>
        <V>T</V><Sub>c</Sub>&nbsp;(Kirpich)&nbsp;=&nbsp;0,0195 · <V>L</V><Sup>0,77</Sup> · <V>S</V><Sup>−0,385</Sup>
      </Formula>
    ),
    variables: [
      { simbolo: <><V>T</V><Sub>c</Sub></>, definicion: 'tiempo de concentración (min)' },
      { simbolo: 'L', definicion: 'longitud del cauce principal (m)' },
      { simbolo: 'S', definicion: 'pendiente media del cauce (m/m)' },
    ],
    fuentes: [
      cita('kirpich-1940', 'p. 362'),
      cita('temez-1978', 'cálculo de Tc en cuencas pequeñas'),
      cita('giandotti-1934', 'fórmula con área y pendiente'),
      cita('velez-botero-2011', 'Kirpich subestima Tc en cuencas urbanas'),
      cita('ras-0330', 'Art. 135, num. 4 (Tc mínimo 3–10 min)'),
    ],
  },
  'coeficiente-c': {
    id: 'coeficiente-c',
    titulo: 'Coeficiente de escorrentía C',
    resumen: 'La fracción de la lluvia que escurre por la superficie (el resto se infiltra o evapora).',
    queEs:
      'C va de 0 a 1 y depende de la cobertura del suelo: un techo o un pavimento escurren casi toda la lluvia (C alto), un prado o un bosque retienen gran parte (C bajo). Se elige de tablas según la superficie y la pendiente, y se ajusta al alza para períodos de retorno mayores con el factor de frecuencia Cf.',
    comoSeLee:
      'En la calculadora eliges la superficie y el C base dentro de su rango; las tablas de la norma (urbano/rural) se muestran desplegables con su cita.',
    paraQueSirve:
      'Convertir la lluvia que cae en el caudal que realmente llega al drenaje. Es el factor más sensible del método racional.',
    fuentes: [
      cita('invias-drenaje-2009', 'Tabla 2.9 (urbano) y Tabla 2.10 (rural)'),
    ],
  },
  'factor-cf': {
    id: 'factor-cf',
    titulo: 'Factor de frecuencia Cf',
    resumen: 'Sube el coeficiente C para tormentas más raras (períodos de retorno altos).',
    queEs:
      'En lluvias extremas el suelo se satura y escurre proporcionalmente más, así que C debe aumentar. Cf multiplica C según el período de retorno (1,0 hasta Tr 10; 1,1 a Tr 25; 1,2 a Tr 50; 1,25 a Tr 100), topando el producto en 1,0.',
    comoSeLee:
      'La calculadora muestra C base, Cf y el C de diseño = mín(1; C·Cf). La tabla de Cf está desplegable junto al coeficiente C.',
    paraQueSirve:
      'Diseñar con un coeficiente coherente con la severidad de la tormenta de diseño.',
    formula: (
      <Formula>
        <V>C</V><Sub>diseño</Sub>&nbsp;=&nbsp;mín(1;&nbsp;<V>C</V> · <V>C</V><Sub>f</Sub>)
      </Formula>
    ),
    variables: [
      { simbolo: <><V>C</V><Sub>diseño</Sub></>, definicion: 'coeficiente de escorrentía de diseño' },
      { simbolo: 'C', definicion: 'coeficiente base según la superficie' },
      { simbolo: <><V>C</V><Sub>f</Sub></>, definicion: 'factor de frecuencia (sube C para períodos de retorno altos)' },
    ],
    fuentes: [
      {
        ref: 'chow-applied-1988',
        localizador: 'factor de frecuencia del método racional',
        verificado: false,
        nota: 'Valor de Chow, Maidment & Mays (1988); el número exacto de tabla queda por confirmar en la edición impresa.',
      },
    ],
  },
  manning: {
    id: 'manning',
    titulo: 'Verificación hidráulica (Manning)',
    resumen: 'Comprueba que el conducto elegido transporte el caudal de diseño sin sedimentar ni erosionarse.',
    queEs:
      'La ecuación de Manning relaciona el caudal que pasa por un conducto con su geometría, su rugosidad (n) y su pendiente. La calculadora resuelve la profundidad del agua para el caudal de diseño y revisa tres cosas: que la sección alcance, que no se llene de más y que la velocidad no sedimente (por esfuerzo cortante) ni erosione.',
    comoSeLee:
      'Las tarjetas muestran capacidad, llenado y/D, velocidad y esfuerzo cortante τ; los semáforos verde/amarillo/rojo indican si cada chequeo cumple la norma.',
    paraQueSirve:
      'Elegir el diámetro o la sección del conducto. Criterios del RAS 0330: autolimpieza por esfuerzo cortante ≥ 2,0 Pa (Art. 149), velocidad máxima 5,0 m/s (Art. 150) y llenado máximo y/D = 93% (Art. 151).',
    formula: (
      <Formula>
        <V>Q</V>&nbsp;=&nbsp;<Frac num={<>1</>} den={<V>n</V>} />&nbsp;· <V>A</V> · <V>R</V><Sup>2/3</Sup> · <V>S</V><Sup>1/2</Sup>
      </Formula>
    ),
    variables: [
      { simbolo: 'Q', definicion: 'caudal que transporta el conducto (m³/s)' },
      { simbolo: 'n', definicion: 'coeficiente de rugosidad de Manning (según el material)' },
      { simbolo: 'A', definicion: 'área mojada de la sección (m²)' },
      { simbolo: 'R', definicion: 'radio hidráulico = área mojada ÷ perímetro mojado (m)' },
      { simbolo: 'S', definicion: 'pendiente del conducto (m/m)' },
    ],
    fuentes: [
      cita('manning-1891', 'ecuación de flujo en canales'),
      cita('chow-1959', 'cap. 5 (resistencia y n de Manning)'),
      cita('ras-0330', 'Arts. 149, 150 y 151 (autolimpieza, velocidad y llenado)'),
    ],
  },
  idf: {
    id: 'idf',
    titulo: 'Curvas IDF · Intensidad–Duración–Frecuencia',
    resumen: 'Cuánto puede llover (intensidad) según cuánto dure el aguacero y cada cuánto se repite.',
    queEs:
      'Una familia de curvas: cada una corresponde a un período de retorno (Tr) y muestra cómo cae la intensidad de la lluvia (mm/h) a medida que aumenta la duración. Se obtienen ajustando los extremos de la lluvia sub-horaria (datos de 10 min) por duración y luego una ecuación I = K·Tᵐ/Dⁿ por regresión.',
    comoSeLee:
      'Eje X: duración en minutos (escala logarítmica). Eje Y: intensidad en mm/h (escala logarítmica). Cada línea es un Tr; a más arriba, más raro y más intenso. Aguaceros cortos son más intensos que los largos.',
    paraQueSirve:
      'Es la entrada de lluvia del diseño de drenaje: se lee la intensidad en la duración igual al tiempo de concentración para alimentar el método racional.',
    formula: (
      <Formula className="text-base">
        <V>I</V>&nbsp;=&nbsp;<Frac num={<><V>K</V> · <V>T</V><Sup><V>m</V></Sup></>} den={<><V>D</V><Sup><V>n</V></Sup></>} />
      </Formula>
    ),
    variables: [
      { simbolo: 'I', definicion: 'intensidad de la lluvia (mm/h)' },
      { simbolo: 'T', definicion: 'período de retorno (años)' },
      { simbolo: 'D', definicion: 'duración de la lluvia (min)' },
      { simbolo: <><V>K</V>, <V>m</V>, <V>n</V></>, definicion: 'coeficientes de ajuste regional de la curva' },
    ],
    fuentes: [
      cita('vargas-diazgranados-1998', 'curvas IDF regionalizadas para Colombia'),
      cita('ras-0330', 'Art. 135, num. 2 (intensidad / curvas IDF)'),
      cita('bell-1969', 'relaciones lluvia–duración–frecuencia'),
    ],
  },
  // ─────────────────────── Estadística de extremos ───────────────────────
  'periodos-retorno': {
    id: 'periodos-retorno',
    titulo: 'Períodos de retorno · lluvia máxima diaria',
    resumen: 'Estima qué tan grande es la lluvia que, en promedio, se repite cada T años.',
    queEs:
      'Toma la lluvia máxima de cada año y le ajusta una distribución de valores extremos (Gumbel, GEV o Log-Pearson III, eligiendo la mejor por AIC). Con ese ajuste calcula los cuantiles: la lámina asociada a períodos de retorno de 2 a 100 años, con su banda de confianza.',
    comoSeLee:
      'Eje X: período de retorno en años (escala logarítmica). Eje Y: lluvia (mm/día). La línea es el ajuste, la banda sombreada el intervalo de confianza del 90%, y los puntos los valores observados (posición de Weibull).',
    paraQueSirve:
      'Cuantificar el riesgo: una obra para Tr 50 se diseña contra la lluvia que se espera, en promedio, una vez cada 50 años. La bondad del ajuste se verifica con la prueba de Kolmogorov-Smirnov.',
    formula: (
      <Formula>
        <V>x</V><Sub>T</Sub>&nbsp;=&nbsp;<V>μ</V> − <V>β</V> · ln(−ln(1 − 1/<V>T</V>))
      </Formula>
    ),
    variables: [
      { simbolo: <><V>x</V><Sub>T</Sub></>, definicion: 'lluvia estimada para el período de retorno T (mm)' },
      { simbolo: 'T', definicion: 'período de retorno (años)' },
      { simbolo: 'μ', definicion: 'parámetro de ubicación de la distribución Gumbel' },
      { simbolo: 'β', definicion: 'parámetro de escala de la distribución Gumbel' },
      { simbolo: 'ln', definicion: 'logaritmo natural' },
    ],
    fuentes: [
      cita('gumbel-1958', 'distribución de valores extremos'),
      cita('hosking-wallis-1997', 'ajuste por L-momentos'),
      cita('coles-2001', 'modelación de extremos (GEV)'),
      cita('invias-drenaje-2009', '§ 2.3.4.4 (pruebas de bondad de ajuste)'),
    ],
  },
  spi: {
    id: 'spi',
    titulo: 'Monitor de sequía · SPI',
    resumen: 'Mide si un período fue más seco o más húmedo de lo normal para esa estación.',
    queEs:
      'El Índice de Precipitación Estandarizada (SPI) compara la lluvia acumulada en una ventana (3, 6 o 12 meses) contra el historial de la estación y la expresa en desviaciones respecto a lo normal. Valores negativos indican sequía; positivos, exceso de lluvia.',
    comoSeLee:
      'Eje X: meses. Eje Y: SPI (de −3 a +3). Barras rojas/cafés = sequía (cuanto más bajo, más severa); barras azules = humedad por encima de lo normal; gris = cerca de lo normal.',
    paraQueSirve:
      'Seguir la evolución de sequías y excesos de lluvia, comparables entre estaciones y climas distintos.',
    fuentes: [
      cita('mckee-1993', 'definición del SPI'),
      cita('wmo-168-2008', 'guía de prácticas hidrológicas (OMM)'),
    ],
  },
  // ─────────────────────── Gráficas de exploración ───────────────────────
  hietograma: {
    id: 'hietograma',
    titulo: 'Hietograma mensual',
    resumen: 'Cuánta lluvia cayó cada mes del año elegido.',
    queEs:
      'Un hietograma reparte la lluvia en el tiempo. Aquí, en barras, muestra la lámina acumulada (mm) de cada mes del año seleccionado para la estación.',
    comoSeLee:
      'Eje X: meses del año. Eje Y: lluvia acumulada (mm). Las barras más altas son los meses más lluviosos; revela el régimen estacional (uni o bimodal en Colombia).',
    paraQueSirve:
      'Ver el reparto estacional de la lluvia y comparar años entre sí.',
    fuentes: [cita('poveda-2004', 'hidroclimatología de Colombia')],
  },
  histograma: {
    id: 'histograma',
    titulo: 'Histograma de acumulados diarios',
    resumen: 'Con qué frecuencia ocurren días de poca, media o mucha lluvia.',
    queEs:
      'Agrupa los días en rangos de lluvia (p. ej. 0–2 mm, 2–4 mm…) y cuenta cuántos días cayeron en cada rango. Es la distribución de frecuencias de la lluvia diaria de la estación.',
    comoSeLee:
      'Eje X: rangos de lluvia diaria (mm/día). Eje Y: número de días. La mayoría de días son secos o de poca lluvia; la cola derecha (pocos días muy lluviosos) es la que importa para el diseño de extremos.',
    paraQueSirve:
      'Entender el comportamiento típico y la frecuencia de los eventos fuertes de la estación.',
    fuentes: [],
  },
  'serie-temporal': {
    id: 'serie-temporal',
    titulo: 'Serie temporal',
    resumen: 'La evolución de la variable a lo largo del tiempo.',
    queEs:
      'Muestra el valor de la variable (lluvia, temperatura…) agregado por mes o por año, en el ámbito elegido (país, departamento o estación). Permite ver tendencias y años atípicos.',
    comoSeLee:
      'Eje X: tiempo (años o meses). Eje Y: la variable en sus unidades. El área bajo la curva ayuda a percibir la magnitud; picos y valles marcan años húmedos o secos.',
    paraQueSirve:
      'Detectar tendencias, ciclos y anomalías en el registro histórico.',
    fuentes: [],
  },
  climatologia: {
    id: 'climatologia',
    titulo: 'Climatología mensual',
    resumen: 'El promedio de cada mes y sus extremos a lo largo de todo el registro.',
    queEs:
      'La climatología resume el comportamiento típico del año: para cada mes muestra el valor medio histórico y los extremos (máximo y mínimo observados). Es el «año promedio» de la estación o el territorio.',
    comoSeLee:
      'Eje X: meses. La barra es la media mensual; las líneas marcan el máximo y el mínimo históricos de ese mes. La distancia entre ellas indica cuán variable es cada mes.',
    paraQueSirve:
      'Caracterizar el clima de un lugar y comparar un año concreto contra lo normal.',
    fuentes: [cita('wmo-168-2008', 'normales y climatología (OMM)')],
  },
  anomalias: {
    id: 'anomalias',
    titulo: 'Anomalías mensuales',
    resumen: 'Cuánto se apartó cada mes de su propio promedio histórico.',
    queEs:
      'La anomalía expresa, en porcentaje, si un mes llovió más o menos que su media histórica. Aísla la señal (¿fue húmedo o seco?) del ciclo estacional normal.',
    comoSeLee:
      'Eje X: meses recientes. Eje Y: desviación (%). Barras azules = más lluvia que lo normal; rojas = menos. La línea de 0% es el promedio histórico del mes.',
    paraQueSirve:
      'Identificar rachas húmedas o secas (p. ej. efectos de El Niño / La Niña) de forma comparable mes a mes.',
    formula: (
      <Formula>
        anomalía&nbsp;=&nbsp;<Frac num={<><V>P</V> − <Bar><V>P</V></Bar></>} den={<><Bar><V>P</V></Bar></>} /> · 100%
      </Formula>
    ),
    variables: [
      { simbolo: 'P', definicion: 'lluvia del mes (mm)' },
      { simbolo: <><Bar><V>P</V></Bar></>, definicion: 'promedio histórico de ese mismo mes (mm)' },
    ],
    fuentes: [cita('poveda-2004', 'variabilidad climática en Colombia')],
  },
  'top-departamentos': {
    id: 'top-departamentos',
    titulo: 'Top departamentos',
    resumen: 'Ranking de territorios por la variable elegida.',
    queEs:
      'Ordena los departamentos (o estaciones) según el volumen de observaciones o la magnitud de la variable, para ver de un vistazo dónde más se mide o más llueve.',
    comoSeLee:
      'Barras horizontales ordenadas de mayor a menor. La longitud de la barra es el valor; arriba está el primero del ranking.',
    paraQueSirve:
      'Comparar territorios y detectar dónde hay más cobertura de datos o mayores valores.',
    fuentes: [],
  },
  heatmap: {
    id: 'heatmap',
    titulo: 'Mapa de calor climático',
    resumen: 'Una cuadrícula donde el color indica cuánto llovió en cada celda de tiempo.',
    queEs:
      'Representa la lluvia como color en una matriz (años × meses, o días). El color codifica la magnitud: de tonos secos a tonos lluviosos. Permite ver muchos datos a la vez y descubrir patrones estacionales o años atípicos.',
    comoSeLee:
      'Cada celda es un período (un mes de un año, p. ej.). El color sigue la leyenda «seco → lluvioso»: cuanto más intenso, más lluvia. Las franjas horizontales o verticales revelan estaciones del año o años anómalos.',
    paraQueSirve:
      'Detectar patrones y anomalías en grandes volúmenes de datos sin leer tablas.',
    fuentes: [],
  },
  'comparador-series': {
    id: 'comparador-series',
    titulo: 'Series comparadas',
    resumen: 'Varias estaciones superpuestas para compararlas directamente.',
    queEs:
      'Dibuja la serie temporal de hasta cinco estaciones en el mismo gráfico, cada una con su color, para comparar su comportamiento lado a lado.',
    comoSeLee:
      'Eje X: tiempo. Eje Y: la variable. Cada color es una estación (ver leyenda). Líneas que suben y bajan juntas indican régimen similar; separaciones marcan diferencias locales.',
    paraQueSirve:
      'Comparar estaciones vecinas o de distintos climas y evaluar su representatividad.',
    fuentes: [],
  },
  'comparador-idf': {
    id: 'comparador-idf',
    titulo: 'Curvas IDF comparadas',
    resumen: 'Las curvas IDF de varias estaciones para un mismo período de retorno.',
    queEs:
      'Superpone la curva IDF (para un Tr elegido) de varias estaciones pluviográficas, para ver cuáles tienen lluvias más intensas a cada duración.',
    comoSeLee:
      'Ejes logarítmicos como en la IDF (duración vs intensidad). Cada color es una estación; la curva más alta es la de lluvias más intensas para ese Tr.',
    paraQueSirve:
      'Elegir la estación más representativa y conservadora para un proyecto sin estación propia.',
    fuentes: [cita('vargas-diazgranados-1998', 'curvas IDF regionalizadas para Colombia')],
  },
  'mapa-coropleta': {
    id: 'mapa-coropleta',
    titulo: 'Mapa temático (coropleta)',
    resumen: 'Pinta cada departamento según el valor de la variable elegida.',
    queEs:
      'Un mapa de coropletas colorea cada territorio según la magnitud de una variable (lluvia, temperatura…), de modo que el color comunica el dato sobre la geografía.',
    comoSeLee:
      'Sigue la leyenda de color y su rango (min–max) con su unidad. Los territorios sin dato quedan en gris. Más intenso = mayor valor.',
    paraQueSirve:
      'Ver la distribución espacial de una variable de un vistazo y comparar regiones.',
    fuentes: [],
  },
};

/** Secciones ordenadas para la página de Metodología. */
export const SECCIONES_METODOLOGIA: Array<{ titulo: string; ids: string[] }> = [
  {
    titulo: 'Cálculo de caudal de diseño',
    ids: ['metodo-racional', 'tiempo-concentracion', 'idf', 'coeficiente-c', 'factor-cf', 'manning'],
  },
  {
    titulo: 'Estadística de extremos e hidrología',
    ids: ['periodos-retorno', 'spi'],
  },
  {
    titulo: 'Gráficas de exploración',
    ids: [
      'serie-temporal',
      'climatologia',
      'anomalias',
      'hietograma',
      'histograma',
      'heatmap',
      'top-departamentos',
      'comparador-series',
      'comparador-idf',
      'mapa-coropleta',
    ],
  },
];
