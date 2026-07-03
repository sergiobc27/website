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
    es: 'Conecto la ingeniería civil, la analítica de datos, la gestión de equipos y la hidrología para convertir información en decisiones.',
    en: 'I connect civil engineering, data analytics, team management and hydrology to turn information into decisions.',
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
    es: 'Equipos de 300+ personas coordinados con proyecciones, cobertura y decisiones en tiempo real.',
    en: 'Teams of 300+ people coordinated with forecasts, coverage and real-time decisions.',
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
    es: 'Planificación operativa de una cuenta de salud de EE. UU.: automatización de reportes con más del 50% de ahorro en tiempo, dashboards dinámicos y liderazgo senior de la operación.',
    en: 'Operational planning for a US healthcare account: report automation saving over 50% of preparation time, dynamic dashboards and senior leadership of the operation.',
  },
  'tray2.meta': { es: 'AGO 2021 – HOY · UNIVERSIDAD DE LA COSTA (CUC)', en: 'AUG 2021 – PRESENT · UNIVERSIDAD DE LA COSTA (CUC)' },
  'tray2.t': { es: 'Ingeniería Civil, énfasis en Caminos', en: 'Civil Engineering, Highway emphasis' },
  'tray2.p': {
    es: 'Trabajo de grado: plataforma de automatización de datos hidrológicos a escala nacional. Monitor y semillero de investigación.',
    en: 'Thesis project: nationwide hydrological data automation platform. Teaching assistant and research group member.',
  },
  'tray3.meta': { es: '2020 – 2021 · UNIVERSIDAD DEL NORTE', en: '2020 – 2021 · UNIVERSIDAD DEL NORTE' },
  'tray3.t': { es: 'Ingeniería Civil (inicio)', en: 'Civil Engineering (first years)' },
  'tray3.p': {
    es: 'Investigación aplicada en análisis de sismogramas junto a la Universidad Veracruzana (México).',
    en: 'Applied research in seismogram analysis with Universidad Veracruzana (Mexico).',
  },

  'proy.kicker': { es: 'Proyectos', en: 'Projects' },
  'proy.titulo': { es: 'Lo que he construido.', en: 'What I have built.' },
  'proy1.thumb': { es: 'Plataforma de datos ↗', en: 'Data platform ↗' },
  'proy1.t': { es: 'Hidrología nacional en la web', en: 'National hydrology on the web' },
  'proy1.p': {
    es: 'Plataforma con cientos de millones de registros: consultas, cálculo normativo, asistente con IA y reportes.',
    en: 'A platform with hundreds of millions of records: queries, code-compliant calculations, an AI assistant and reports.',
  },
  'proy2.thumb': { es: 'Código abierto ↗', en: 'Open source ↗' },
  'proy2.t': { es: 'Automatizador de datos públicos', en: 'Public data automator' },
  'proy2.p': {
    es: 'Paquete Python publicado en PyPI que extrae, valida y organiza datos abiertos de Colombia, con CLI y TUI.',
    en: 'A Python package on PyPI that extracts, validates and organizes Colombian open data, with its own CLI and TUI.',
  },
  'proy3.thumb': { es: 'Operación en vivo', en: 'Live operations' },
  'proy3.t': { es: 'Analítica para workforce', en: 'Workforce analytics' },
  'proy3.p': {
    es: 'Reportes automatizados y dashboards para gestionar en tiempo real una operación de 300+ colaboradores.',
    en: 'Automated reports and dashboards to manage a 300+ employee operation in real time.',
  },

  'cv.kicker': { es: 'Hoja de vida', en: 'Resume' },
  'cv.titulo': {
    es: 'Léela aquí mismo,<br>sin descargar nada.',
    en: 'Read it right here,<br>no downloads needed.',
  },
  'stat1.lbl': { es: 'años en datos', en: 'years in data' },
  'stat2.lbl': { es: 'personas coordinadas', en: 'people coordinated' },
  'stat3.lbl': { es: 'certificaciones', en: 'certifications' },
  'stat4.lbl': { es: 'idiomas (ES / EN C1)', en: 'languages (ES / EN C1)' },
  'cv.pg1': { es: 'EXPERIENCIA', en: 'EXPERIENCE' },
  'cv.pg2': { es: 'EDUCACIÓN', en: 'EDUCATION' },
  'cv.libro': { es: '▲ clic para abrir el visor', en: '▲ click to open the viewer' },
  'cv.h': { es: 'Un visor interactivo, no un PDF.', en: 'An interactive viewer, not a PDF.' },
  'cv.p': {
    es: 'Haz clic en las páginas: se abre un visor animado con pestañas de español e inglés, secciones que entran por pasos y las 12 certificaciones completas. La descarga en PDF queda como opción secundaria dentro del visor.',
    en: 'Click the pages: an animated viewer opens with Spanish and English tabs, staggered sections and all 12 certifications. The PDF download stays as a secondary option inside the viewer.',
  },
  'cv.btn': { es: 'Abrir hoja de vida', en: 'Open resume' },

  'foot.kicker': { es: 'Contacto', en: 'Contact' },
  'foot.titulo': { es: '¿Construimos algo<br>con datos?', en: 'Shall we build something<br>with data?' },
  'foot.plat': { es: 'Plataforma IDEAM ↗', en: 'IDEAM Platform ↗' },

  'cvv.descargar': { es: 'Descargar PDF', en: 'Download PDF' },
}

export const cvContenido: Record<Lang, string> = {
  es: `
    <div class="cv-sec"><h4>Perfil</h4><p>Más de 2 años como Real Time Analyst en Foundever, liderando la planificación operativa de la cuenta UnitedHealthcare. Estudiante de Ingeniería Civil con investigación aplicada (análisis de sismogramas con la Universidad Veracruzana). Apasionado por la analítica de datos, con certificaciones avanzadas en Excel y Power BI.</p></div>
    <div class="cv-sec"><h4>Experiencia</h4><p><b>Foundever · Real Time Analyst | Workforce Analyst</b> · Jun 2022 – Hoy</p><ul><li>Automatización de reportes: reducción de más del 50% en tiempos de preparación.</li><li>Dashboards dinámicos para métricas críticas en tiempo real.</li><li>Planificación de personal según proyecciones de demanda.</li><li>Liderazgo senior sobre una cuenta de 300+ colaboradores.</li></ul></div>
    <div class="cv-sec"><h4>Educación</h4><ul><li><b>Universidad de la Costa (CUC)</b> · Ingeniería Civil, énfasis en Caminos · 2021 – Hoy</li><li><b>Universidad del Norte</b> · Ingeniería Civil · 2020 – 2021</li></ul></div>
    <div class="cv-sec"><h4>Certificaciones (12)</h4><ul class="cert-grid">
      <li>Preparing Data for Analysis with Microsoft Excel · Microsoft</li>
      <li>Work Smarter with Microsoft Excel (with Honors) · Microsoft</li>
      <li>Fundamentos profesionales del análisis de datos · Microsoft + LinkedIn</li>
      <li>Aprende análisis de datos: ampliación y aplicación · LinkedIn</li>
      <li>Aprende análisis de datos: fundamentos · LinkedIn</li>
      <li>Data science: cuenta historias con los datos · LinkedIn</li>
      <li>Aprende análisis de datos · LinkedIn</li>
      <li>Data science: conceptos básicos · LinkedIn</li>
      <li>Habilidades profesionales en análisis de datos · LinkedIn</li>
      <li>Six Sigma White Belt · CSSC</li>
      <li>Monitor UNICOSTA 2022-1 · Universidad de la Costa</li>
      <li>Semillero Adjunto · Universidad de la Costa</li>
    </ul></div>`,
  en: `
    <div class="cv-sec"><h4>Profile</h4><p>Over 2 years as a Real Time Analyst at Foundever, leading operational planning for the UnitedHealthcare account. Civil Engineering student with applied research experience (seismogram analysis with Universidad Veracruzana). Passionate about data analytics, with advanced Excel and Power BI certifications.</p></div>
    <div class="cv-sec"><h4>Experience</h4><p><b>Foundever · Real Time Analyst | Workforce Analyst</b> · Jun 2022 – Present</p><ul><li>Report automation: over 50% reduction in preparation time.</li><li>Dynamic dashboards for real-time critical metrics.</li><li>Staff planning based on demand forecasts.</li><li>Senior leadership over a 300+ employee account.</li></ul></div>
    <div class="cv-sec"><h4>Education</h4><ul><li><b>Universidad de la Costa (CUC)</b> · Civil Engineering, Highway emphasis · 2021 – Present</li><li><b>Universidad del Norte</b> · Civil Engineering · 2020 – 2021</li></ul></div>
    <div class="cv-sec"><h4>Certifications (12)</h4><ul class="cert-grid">
      <li>Preparing Data for Analysis with Microsoft Excel · Microsoft</li>
      <li>Work Smarter with Microsoft Excel (with Honors) · Microsoft</li>
      <li>Professional Fundamentals of Data Analysis · Microsoft + LinkedIn</li>
      <li>Learn Data Analysis: Expanding and Applying · LinkedIn</li>
      <li>Learn Data Analysis: Fundamentals · LinkedIn</li>
      <li>Data Science: Telling Stories with Data · LinkedIn</li>
      <li>Learn Data Analysis · LinkedIn</li>
      <li>Data Science: Basic Concepts · LinkedIn</li>
      <li>Professional Skills in Data Analysis · LinkedIn</li>
      <li>Six Sigma White Belt · CSSC</li>
      <li>Monitor UNICOSTA 2022-1 · Universidad de la Costa</li>
      <li>Semillero Adjunto · Universidad de la Costa</li>
    </ul></div>`,
}

export const metaDescripcion: Record<Lang, string> = {
  es: 'Portafolio de Sergio Beltrán Coley: ingeniería civil, análisis de datos, workforce e hidrología. Barranquilla, Colombia.',
  en: 'Portfolio of Sergio Beltrán Coley: civil engineering, data analytics, workforce and hydrology. Barranquilla, Colombia.',
}

export const titulos: Record<Lang, string> = {
  es: 'Sergio Beltrán Coley · Ingeniería, datos e IA',
  en: 'Sergio Beltrán Coley · Engineering, data and AI',
}
