// Biblioteca de referencias: fuentes normativas y académicas en las que se basa la
// plataforma. Datos estáticos (versionados en git) — APA verificada del informe
// PANEL-NORMAS, más las canónicas que el código ya usa. `tema` y `usadoEn` asignados
// leyendo el código. Solo se incluyen referencias verificadas y, etiquetadas aparte,
// las de "frontera de alcance" (lo que la herramienta NO calcula y remite).

export type Tema =
  | 'Normativa y guías colombianas'
  | 'Métodos hidrológicos e hidráulica'
  | 'Estadística de extremos'
  | 'Hidroclimatología y observación'
  | 'Geomática y metadatos'
  | 'Erosión, suelo y balance hídrico'
  | 'Frontera de alcance';

// Orden de presentación de los estantes.
export const TEMAS: Tema[] = [
  'Normativa y guías colombianas',
  'Métodos hidrológicos e hidráulica',
  'Estadística de extremos',
  'Hidroclimatología y observación',
  'Geomática y metadatos',
  'Erosión, suelo y balance hídrico',
  'Frontera de alcance',
];

export type Modulo = 'Calculadora' | 'Curvas IDF' | 'Período de retorno' | 'Asistente' | 'Mapa y datos';

export interface Referencia {
  id: string;
  apa: string;
  pais: 'Colombia' | 'Internacional';
  tema: Tema;
  anio: number;
  url?: string;
  usadoEn?: Modulo[];
}

export const REFERENCIAS: Referencia[] = [
  // ── Normativa y guías colombianas ──────────────────────────────────────────
  {
    id: 'ras-0330',
    apa: 'Ministerio de Vivienda, Ciudad y Territorio. (2017). Resolución 0330 de 2017, por la cual se adopta el Reglamento Técnico para el Sector de Agua Potable y Saneamiento Básico (RAS). Diario Oficial No. 50.267.',
    pais: 'Colombia',
    tema: 'Normativa y guías colombianas',
    anio: 2017,
    url: 'https://www.minvivienda.gov.co/normativa/resolucion-0330-2017-0',
    usadoEn: ['Calculadora', 'Período de retorno', 'Asistente'],
  },
  {
    id: 'invias-drenaje-2009',
    apa: 'Instituto Nacional de Vías. (2009). Manual de drenaje para carreteras. Ministerio de Transporte, República de Colombia.',
    pais: 'Colombia',
    tema: 'Normativa y guías colombianas',
    anio: 2009,
    usadoEn: ['Calculadora', 'Asistente'],
  },
  {
    id: 'magna-sirgas',
    apa: 'Instituto Geográfico Agustín Codazzi. (2005). Resolución 068 de 2005, por la cual se adopta como único datum oficial de Colombia el Marco Geocéntrico Nacional de Referencia: MAGNA-SIRGAS. IGAC.',
    pais: 'Colombia',
    tema: 'Normativa y guías colombianas',
    anio: 2005,
    url: 'https://www.igac.gov.co/transparencia-y-acceso-a-la-informacion-publica/normograma/resolucion-068-de-2005',
    usadoEn: ['Mapa y datos'],
  },

  // ── Métodos hidrológicos e hidráulica ──────────────────────────────────────
  {
    id: 'vargas-diazgranados-1998',
    apa: 'Vargas, R., & Díaz-Granados, M. (1998). Curvas sintéticas regionalizadas de intensidad-duración-frecuencia para Colombia. Universidad de los Andes.',
    pais: 'Colombia',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1998,
    usadoEn: ['Curvas IDF', 'Asistente'],
  },
  {
    id: 'kirpich-1940',
    apa: 'Kirpich, Z. P. (1940). Time of concentration of small agricultural watersheds. Civil Engineering, 10(6), 362.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1940,
    usadoEn: ['Calculadora'],
  },
  {
    id: 'temez-1978',
    apa: 'Témez Peláez, J. R. (1978). Cálculo hidrometeorológico de caudales máximos en pequeñas cuencas naturales. Dirección General de Carreteras, Ministerio de Obras Públicas y Urbanismo (MOPU).',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1978,
    usadoEn: ['Calculadora'],
  },
  {
    id: 'giandotti-1934',
    apa: 'Giandotti, M. (1934). Previsione delle piene e delle magre dei corsi d’acqua. Memorie e Studi Idrografici, 8, 107-117.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1934,
    usadoEn: ['Calculadora'],
  },
  {
    id: 'manning-1891',
    apa: 'Manning, R. (1891). On the flow of water in open channels and pipes. Transactions of the Institution of Civil Engineers of Ireland, 20, 161-207.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1891,
    usadoEn: ['Calculadora'],
  },
  {
    id: 'chow-1959',
    apa: 'Chow, V. T. (1959). Open-channel hydraulics. McGraw-Hill.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1959,
    usadoEn: ['Calculadora'],
  },
  {
    id: 'velez-botero-2011',
    apa: 'Vélez Upegui, J. J., & Botero Gutiérrez, A. (2011). Estimación del tiempo de concentración y tiempo de rezago en la cuenca experimental urbana de la quebrada San Luis, Manizales. Dyna, 78(165), 58-71.',
    pais: 'Colombia',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 2011,
    usadoEn: ['Calculadora'],
  },
  {
    id: 'bell-1969',
    apa: 'Bell, F. C. (1969). Generalized rainfall-duration-frequency relationships. Journal of the Hydraulics Division, 95(1), 311-327.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1969,
    url: 'https://doi.org/10.1061/JYCEAJ.0002007',
    usadoEn: ['Curvas IDF'],
  },
  {
    id: 'scs-tr55-1986',
    apa: 'U.S. Department of Agriculture, Soil Conservation Service. (1986). Urban hydrology for small watersheds (2nd ed., Technical Release No. 55 [TR-55]). U.S. Department of Agriculture.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1986,
  },
  {
    id: 'neh-630-scs-cn',
    apa: 'Natural Resources Conservation Service. (2004). Chapter 10: Estimation of direct runoff from storm rainfall. En National Engineering Handbook, Part 630: Hydrology (210-VI-NEH). U.S. Department of Agriculture.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 2004,
    url: 'https://irrigationtoolbox.com/NEH/Part630_Hydrology/H_210_630_10.pdf',
  },
  {
    id: 'snyder-1938',
    apa: 'Snyder, F. F. (1938). Synthetic unit-graphs. Transactions, American Geophysical Union, 19(1), 447-454.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1938,
    url: 'https://doi.org/10.1029/TR019i001p00447',
  },
  {
    id: 'fhwa-hds2-2002',
    apa: 'McCuen, R. H., Johnson, P. A., & Ragan, R. M. (2002). Highway hydrology (Hydraulic Design Series No. 2, 2nd ed., FHWA-NHI-02-001). Federal Highway Administration, U.S. Department of Transportation.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 2002,
  },

  // ── Estadística de extremos ────────────────────────────────────────────────
  {
    id: 'gumbel-1958',
    apa: 'Gumbel, E. J. (1958). Statistics of extremes. Columbia University Press.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1958,
    usadoEn: ['Período de retorno', 'Asistente'],
  },
  {
    id: 'kendall-1975',
    apa: 'Kendall, M. G. (1975). Rank correlation methods (4th ed.). Charles Griffin.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1975,
    usadoEn: ['Período de retorno', 'Asistente'],
  },
  {
    id: 'hosking-wallis-1997',
    apa: 'Hosking, J. R. M., & Wallis, J. R. (1997). Regional frequency analysis: An approach based on L-moments. Cambridge University Press.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1997,
    url: 'https://doi.org/10.1017/CBO9780511529443',
    usadoEn: ['Período de retorno'],
  },
  {
    id: 'coles-2001',
    apa: 'Coles, S. (2001). An introduction to statistical modeling of extreme values. Springer.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 2001,
    url: 'https://doi.org/10.1007/978-1-4471-3675-0',
    usadoEn: ['Período de retorno'],
  },
  {
    id: 'kite-1977',
    apa: 'Kite, G. W. (1977). Frequency and risk analyses in hydrology. Water Resources Publications.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1977,
    usadoEn: ['Período de retorno'],
  },
  {
    id: 'stephens-1974',
    apa: 'Stephens, M. A. (1974). EDF statistics for goodness of fit and some comparisons. Journal of the American Statistical Association, 69(347), 730-737.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1974,
    url: 'https://doi.org/10.1080/01621459.1974.10480196',
    usadoEn: ['Período de retorno'],
  },
  {
    id: 'pettitt-1979',
    apa: 'Pettitt, A. N. (1979). A non-parametric approach to the change-point problem. Journal of the Royal Statistical Society. Series C (Applied Statistics), 28(2), 126-135.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1979,
    url: 'https://doi.org/10.2307/2346729',
    usadoEn: ['Período de retorno'],
  },

  // ── Hidroclimatología y observación ────────────────────────────────────────
  {
    id: 'poveda-2004',
    apa: 'Poveda, G. (2004). La hidroclimatología de Colombia: una síntesis desde la escala inter-decadal hasta la escala diurna. Revista de la Academia Colombiana de Ciencias Exactas, Físicas y Naturales, 28(107), 201-222.',
    pais: 'Colombia',
    tema: 'Hidroclimatología y observación',
    anio: 2004,
    url: 'https://doi.org/10.18257/raccefyn.28(107).2004.1991',
    usadoEn: ['Período de retorno', 'Asistente'],
  },
  {
    id: 'ena-2022',
    apa: 'Instituto de Hidrología, Meteorología y Estudios Ambientales. (2023). Estudio Nacional del Agua 2022. IDEAM.',
    pais: 'Colombia',
    tema: 'Hidroclimatología y observación',
    anio: 2023,
    url: 'https://www.ideam.gov.co/sala-de-prensa/informes/publicacion-jue-23032023-1200',
    usadoEn: ['Asistente'],
  },
  {
    id: 'wmo-168-2008',
    apa: 'World Meteorological Organization. (2008). Guide to hydrological practices: Volume I. Hydrology – From measurement to hydrological information (6th ed., WMO-No. 168). World Meteorological Organization.',
    pais: 'Internacional',
    tema: 'Hidroclimatología y observación',
    anio: 2008,
    usadoEn: ['Período de retorno', 'Asistente'],
  },
  {
    id: 'wmo-8-2018',
    apa: 'World Meteorological Organization. (2018). Guide to instruments and methods of observation (WMO-No. 8): Volume I – Measurement of meteorological variables (2018 ed.). World Meteorological Organization.',
    pais: 'Internacional',
    tema: 'Hidroclimatología y observación',
    anio: 2018,
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'mckee-1993',
    apa: 'McKee, T. B., Doesken, N. J., & Kleist, J. (1993). The relationship of drought frequency and duration to time scales. En Proceedings of the 8th Conference on Applied Climatology (pp. 179-184). American Meteorological Society.',
    pais: 'Internacional',
    tema: 'Hidroclimatología y observación',
    anio: 1993,
    usadoEn: ['Asistente'],
  },

  // ── Geomática y metadatos ──────────────────────────────────────────────────
  {
    id: 'iso-19115-2014',
    apa: 'International Organization for Standardization. (2014). Geographic information — Metadata — Part 1: Fundamentals (ISO Standard No. 19115-1:2014).',
    pais: 'Internacional',
    tema: 'Geomática y metadatos',
    anio: 2014,
    url: 'https://www.iso.org/standard/53798.html',
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'geojson-rfc7946',
    apa: 'Butler, H., Daly, M., Doyle, A., Gillies, S., Hagen, S., & Schaub, T. (2016). The GeoJSON format (RFC 7946). RFC Editor.',
    pais: 'Internacional',
    tema: 'Geomática y metadatos',
    anio: 2016,
    url: 'https://doi.org/10.17487/RFC7946',
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'ogc-api-features',
    apa: 'Open Geospatial Consortium. (2019). OGC API - Features - Part 1: Core (Version 1.0, OGC 17-069r3).',
    pais: 'Internacional',
    tema: 'Geomática y metadatos',
    anio: 2019,
    url: 'https://docs.ogc.org/is/17-069r3/17-069r3.html',
    usadoEn: ['Mapa y datos'],
  },

  // ── Erosión, suelo y balance hídrico ───────────────────────────────────────
  {
    id: 'green-ampt-1911',
    apa: 'Green, W. H., & Ampt, G. A. (1911). Studies on soil physics: Part I. The flow of air and water through soils. The Journal of Agricultural Science, 4(1), 1-24.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1911,
    url: 'https://doi.org/10.1017/S0021859600001441',
    usadoEn: ['Asistente'],
  },
  {
    id: 'rusle-1997',
    apa: 'Renard, K. G., Foster, G. R., Weesies, G. A., McCool, D. K., & Yoder, D. C. (1997). Predicting soil erosion by water: A guide to conservation planning with the Revised Universal Soil Loss Equation (RUSLE) (Agriculture Handbook No. 703). U.S. Department of Agriculture.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1997,
    usadoEn: ['Asistente'],
  },
  {
    id: 'caine-1980',
    apa: 'Caine, N. (1980). The rainfall intensity–duration control of shallow landslides and debris flows. Geografiska Annaler: Series A, Physical Geography, 62(1–2), 23-27.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1980,
    url: 'https://doi.org/10.1080/04353676.1980.11879996',
    usadoEn: ['Asistente'],
  },
  {
    id: 'thornthwaite-mather-1957',
    apa: 'Thornthwaite, C. W., & Mather, J. R. (1957). Instructions and tables for computing potential evapotranspiration and the water balance. Publications in Climatology, 10(3), 185-311. Drexel Institute of Technology.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1957,
    usadoEn: ['Asistente'],
  },
  {
    id: 'fao-56-1998',
    apa: 'Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). Crop evapotranspiration: Guidelines for computing crop water requirements (FAO Irrigation and Drainage Paper No. 56). FAO.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1998,
    usadoEn: ['Asistente'],
  },
  {
    id: 'erosion-ideam-2015',
    apa: 'Instituto de Hidrología, Meteorología y Estudios Ambientales, Ministerio de Ambiente y Desarrollo Sostenible, & Universidad de Ciencias Aplicadas y Ambientales. (2015). Estudio nacional de la degradación de suelos por erosión en Colombia. IDEAM.',
    pais: 'Colombia',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 2015,
    usadoEn: ['Asistente'],
  },

  // ── Frontera de alcance (la herramienta NO lo calcula; se remite) ──────────
  {
    id: 'nsr10-titulo-h',
    apa: 'Asociación Colombiana de Ingeniería Sísmica. (2010). Reglamento Colombiano de Construcción Sismo Resistente NSR-10: Título H — Estudios geotécnicos. Adoptado mediante el Decreto 926 de 2010.',
    pais: 'Colombia',
    tema: 'Frontera de alcance',
    anio: 2010,
    url: 'https://www.scg.org.co/Titulo-H-NSR-10-Decreto%20Final-2010-01-14.pdf',
  },
  {
    id: 'aashto-lrfd-2020',
    apa: 'American Association of State Highway and Transportation Officials. (2020). AASHTO LRFD bridge design specifications (9th ed.). AASHTO.',
    pais: 'Internacional',
    tema: 'Frontera de alcance',
    anio: 2020,
  },
  {
    id: 'hec-18-2012',
    apa: 'Arneson, L. A., Zevenbergen, L. W., Lagasse, P. F., & Clopper, P. E. (2012). Evaluating scour at bridges (5th ed., Hydraulic Engineering Circular No. 18, FHWA-HIF-12-003). Federal Highway Administration, U.S. Department of Transportation.',
    pais: 'Internacional',
    tema: 'Frontera de alcance',
    anio: 2012,
  },
  {
    id: 'fhwa-hds5-2012',
    apa: 'Schall, J. D., Thompson, P. L., Zerges, S. M., Kilgore, R. T., & Morris, J. L. (2012). Hydraulic design of highway culverts (3rd ed., Hydraulic Design Series No. 5, FHWA-HIF-12-026). Federal Highway Administration, U.S. Department of Transportation.',
    pais: 'Internacional',
    tema: 'Frontera de alcance',
    anio: 2012,
  },
];
