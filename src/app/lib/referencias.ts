// Biblioteca de referencias: fuentes normativas y académicas en las que se basa la
// plataforma. Datos estáticos (versionados en git). APA, DOI/enlace y coincidencia
// del PDF verificados con búsqueda web y lectura del PDF real (auditoría 2026-07-01):
// cada `url` resuelve al documento; los DOI se confirmaron contra Crossref/editorial.
// Solo se incluyen referencias verificadas y, etiquetadas aparte, las de "frontera de
// alcance" (lo que la herramienta NO calcula y remite).

export type Tema =
  | 'Normativa y guías colombianas'
  | 'Métodos hidrológicos e hidráulica'
  | 'Estadística de extremos'
  | 'Hidroclimatología y observación'
  | 'Erosión, suelo y balance hídrico'
  | 'Datos y formatos'
  | 'Frontera de alcance';

// Orden de presentación de los estantes.
export const TEMAS: Tema[] = [
  'Normativa y guías colombianas',
  'Métodos hidrológicos e hidráulica',
  'Estadística de extremos',
  'Hidroclimatología y observación',
  'Erosión, suelo y balance hídrico',
  'Datos y formatos',
  'Frontera de alcance',
];

export type Modulo = 'Calculadora' | 'Curvas IDF' | 'Período de retorno' | 'Asistente' | 'Mapa y datos';

export interface Referencia {
  id: string;
  apa: string;
  pais: 'Colombia' | 'Internacional';
  tema: Tema;
  anio: number;
  /** Enlace estable/oficial (DOI, editorial o gobierno) donde ubicar el original. Verificado. */
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
    url: 'https://www.invias.gov.co/publicaciones/4154/documentos-tecnicos/',
    usadoEn: ['Calculadora', 'Asistente'],
  },

  // ── Métodos hidrológicos e hidráulica ──────────────────────────────────────
  {
    id: 'vargas-diazgranados-1998',
    apa: 'Vargas M., R., & Díaz-Granados O., M. (1998). Curvas sintéticas regionalizadas de intensidad-duración-frecuencia para Colombia. En Memorias del XIII Seminario Nacional de Hidráulica e Hidrología. Sociedad Colombiana de Ingenieros.',
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
    apa: 'Témez Peláez, J. R. (1978). Cálculo hidrometeorológico de caudales máximos en pequeñas cuencas naturales. Ministerio de Obras Públicas y Urbanismo (MOPU), Secretaría General Técnica, Servicio de Publicaciones.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1978,
    url: 'https://www.transportes.gob.es/recursos_mfom/0610400.pdf',
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
    id: 'fischenich-2000',
    apa: 'Fischenich, C. (2000). Robert Manning: A historical perspective (EMRRP Technical Notes Collection, ERDC TN-EMRRP-SR-10). U.S. Army Engineer Research and Development Center.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 2000,
    url: 'https://apps.dtic.mil/sti/tr/pdf/ADA378362.pdf',
    usadoEn: ['Calculadora'],
  },
  {
    id: 'chow-1959',
    apa: 'Chow, V. T. (1959). Open-channel hydraulics. McGraw-Hill.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1959,
    url: 'https://archive.org/details/openchannelhydra0000chow',
    usadoEn: ['Calculadora'],
  },
  {
    id: 'chow-applied-1988',
    apa: 'Chow, V. T., Maidment, D. R., & Mays, L. W. (1988). Applied hydrology. McGraw-Hill.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1988,
    url: 'https://openlibrary.org/isbn/9780070108103',
    usadoEn: ['Calculadora', 'Período de retorno'],
  },
  {
    id: 'velez-botero-2011',
    apa: 'Vélez Upegui, J. J., & Botero Gutiérrez, A. (2011). Estimación del tiempo de concentración y tiempo de rezago en la cuenca experimental urbana de la quebrada San Luis, Manizales. Dyna, 78(165), 58-71.',
    pais: 'Colombia',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 2011,
    url: 'https://revistas.unal.edu.co/index.php/dyna/article/view/25640',
    usadoEn: ['Calculadora'],
  },
  {
    id: 'bell-1969',
    apa: 'Bell, F. C. (1969). Generalized rainfall-duration-frequency relationships. Journal of the Hydraulics Division, 95(1), 311-328.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1969,
    url: 'https://doi.org/10.1061/JYCEAJ.0001942',
    usadoEn: ['Curvas IDF'],
  },
  {
    id: 'scs-tr55-1986',
    apa: 'U.S. Department of Agriculture, Soil Conservation Service. (1986). Urban hydrology for small watersheds (2nd ed., Technical Release No. 55 [TR-55]). U.S. Department of Agriculture.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 1986,
    url: 'https://www.govinfo.gov/app/details/CZIC-gb980-u73-1986',
    usadoEn: ['Asistente'],
  },
  {
    id: 'neh-630-scs-cn',
    apa: 'Natural Resources Conservation Service. (2004). Chapter 10: Estimation of direct runoff from storm rainfall. En National Engineering Handbook, Part 630: Hydrology (210-VI-NEH). U.S. Department of Agriculture.',
    pais: 'Internacional',
    tema: 'Métodos hidrológicos e hidráulica',
    anio: 2004,
    url: 'https://directives.nrcs.usda.gov/sites/default/files2/1712930608/7300.pdf',
    usadoEn: ['Asistente'],
  },

  // ── Estadística de extremos ────────────────────────────────────────────────
  {
    id: 'gumbel-1958',
    apa: 'Gumbel, E. J. (1958). Statistics of extremes. Columbia University Press.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1958,
    url: 'https://doi.org/10.7312/gumb92958',
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
    id: 'stephens-1974',
    apa: 'Stephens, M. A. (1974). EDF statistics for goodness of fit and some comparisons. Journal of the American Statistical Association, 69(347), 730-737.',
    pais: 'Internacional',
    tema: 'Estadística de extremos',
    anio: 1974,
    url: 'https://doi.org/10.1080/01621459.1974.10480196',
    usadoEn: ['Período de retorno'],
  },

  // ── Hidroclimatología y observación ────────────────────────────────────────
  {
    id: 'poveda-2004',
    apa: 'Poveda, G. (2004). La hidroclimatología de Colombia: una síntesis desde la escala inter-decadal hasta la escala diurna. Revista de la Academia Colombiana de Ciencias Exactas, Físicas y Naturales, 28(107), 201-221.',
    pais: 'Colombia',
    tema: 'Hidroclimatología y observación',
    anio: 2004,
    url: 'https://doi.org/10.18257/raccefyn.28(107).2004.1991',
    usadoEn: ['Período de retorno', 'Asistente'],
  },
  {
    id: 'ena-2022',
    apa: 'Instituto de Hidrología, Meteorología y Estudios Ambientales. (2022). Estudio Nacional del Agua 2022 (ISBN 978-958-5489-12-7). Panamericana.',
    pais: 'Colombia',
    tema: 'Hidroclimatología y observación',
    anio: 2022,
    url: 'https://www.ideam.gov.co/nuestra-entidad/hidrologia/estudio-nacional-del-agua-2022',
    usadoEn: ['Asistente'],
  },
  {
    id: 'wmo-168-2008',
    apa: 'World Meteorological Organization. (2008). Guide to hydrological practices: Volume I. Hydrology – From measurement to hydrological information (6th ed., WMO-No. 168). WMO.',
    pais: 'Internacional',
    tema: 'Hidroclimatología y observación',
    anio: 2008,
    url: 'https://library.wmo.int/records/item/35804-guide-to-hydrological-practices-volume-i',
    usadoEn: ['Período de retorno', 'Asistente'],
  },
  {
    id: 'mckee-1993',
    apa: 'McKee, T. B., Doesken, N. J., & Kleist, J. (1993). The relationship of drought frequency and duration to time scales. En Proceedings of the 8th Conference on Applied Climatology (pp. 179-184). American Meteorological Society.',
    pais: 'Internacional',
    tema: 'Hidroclimatología y observación',
    anio: 1993,
    url: 'https://www.droughtmanagement.info/literature/AMS_Relationship_Drought_Frequency_Duration_Time_Scales_1993.pdf',
    usadoEn: ['Asistente'],
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
    url: 'https://www.ars.usda.gov/ARSUserFiles/60600505/RUSLE/AH_703%20-%20Predicting%20Soil%20Erosion%20by%20Water%20-%20A%20Guide%20to%20Conservation%20Planning%20With%20the%20RUSLE%20(RUSLE).pdf',
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
    apa: 'Thornthwaite, C. W., & Mather, J. R. (1957). Instructions and tables for computing potential evapotranspiration and the water balance. Publications in Climatology, 10(3), 185-311. Laboratory of Climatology, Drexel Institute of Technology.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1957,
    usadoEn: ['Asistente'],
  },
  {
    id: 'fao-56-1998',
    apa: 'Allen, R. G., Pereira, L. S., Raes, D., & Smith, M. (1998). Crop evapotranspiration: Guidelines for computing crop water requirements (FAO Irrigation and Drainage Paper No. 56). Food and Agriculture Organization of the United Nations.',
    pais: 'Internacional',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 1998,
    url: 'https://www.fao.org/4/x0490e/x0490e00.htm',
    usadoEn: ['Asistente'],
  },
  {
    id: 'erosion-ideam-2015',
    apa: 'Instituto de Hidrología, Meteorología y Estudios Ambientales, & Universidad de Ciencias Aplicadas y Ambientales. (2015). Síntesis del estudio nacional de la degradación de suelos por erosión en Colombia. IDEAM.',
    pais: 'Colombia',
    tema: 'Erosión, suelo y balance hídrico',
    anio: 2015,
    usadoEn: ['Asistente'],
  },

  // ── Datos y formatos (datum, metadatos, formatos e instrumentos) ───────────
  {
    id: 'magna-sirgas',
    apa: 'Instituto Geográfico Agustín Codazzi. (2005). Resolución 068 de 2005 (28 de enero), por la cual se adopta como único datum oficial de Colombia el Marco Geocéntrico Nacional de Referencia: MAGNA-SIRGAS. Diario Oficial No. 45.812.',
    pais: 'Colombia',
    tema: 'Datos y formatos',
    anio: 2005,
    url: 'https://www.igac.gov.co/transparencia-y-acceso-a-la-informacion-publica/normograma/resolucion-068-de-2005',
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'wmo-8-2018',
    apa: 'World Meteorological Organization. (2018). Guide to instruments and methods of observation (WMO-No. 8): Volume I – Measurement of meteorological variables (2018 ed.). World Meteorological Organization.',
    pais: 'Internacional',
    tema: 'Datos y formatos',
    anio: 2018,
    url: 'https://doi.org/10.59327/wmo/cimo/1',
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'iso-19115-2014',
    apa: 'International Organization for Standardization. (2014). Geographic information — Metadata — Part 1: Fundamentals (ISO Standard No. 19115-1:2014).',
    pais: 'Internacional',
    tema: 'Datos y formatos',
    anio: 2014,
    url: 'https://www.iso.org/standard/53798.html',
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'geojson-rfc7946',
    apa: 'Butler, H., Daly, M., Doyle, A., Gillies, S., Hagen, S., & Schaub, T. (2016). The GeoJSON format (RFC 7946). Internet Engineering Task Force (IETF).',
    pais: 'Internacional',
    tema: 'Datos y formatos',
    anio: 2016,
    url: 'https://doi.org/10.17487/RFC7946',
    usadoEn: ['Mapa y datos'],
  },
  {
    id: 'ogc-api-features',
    apa: 'Open Geospatial Consortium. (2019). OGC API - Features - Part 1: Core (Version 1.0, OGC 17-069r3).',
    pais: 'Internacional',
    tema: 'Datos y formatos',
    anio: 2019,
    url: 'https://docs.ogc.org/is/17-069r3/17-069r3.html',
    usadoEn: ['Mapa y datos'],
  },

  // ── Frontera de alcance (la herramienta NO lo calcula; se remite) ──────────
  {
    id: 'nsr10-titulo-h',
    apa: 'Asociación Colombiana de Ingeniería Sísmica. (2010). Reglamento Colombiano de Construcción Sismo Resistente NSR-10: Título H — Estudios geotécnicos (adoptado mediante el Decreto 926 del 19 de marzo de 2010).',
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
    url: 'https://trid.trb.org/View/1704698',
  },
  {
    id: 'hec-18-2012',
    apa: 'Arneson, L. A., Zevenbergen, L. W., Lagasse, P. F., & Clopper, P. E. (2012). Evaluating scour at bridges (5th ed., Hydraulic Engineering Circular No. 18, Report No. FHWA-HIF-12-003). Federal Highway Administration, U.S. Department of Transportation.',
    pais: 'Internacional',
    tema: 'Frontera de alcance',
    anio: 2012,
    url: 'https://www.fhwa.dot.gov/engineering/hydraulics/pubs/hif12003.pdf',
  },
  {
    id: 'fhwa-hds5-2012',
    apa: 'Schall, J. D., Thompson, P. L., Zerges, S. M., Kilgore, R. T., & Morris, J. L. (2012). Hydraulic design of highway culverts (3rd ed., Hydraulic Design Series No. 5, Report No. FHWA-HIF-12-026). Federal Highway Administration, U.S. Department of Transportation.',
    pais: 'Internacional',
    tema: 'Frontera de alcance',
    anio: 2012,
    url: 'https://www.fhwa.dot.gov/engineering/hydraulics/pubs/12026/hif12026.pdf',
  },
];

// ── PDFs hospedados (R2) ──────────────────────────────────────────────────────
// ids cuyo PDF está en el bucket R2 y se sirve en /fuentes/<id>.pdf (mismo origen,
// con noindex). Las referencias que no están aquí solo muestran su enlace "Ver
// fuente". Mantener en sync con la carpeta `fuentes-normativas/` y la subida a R2.
export const REFS_CON_PDF = new Set<string>([
  'ras-0330', 'invias-drenaje-2009', 'magna-sirgas', 'vargas-diazgranados-1998', 'temez-1978',
  'velez-botero-2011', 'chow-1959', 'chow-applied-1988', 'coles-2001', 'poveda-2004',
  'wmo-168-2008', 'mckee-1993', 'scs-tr55-1986', 'neh-630-scs-cn', 'rusle-1997',
  'fao-56-1998', 'nsr10-titulo-h', 'kirpich-1940', 'fhwa-hds5-2012', 'hec-18-2012',
  'green-ampt-1911', 'thornthwaite-mather-1957', 'ena-2022', 'erosion-ideam-2015',
  'ogc-api-features', 'geojson-rfc7946', 'fischenich-2000', 'stephens-1974',
]);

// Aclaración cuando el PDF hospedado NO es exactamente la edición/versión citada
// (variante legítima y de acceso libre de la misma obra). Verificado en la auditoría.
export const PDF_NOTAS: Record<string, string> = {
  'stephens-1974':
    'El PDF es el reporte técnico de 1972 (Stanford-ONR No. 186), precursor de acceso libre y de contenido equivalente al artículo de JASA (1974) citado. El artículo de revista está tras el DOI.',
  'ras-0330':
    'Se muestra la versión de texto buscable de la Resolución 0330 de 2017; el escaneo oficial también está disponible.',
  'temez-1978':
    'El PDF hospedado es la reimpresión revisada de 1987 (Dirección General de Carreteras); misma obra, autor y método que la 1.ª edición de 1978 citada.',
  'chow-applied-1988':
    'El PDF hospedado es la traducción autorizada al español (Hidrología aplicada, McGraw-Hill Interamericana, 1994); misma obra, autores y 1.ª edición que la cita en inglés.',
  'erosion-ideam-2015':
    'El PDF hospedado es la Síntesis del estudio; el atlas cartográfico completo se distribuye aparte.',
};

/** URL del PDF servido desde R2, o undefined si la referencia no tiene archivo. */
export function pdfUrl(id: string): string | undefined {
  return REFS_CON_PDF.has(id) ? `/fuentes/${id}.pdf` : undefined;
}

/** Si la referencia se ubica por DOI (url doi.org/…), devuelve el DOI "10.xxxx/…";
 * si no, null. Sirve para mostrar el identificador citable en la interfaz. */
export function doiDe(ref: Pick<Referencia, 'url'> | undefined): string | null {
  const m = ref?.url?.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Cuando no hay DOI, el host del enlace estable equivalente (p. ej.
 * "minvivienda.gov.co") para mostrarlo como identificador de la fuente. */
export function hostFuente(ref: Pick<Referencia, 'url'> | undefined): string | null {
  if (!ref?.url) return null;
  try {
    return new URL(ref.url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
