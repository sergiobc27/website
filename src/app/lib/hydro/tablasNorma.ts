import type { Fuente } from './fuentes';
import { OBRAS_TR } from './runoff';

export interface TablaNorma {
  titulo: string;
  fuente: Fuente;
  columnas: string[];
  filas: Array<Array<string | number>>;
  nota?: string;
}

// ── Coeficiente de escorrentía C — áreas urbanas (INVÍAS 2009, Tabla 2.9) ──
export const TABLA_C_URBANA: TablaNorma = {
  titulo: 'Coeficiente de escorrentía C — áreas urbanas',
  fuente: { ref: 'invias-drenaje-2009', localizador: 'Tabla 2.9 (pág. 2-39)', verificado: true },
  columnas: ['Tipo de área de drenaje', 'C'],
  filas: [
    ['Prados — suelos arenosos, planos (2%)', '0,05 – 0,10'],
    ['Prados — suelos arenosos, promedio (2–7%)', '0,15 – 0,20'],
    ['Prados — suelos pesados (arcillosos), planos (2%)', '0,13 – 0,17'],
    ['Prados — suelos pesados (arcillosos), promedio (2–7%)', '0,18 – 0,22'],
    ['Prados — suelos pesados (arcillosos), pendientes (7%)', '0,25 – 0,35'],
    ['Distritos comerciales — áreas de centro de ciudad', '0,70 – 0,95'],
    ['Distritos comerciales — áreas vecinas', '0,50 – 0,70'],
    ['Residencial — casas individuales separadas', '0,30 – 0,50'],
    ['Residencial — casas multifamiliares separadas', '0,40 – 0,60'],
    ['Residencial — casas multifamiliares unidas', '0,60 – 0,75'],
    ['Residencial — suburbana', '0,25 – 0,40'],
    ['Residencial — áreas de apartamentos de vivienda', '0,50 – 0,70'],
    ['Industrial — áreas livianas', '0,50 – 0,80'],
    ['Industrial — áreas pesadas', '0,60 – 0,90'],
    ['Parques, cementerios', '0,10 – 0,25'],
    ['Campos de juego', '0,20 – 0,35'],
    ['Áreas de patios de ferrocarriles', '0,20 – 0,40'],
    ['Áreas no desarrolladas', '0,10 – 0,30'],
    ['Calles — asfaltadas', '0,70 – 0,95'],
    ['Calles — concreto', '0,80 – 0,95'],
    ['Calles — ladrillo', '0,70 – 0,85'],
    ['Calzadas y alamedas', '0,75 – 0,85'],
    ['Techos', '0,75 – 0,95'],
  ],
};

// ── Coeficiente de escorrentía C — áreas rurales (INVÍAS 2009, Tabla 2.10) ──
export const TABLA_C_RURAL: TablaNorma = {
  titulo: 'Coeficiente de escorrentía C — áreas rurales',
  fuente: { ref: 'invias-drenaje-2009', localizador: 'Tabla 2.10 (pág. 2-40)', verificado: true },
  columnas: ['Vegetación y topografía', 'Franco arenoso', 'Franco limo arcilloso', 'Arcilloso'],
  filas: [
    ['Bosques — plano', '0,10', '0,30', '0,40'],
    ['Bosques — ondulado', '0,25', '0,35', '0,50'],
    ['Bosques — montañoso', '0,30', '0,50', '0,60'],
    ['Pastos — plano', '0,10', '0,30', '0,40'],
    ['Pastos — ondulado', '0,16', '0,36', '0,55'],
    ['Pastos — montañoso', '0,22', '0,42', '0,60'],
    ['Tierras cultivadas — plano', '0,30', '0,50', '0,60'],
    ['Tierras cultivadas — ondulado', '0,40', '0,60', '0,70'],
    ['Tierras cultivadas — montañoso', '0,52', '0,72', '0,82'],
  ],
  nota: 'Plano: pendiente 0–5%. Ondulado: 5–10%. Montañoso: 10–30%. Para pendientes > 30%, a falta de datos, usar los valores de 10–30%.',
};

// ── Factor de frecuencia Cf del método racional (atribuido a Chow, 1988) ──
// NO aparece en el Manual INVÍAS. Se revisó la edición en español de Chow et al.
// (1988): su Tabla 15.1.1 (pág. 511) trae C directamente por período de retorno,
// no el multiplicador Cf, así que el localizador exacto sigue sin confirmarse
// (verificado:false) y la nota visible lo dice tal cual.
export const TABLA_CF: TablaNorma = {
  titulo: 'Factor de frecuencia Cf (ajuste de C por período de retorno)',
  fuente: {
    ref: 'chow-applied-1988',
    localizador: 'factor de frecuencia del método racional',
    verificado: false,
    nota: 'Multiplicadores de uso extendido en la práctica del método racional, atribuidos a Chow, Maidment & Mays (1988). En la edición consultada, la Tabla 15.1.1 trae C directamente por período de retorno (no el multiplicador Cf); el localizador exacto queda por confirmar.',
  },
  columnas: ['Período de retorno Tr (años)', 'Cf'],
  filas: [
    ['≤ 10', '1,00'],
    ['25', '1,10'],
    ['50', '1,20'],
    ['≥ 100', '1,25'],
  ],
  nota: 'C de diseño = mín(1; C · Cf).',
};

// ── Períodos de retorno: se derivan de OBRAS_TR (única fuente de verdad) ──
export const TABLA_TR_VIAL: TablaNorma = {
  titulo: 'Períodos de retorno de diseño — obras de drenaje vial',
  fuente: { ref: 'invias-drenaje-2009', localizador: 'Tabla 2.8 (pág. 2-31)', verificado: true },
  columnas: ['Tipo de obra', 'Tr (años)'],
  filas: OBRAS_TR.filter((o) => o.fuente.startsWith('INVÍAS')).map((o) => [o.label, o.tr]),
};

export const TABLA_TR_URBANO: TablaNorma = {
  titulo: 'Períodos de retorno de diseño — drenaje urbano (por área tributaria)',
  fuente: { ref: 'ras-0330', localizador: 'Art. 135, Tabla 16', verificado: true },
  columnas: ['Característica del área de drenaje', 'Tr (años)'],
  filas: OBRAS_TR.filter((o) => o.fuente.startsWith('RAS')).map((o) => [o.label, o.tr]),
};
