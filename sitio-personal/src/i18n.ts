export type Lang = 'es' | 'en'

export const textos: Record<string, { es: string; en: string }> = {
  'nav.sub': { es: 'Ingeniería · Datos · IA', en: 'Engineering · Data · AI' },
  'nav.mundos': { es: 'Mundos', en: 'Worlds' },
  'nav.trayectoria': { es: 'Trayectoria', en: 'Journey' },
  'nav.proyectos': { es: 'Proyectos', en: 'Projects' },
  'nav.cv': { es: 'Hoja de vida', en: 'Resume' },
  'nav.contacto': { es: 'Contacto', en: 'Contact' },

  'hero.kicker': { es: 'Barranquilla, Colombia', en: 'Barranquilla, Colombia' },
  'hero.t1': { es: 'Ingeniería,', en: 'Engineering,' },
  'hero.t2': { es: 'datos', en: 'data' },
  'hero.t3': { es: 'y&nbsp;<em>personas</em>', en: 'and&nbsp;<em>people</em>' },
  'hero.t4': { es: 'en&nbsp;movimiento.', en: 'in&nbsp;motion.' },
  'hero.sub': {
    es: 'Ingeniero civil con tesis honorífica y analista de datos y workforce: 4 años optimizando operaciones globales (eBay, DoorDash, UnitedHealthcare) con Python, Power BI e IA generativa.',
    en: 'Civil engineer with an honors thesis and data and workforce analyst: 4 years optimizing global operations (eBay, DoorDash, UnitedHealthcare) with Python, Power BI and generative AI.',
  },
  'hero.btn1': { es: 'Explorar ↓', en: 'Explore ↓' },
  'hero.btn2': { es: 'Hoja de vida', en: 'Resume' },
  'hero.scroll': { es: 'SCROLL ↓', en: 'SCROLL ↓' },

  'mq.1': { es: 'Workforce', en: 'Workforce' },
  'mq.2': { es: 'Ingeniería civil', en: 'Civil engineering' },
  'mq.3': { es: 'Análisis de datos', en: 'Data analysis' },
  'mq.4': { es: 'Hidrología', en: 'Hydrology' },
  'mq.5': { es: 'Automatización', en: 'Automation' },
  'mq.6': { es: 'IA', en: 'AI' },

  'mundos.kicker': { es: 'Los cuatro mundos', en: 'The four worlds' },
  'mundos.titulo': {
    es: 'Distintas disciplinas,<br>una sola forma de pensar.',
    en: 'Different disciplines,<br>one way of thinking.',
  },
  'mundo1.t': { es: 'Workforce', en: 'Workforce' },
  'mundo1.p': {
    es: 'Operaciones globales en tiempo real: eBay, DoorDash, UnitedHealthcare, doxo y LendingUSA, con equipos de 300+ personas.',
    en: 'Global real-time operations: eBay, DoorDash, UnitedHealthcare, doxo and LendingUSA, with 300+ person teams.',
  },
  'mundo2.t': { es: 'Ingeniería civil', en: 'Civil engineering' },
  'mundo2.p': {
    es: 'Estructuras, vías e hidráulica: la base física sobre la que pasa todo lo demás.',
    en: 'Structures, roads and hydraulics: the physical foundation everything else runs on.',
  },
  'mundo3.t': { es: 'Datos', en: 'Data' },
  'mundo3.p': {
    es: 'De millones de registros crudos a dashboards y modelos que responden preguntas reales.',
    en: 'From millions of raw records to dashboards and models that answer real questions.',
  },
  'mundo4.t': { es: 'Hidrología', en: 'Hydrology' },
  'mundo4.p': {
    es: 'El agua como dato: lluvia, caudales y riesgo convertidos en herramientas para decidir.',
    en: 'Water as data: rainfall, flows and risk turned into tools for decision-making.',
  },

  'tray.kicker': { es: 'Trayectoria', en: 'Journey' },
  'tray.titulo': {
    es: 'Un recorrido entre la operación<br>y la ingeniería.',
    en: 'A path between operations<br>and engineering.',
  },
  'tray1.meta': { es: 'JUN 2022 – HOY · FOUNDEVER', en: 'JUN 2022 – PRESENT · FOUNDEVER' },
  'tray1.t': { es: 'Real Time Analyst | Workforce Analyst', en: 'Real Time Analyst | Workforce Analyst' },
  'tray1.p': {
    es: 'Gestión de workforce en tiempo real para campañas globales de alto volumen, coordinando 300+ agentes y el equilibrio entre nivel de servicio (SLA) y costos. NICE IEX, Alvaria, Power BI, Access y Excel avanzado.',
    en: 'Real-time workforce management for high-volume global campaigns, coordinating 300+ agents and the balance between service level (SLA) and costs. NICE IEX, Alvaria, Power BI, Access and advanced Excel.',
  },
  'tray1.btn': { es: 'Ver las cuentas que he manejado +', en: 'See the accounts I have managed +' },
  'tray1.btn.close': { es: 'Ocultar cuentas −', en: 'Hide accounts −' },
  'tray1.sub': {
    es: `<li><b>UnitedHealthcare</b> · dic 2022 – abr 2026 · Analista senior de la cuenta en Colombia: 300+ agentes, reforecasting intradía, dashboards automatizados de SLA, AHT y ocupación.</li>
<li><b>eBay</b> · abr 2025 – hoy · 100+ agentes de soporte: colas en vivo, adherencia y niveles de servicio con Alvaria, reportes en Access y Excel.</li>
<li><b>DoorDash</b> · dic 2025 – hoy · Operación de ventas de 20 FTE: adherencia y cobertura en tiempo real con NICE IEX.</li>
<li><b>doxo</b> · ene – dic 2025 · Datos crudos desde Amazon AWS y reportes de desempeño en Power BI, Access y Excel.</li>
<li><b>LendingUSA</b> · jun – dic 2023 · Campañas outbound y SMS de cobranza, reportes de adherencia para 30 FTE.</li>
<li><b>UnitedHealthcare (servicio bilingüe)</b> · jun – dic 2022 · Soporte Medicare de alto volumen bajo normas HIPAA.</li>`,
    en: `<li><b>UnitedHealthcare</b> · Dec 2022 – Apr 2026 · Senior analyst for the account in Colombia: 300+ agents, intraday reforecasting, automated SLA, AHT and occupancy dashboards.</li>
<li><b>eBay</b> · Apr 2025 – present · 100+ support agents: live queues, adherence and service levels with Alvaria, reporting in Access and Excel.</li>
<li><b>DoorDash</b> · Dec 2025 – present · 20 FTE sales operation: real-time adherence and coverage with NICE IEX.</li>
<li><b>doxo</b> · Jan – Dec 2025 · Raw data from Amazon AWS and performance reporting in Power BI, Access and Excel.</li>
<li><b>LendingUSA</b> · Jun – Dec 2023 · Outbound and SMS collections campaigns, adherence reporting for 30 FTE.</li>
<li><b>UnitedHealthcare (bilingual service)</b> · Jun – Dec 2022 · High-volume Medicare support under HIPAA rules.</li>`,
  },
  'tray2.meta': { es: 'AGO 2021 – DIC 2025 · UNIVERSIDAD DE LA COSTA (CUC)', en: 'AUG 2021 – DEC 2025 · UNIVERSIDAD DE LA COSTA (CUC)' },
  'tray2.t': { es: 'Ingeniero Civil, graduado con tesis honorífica', en: 'Civil Engineer, graduated with honors thesis' },
  'tray2.p': {
    es: 'Tesis honorífica: automatización inteligente de datos hidrometeorológicos del IDEAM con Python y Power BI. Promedio 4.34 (último semestre 4.74), monitor académico, alto puntaje en Saber Pro y representante nacional en RedCOLSI 2025 con 100/100.',
    en: 'Honors thesis: intelligent automation of IDEAM hydrometeorological data with Python and Power BI. GPA 4.34 (last semester 4.74), academic tutor, top-tier Saber Pro score and national representative at RedCOLSI 2025 with a perfect 100/100.',
  },
  'tray3.meta': { es: 'JUL 2022 · VERANO DE INVESTIGACIÓN (PROGRAMA DELFÍN)', en: 'JUL 2022 · RESEARCH SUMMER (DELFÍN PROGRAM)' },
  'tray3.t': { es: 'Investigación en ingeniería sísmica', en: 'Earthquake engineering research' },
  'tray3.p': {
    es: 'Análisis de acelerogramas en Barichara, Santander, con énfasis en el historial sísmico colombiano, junto a la Universidad Veracruzana y la Universidad Autónoma de Manizales.',
    en: 'Accelerogram analysis in Barichara, Santander, focused on Colombian seismic history, with Universidad Veracruzana and Universidad Autónoma de Manizales.',
  },
  'tray4.meta': { es: 'ENE 2020 – JUN 2021 · UNIVERSIDAD DEL NORTE', en: 'JAN 2020 – JUN 2021 · UNIVERSIDAD DEL NORTE' },
  'tray4.t': { es: 'Ingeniería Civil (inicio)', en: 'Civil Engineering (first years)' },
  'tray4.p': {
    es: 'Primeros semestres de la carrera. En 2021 también fui representante bilingüe de servicio para Walmart.com con Teleperformance.',
    en: 'First years of the degree. In 2021 I was also a bilingual customer service representative for Walmart.com with Teleperformance.',
  },

  'proy.kicker': { es: 'Proyectos', en: 'Projects' },
  'proy.titulo': { es: 'Lo que he construido.', en: 'What I have built.' },
  'proy1.t': { es: 'Hidrología nacional en la web', en: 'National hydrology on the web' },
  'proy1.p': {
    es: 'Plataforma con cientos de millones de registros del IDEAM: consultas, cálculo normativo, asistente con IA y reportes. Es mi tesis honorífica, en vivo.',
    en: 'A platform with hundreds of millions of IDEAM records: queries, code-compliant calculations, an AI assistant and reports. My honors thesis, live.',
  },
  'proy2.t': { es: 'Automatizador de datos públicos', en: 'Public data automator' },
  'proy2.p': {
    es: 'Paquete Python publicado en PyPI que extrae, valida y organiza datos abiertos de Colombia, con CLI y TUI.',
    en: 'A Python package on PyPI that extracts, validates and organizes Colombian open data, with its own CLI and TUI.',
  },
  'proy3.t': { es: 'Analítica para workforce', en: 'Workforce analytics' },
  'proy3.p': {
    es: 'Reportes automatizados y dashboards en Power BI, Access y Excel (DAX, VBA, Power Query) para operaciones globales en tiempo real.',
    en: 'Automated reports and dashboards in Power BI, Access and Excel (DAX, VBA, Power Query) for global real-time operations.',
  },

  'cv.kicker': { es: 'Hoja de vida', en: 'Resume' },
  'cv.titulo': {
    es: 'Léela aquí mismo,<br>sin descargar nada.',
    en: 'Read it right here,<br>no downloads needed.',
  },
  'stat1.lbl': { es: 'años en datos y workforce', en: 'years in data and workforce' },
  'stat2.lbl': { es: 'personas coordinadas', en: 'people coordinated' },
  'stat3.lbl': { es: 'certificaciones', en: 'certifications' },
  'stat4.lbl': { es: 'promedio de carrera / 5.0', en: 'degree GPA / 5.0' },
  'cv.pg1': { es: 'EXPERIENCIA', en: 'EXPERIENCE' },
  'cv.pg2': { es: 'EDUCACIÓN', en: 'EDUCATION' },
  'cv.libro': { es: '▲ clic para abrir el visor', en: '▲ click to open the viewer' },
  'cv.h': { es: 'Un visor interactivo, no un PDF.', en: 'An interactive viewer, not a PDF.' },
  'cv.p': {
    es: 'Haz clic en las páginas: se abre un visor animado con pestañas de español e inglés, mi perfil completo y las 29 certificaciones filtrables por tema, muchas con credencial verificable. La descarga en PDF queda como opción secundaria.',
    en: 'Click the pages: an animated viewer opens with Spanish and English tabs, my full profile and all 29 certifications filterable by topic, many with a verifiable credential. The PDF download stays as a secondary option.',
  },
  'cv.btn': { es: 'Abrir hoja de vida', en: 'Open resume' },

  'foot.kicker': { es: 'Contacto', en: 'Contact' },
  'foot.titulo': { es: '¿Construimos algo<br>con datos?', en: 'Shall we build something<br>with data?' },
  'foot.c1.t': { es: 'Correo personal', en: 'Personal email' },
  'foot.c1.p': { es: 'Se abre en tu app de correo', en: 'Opens in your mail app' },
  'foot.c2.t': { es: 'Correo institucional', en: 'University email' },
  'foot.c2.p': { es: 'Universidad de la Costa (CUC)', en: 'Universidad de la Costa (CUC)' },
  'foot.c3.t': { es: 'WhatsApp', en: 'WhatsApp' },
  'foot.c3.p': { es: 'Escríbeme directo al chat', en: 'Message me directly' },
  'foot.c4.t': { es: 'LinkedIn', en: 'LinkedIn' },
  'foot.c4.p': { es: 'Mi perfil profesional', en: 'My professional profile' },
  'foot.c5.t': { es: 'GitHub', en: 'GitHub' },
  'foot.c5.p': { es: 'Mi código abierto', en: 'My open source code' },
  'foot.c6.t': { es: 'Plataforma IDEAM', en: 'IDEAM Platform' },
  'foot.c6.p': { es: 'Mi tesis, en vivo', en: 'My thesis, live' },

  'cvv.descargar': { es: 'Descargar PDF', en: 'Download PDF' },
  'cvv.certs.h': { es: 'Certificaciones (29)', en: 'Certifications (29)' },
  'cvv.todas': { es: 'Todas', en: 'All' },
  'cvv.ver': { es: 'Ver credencial ↗', en: 'View credential ↗' },
}

export const cvPerfil: Record<Lang, string> = {
  es: `
    <div class="cv-sec"><h4>Perfil</h4><p>Analista de Datos y Workforce Management con más de 4 años optimizando operaciones para cuentas globales (eBay, LendingUSA, DoorDash, UnitedHealthcare y Just Energy) mediante automatización de flujos de trabajo. Ingeniero Civil graduado con tesis honorífica en automatización de datos. Especializado en Python, Power BI, IA generativa, Excel avanzado y manejo de datos.</p></div>
    <div class="cv-sec"><h4>Experiencia</h4>
      <p><b>Foundever · Real Time Analyst | Workforce Analyst</b> · Jun 2022 – Hoy · Barranquilla (remoto)</p>
      <ul>
        <li>Automatización de reportes con más del 50% de ahorro en tiempo de preparación.</li>
        <li>Modelos de datos complejos en Power BI y Excel con medidas DAX personalizadas.</li>
        <li>Planificación de personal por proyecciones de demanda: equilibrio entre cobertura SLA y costos.</li>
        <li>Cuentas: UnitedHealthcare (300+ agentes, analista senior), eBay (100+), DoorDash, doxo (datos desde AWS) y LendingUSA.</li>
      </ul>
      <p style="margin-top:10px"><b>Teleperformance · Representante bilingüe, Walmart.com</b> · Jun – Jul 2021</p>
    </div>
    <div class="cv-sec"><h4>Educación</h4><ul>
      <li><b>Universidad de la Costa (CUC)</b> · Ingeniería Civil · 2021 – Dic 2025 · Graduado con tesis honorífica (automatización de datos IDEAM con Python y Power BI), promedio 4.34, monitor académico, Saber Pro destacado y RedCOLSI 2025 con 100/100.</li>
      <li><b>Universidad del Norte</b> · Ingeniería Civil · 2020 – 2021.</li>
    </ul></div>
    <div class="cv-sec"><h4>Habilidades</h4><ul>
      <li><b>Técnicas:</b> Python, DAX, Excel avanzado (VBA, Power Query), Access, modelado relacional de datos.</li>
      <li><b>IA y automatización:</b> prompt engineering, integración de flujos con LLMs, IA generativa para análisis y código.</li>
      <li><b>Metodologías:</b> Workforce Management (WFM), Lean Six Sigma, gestión ágil.</li>
      <li><b>Idiomas:</b> español nativo, inglés C1.</li>
    </ul></div>`,
  en: `
    <div class="cv-sec"><h4>Profile</h4><p>Data and Workforce Management Analyst with over 4 years optimizing operations for global accounts (eBay, LendingUSA, DoorDash, UnitedHealthcare and Just Energy) through workflow automation. Civil Engineering graduate with an honors thesis on data automation. Specialized in Python, Power BI, generative AI, advanced Excel and data management.</p></div>
    <div class="cv-sec"><h4>Experience</h4>
      <p><b>Foundever · Real Time Analyst | Workforce Analyst</b> · Jun 2022 – Present · Barranquilla (remote)</p>
      <ul>
        <li>Report automation cutting preparation time by more than 50%.</li>
        <li>Complex data models in Power BI and Excel with custom DAX measures.</li>
        <li>Staff planning from demand forecasts: balancing SLA coverage and costs.</li>
        <li>Accounts: UnitedHealthcare (300+ agents, senior analyst), eBay (100+), DoorDash, doxo (data from AWS) and LendingUSA.</li>
      </ul>
      <p style="margin-top:10px"><b>Teleperformance · Bilingual representative, Walmart.com</b> · Jun – Jul 2021</p>
    </div>
    <div class="cv-sec"><h4>Education</h4><ul>
      <li><b>Universidad de la Costa (CUC)</b> · Civil Engineering · 2021 – Dec 2025 · Graduated with an honors thesis (IDEAM data automation with Python and Power BI), 4.34 GPA, academic tutor, top-tier Saber Pro score and RedCOLSI 2025 with 100/100.</li>
      <li><b>Universidad del Norte</b> · Civil Engineering · 2020 – 2021.</li>
    </ul></div>
    <div class="cv-sec"><h4>Skills</h4><ul>
      <li><b>Technical:</b> Python, DAX, advanced Excel (VBA, Power Query), Access, relational data modeling.</li>
      <li><b>AI and automation:</b> prompt engineering, LLM workflow integration, generative AI for analysis and code.</li>
      <li><b>Methodologies:</b> Workforce Management (WFM), Lean Six Sigma, agile management.</li>
      <li><b>Languages:</b> native Spanish, English C1.</li>
    </ul></div>`,
}

export type CertCat = 'ia' | 'datos' | 'civil' | 'gestion'

export interface Cert {
  nombre: string
  emisor: string
  fecha: string
  cat: CertCat
  /** ID de credencial en Coursera; permite generar enlace verificable */
  id?: string
  /** true si el ID corresponde a un certificado profesional (otra ruta de Coursera) */
  pro?: boolean
}

export const certCats: Record<CertCat, { es: string; en: string }> = {
  ia: { es: 'IA', en: 'AI' },
  datos: { es: 'Datos y BI', en: 'Data and BI' },
  civil: { es: 'Ingeniería civil', en: 'Civil engineering' },
  gestion: { es: 'Gestión y calidad', en: 'Management and quality' },
}

export const certificados: Cert[] = [
  { nombre: 'Google AI Professional Certificate', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'TAI0G1UUXH10', pro: true },
  { nombre: 'AI for App Building', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'AD7YJO90N838' },
  { nombre: 'AI for Data Analysis', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'LZWG9WQNBI1Z' },
  { nombre: 'AI for Content Creation', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'F0MS0CL8SCH7' },
  { nombre: 'AI for Writing and Communicating', emisor: 'Google', fecha: '2026', cat: 'ia', id: '6G22X94MAG8Q' },
  { nombre: 'AI for Research and Insights', emisor: 'Google', fecha: '2026', cat: 'ia', id: '8BDPWL9YNSAT' },
  { nombre: 'AI for Brainstorming and Planning', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'JWLUWSNA3A99' },
  { nombre: 'AI Fundamentals', emisor: 'Google', fecha: '2026', cat: 'ia', id: '2PE4RTGN12GV' },
  { nombre: 'Extract, Transform and Load Data in Power BI', emisor: 'Microsoft', fecha: '2025', cat: 'datos', id: 'EADX0QK2GVN1' },
  { nombre: 'Harnessing the Power of Data with Power BI', emisor: 'Microsoft', fecha: '2025', cat: 'datos', id: '8FMW0VG18DEI' },
  { nombre: 'Preparing Data for Analysis with Microsoft Excel', emisor: 'Microsoft', fecha: '2024', cat: 'datos', id: '63QNX2OO60XF' },
  { nombre: 'Work Smarter with Microsoft Excel (with Honors)', emisor: 'Microsoft', fecha: '2024', cat: 'datos', id: 'ZURI2G89MFQY' },
  { nombre: 'Fundamentos profesionales del análisis de datos', emisor: 'Microsoft + LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Aprende análisis de datos: ampliación y aplicación', emisor: 'LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Aprende análisis de datos: fundamentos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Data science: cuenta historias con los datos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Aprende análisis de datos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Data science: conceptos básicos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Habilidades profesionales en análisis de datos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos' },
  { nombre: 'Pavement Construction Practices (IRC and MoRTH)', emisor: 'L&T EduTech', fecha: '2025', cat: 'civil', id: 'ZUM0ULK71M65' },
  { nombre: 'Pavement Materials and Design (IRC and MoRTH)', emisor: 'L&T EduTech', fecha: '2025', cat: 'civil', id: '5YEALOLZJUE7' },
  { nombre: 'Highway Geometry and Pavement Design', emisor: 'L&T EduTech', fecha: '2025', cat: 'civil', id: '412024CLX6AV' },
  { nombre: 'Mastering Bitumen for Better Roads', emisor: 'École des Ponts ParisTech', fecha: '2025', cat: 'civil', id: '9YZMUVLMH7ZV' },
  { nombre: 'Verano de Investigación Científica (acelerogramas, Barichara)', emisor: 'U. Autónoma de Manizales', fecha: '2022', cat: 'civil' },
  { nombre: 'Foundations of Project Management', emisor: 'Google', fecha: '2025', cat: 'gestion', id: '83S2Z8CAOB4Z' },
  { nombre: 'Six Sigma White Belt', emisor: 'CSSC', fecha: '2023', cat: 'gestion' },
  { nombre: 'Redacción Científica', emisor: 'Universidad de la Costa', fecha: '2025', cat: 'gestion' },
  { nombre: 'Monitor académico UNICOSTA', emisor: 'Universidad de la Costa', fecha: '2022', cat: 'gestion' },
  { nombre: 'Semillero de investigación adjunto', emisor: 'Universidad de la Costa', fecha: '2022', cat: 'gestion' },
]

export const certUrl = (c: Cert): string | null =>
  c.id
    ? `https://www.coursera.org/account/accomplishments/${c.pro ? 'professional-cert' : 'verify'}/${c.id}`
    : null

export const metaDescripcion: Record<Lang, string> = {
  es: 'Portafolio de Sergio Beltrán Coley: ingeniería civil, análisis de datos, workforce e hidrología. Barranquilla, Colombia.',
  en: 'Portfolio of Sergio Beltrán Coley: civil engineering, data analytics, workforce and hydrology. Barranquilla, Colombia.',
}

export const titulos: Record<Lang, string> = {
  es: 'Sergio Beltrán Coley · Ingeniería, datos e IA',
  en: 'Sergio Beltrán Coley · Engineering, data and AI',
}
