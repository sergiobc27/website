// Departamentos de Colombia con su código DIVIPOLA/DANE (2 dígitos). Permite unir
// datos y geometrías por CÓDIGO en vez de por nombre, eliminando los alias frágiles
// (San Andrés, Bogotá D.C., Nariño). La clave es el nombre normalizado (mayúsculas,
// sin tildes), para resolver los nombres que llegan de la API o del catálogo.

export const DANE_POR_NOMBRE: Record<string, string> = {
  AMAZONAS: '91',
  ANTIOQUIA: '05',
  ARAUCA: '81',
  ATLANTICO: '08',
  BOLIVAR: '13',
  BOYACA: '15',
  CALDAS: '17',
  CAQUETA: '18',
  CASANARE: '85',
  CAUCA: '19',
  CESAR: '20',
  CHOCO: '27',
  CORDOBA: '23',
  CUNDINAMARCA: '25',
  GUAINIA: '94',
  GUAVIARE: '95',
  HUILA: '41',
  'LA GUAJIRA': '44',
  MAGDALENA: '47',
  META: '50',
  NARINO: '52',
  'NORTE DE SANTANDER': '54',
  PUTUMAYO: '86',
  QUINDIO: '63',
  RISARALDA: '66',
  SANTANDER: '68',
  SUCRE: '70',
  TOLIMA: '73',
  'VALLE DEL CAUCA': '76',
  VAUPES: '97',
  VICHADA: '99',
  // Bogotá D.C. y San Andrés: formas que usan la API y el GeoJSON antiguo.
  'BOGOTA D.C.': '11',
  'BOGOTA D.C': '11',
  'SANTAFE DE BOGOTA D.C': '11',
  'SAN ANDRES Y PROVIDENCIA': '88',
  'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA': '88',
};

/** Devuelve el código DIVIPOLA (2 dígitos) de un nombre de departamento, o null. */
export function daneDeDepartamento(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const key = nombre.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (DANE_POR_NOMBRE[key]) return DANE_POR_NOMBRE[key];
  // El catálogo del IDEAM trae el archipiélago en varias grafías (con coma, forma
  // larga, o con un carácter corrupto en "Andrés"): todas empiezan por "SAN ANDR".
  if (key.includes('SAN ANDR')) return '88';
  return null;
}
