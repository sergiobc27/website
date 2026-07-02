// Citas APA de los métodos usados en la calculadora. Centralizadas para reusar en
// tooltips y en el pie de "Método y referencias", y para que el trabajo sea trazable.

export interface Cita {
  clave: string;
  apa: string;
}

export const CITAS: Record<string, Cita> = {
  kirpich: {
    clave: 'Kirpich (1940)',
    apa: 'Kirpich, Z. P. (1940). Time of concentration of small agricultural watersheds. Civil Engineering, 10(6), 362.',
  },
  temez: {
    clave: 'Témez (1978)',
    apa: 'Témez Peláez, J. R. (1978). Cálculo hidrometeorológico de caudales máximos en pequeñas cuencas naturales. Dirección General de Carreteras, MOPU.',
  },
  giandotti: {
    clave: 'Giandotti (1934)',
    apa: 'Giandotti, M. (1934). Previsione delle piene e delle magre dei corsi d’acqua. Memorie e Studi Idrografici, 8, 107-117.',
  },
  manning: {
    clave: 'Manning (1891)',
    apa: 'Manning, R. (1891). On the flow of water in open channels and pipes. Transactions of the Institution of Civil Engineers of Ireland, 20, 161-207.',
  },
  chow: {
    clave: 'Chow (1988): factor de frecuencia y factores del Kirpich modificado',
    apa: 'Chow, V. T., Maidment, D. R., & Mays, L. W. (1988). Applied Hydrology. McGraw-Hill.',
  },
  ras0330: {
    clave: 'RAS 0330 (2017)',
    apa: 'Ministerio de Vivienda, Ciudad y Territorio. (2017). Resolución 0330: Reglamento Técnico para el Sector de Agua Potable y Saneamiento Básico (RAS).',
  },
  invias: {
    clave: 'INVÍAS (2009)',
    apa: 'Instituto Nacional de Vías. (2009). Manual de Drenaje para Carreteras. INVÍAS.',
  },
  velezBotero: {
    clave: 'Vélez & Botero (2011)',
    apa: 'Vélez Upegui, J. J., & Botero Gutiérrez, A. (2011). Estimación del tiempo de concentración y tiempo de rezago en la cuenca experimental urbana de la quebrada San Luis, Manizales. Dyna, 78(165), 58-71.',
  },
};
