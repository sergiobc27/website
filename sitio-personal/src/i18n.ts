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
    es: 'Ingeniero civil con tesis honorífica y analista de datos y workforce: 4 años optimizando 6 cuentas globales (eBay, DoorDash, UnitedHealthcare, doxo, LendingUSA y Just Energy) con Python, Power BI e IA generativa.',
    en: 'Civil engineer with an honors thesis and data and workforce analyst: 4 years optimizing 6 global accounts (eBay, DoorDash, UnitedHealthcare, doxo, LendingUSA and Just Energy) with Python, Power BI and generative AI.',
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
    es: 'Operaciones globales en tiempo real: eBay, DoorDash, UnitedHealthcare, doxo, LendingUSA y Just Energy, con equipos de 300+ personas.',
    en: 'Global real-time operations: eBay, DoorDash, UnitedHealthcare, doxo, LendingUSA and Just Energy, with 300+ person teams.',
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
  'tray1.meta': { es: 'JUN 2022 – HOY · FOUNDEVER · JORNADA COMPLETA · 4 AÑOS 2 MESES', en: 'JUN 2022 – PRESENT · FOUNDEVER · FULL-TIME · 4 YRS 2 MOS' },
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
    es: 'Primeros semestres de la carrera, luego transferido a la Universidad de la Costa (CUC).',
    en: 'First years of the degree, later transferred to Universidad de la Costa (CUC).',
  },

  'tray5.meta': { es: 'JUN 2021 – JUL 2021 · TELEPERFORMANCE · 2 MESES', en: 'JUN 2021 – JUL 2021 · TELEPERFORMANCE · 2 MOS' },
  'tray5.t': { es: 'Representante bilingüe de servicio, Walmart.com', en: 'Bilingual Customer Service Representative, Walmart.com' },
  'tray5.p': {
    es: 'Soporte a Walmart.com durante picos de pedidos: llamadas, chats y correos sobre pedidos, devoluciones y entregas, con resolución en el primer contacto.',
    en: 'Support for Walmart.com during peak order volumes: calls, chats and emails about orders, returns and deliveries, with first-contact resolution.',
  },
  'edu.ver': { es: 'Ver detalle completo +', en: 'See full detail +' },
  'edu.cuc.body': {
    es: `<p><b>Ingeniería Civil</b> · Agosto 2021 – Diciembre 2025 · Barranquilla, Colombia</p><ul>
<li>Graduado con <b>tesis honorífica</b>: "Automatización inteligente para la gestión visual de datos hidrometeorológicos del IDEAM con Python y Power BI". <a href="https://repositorio.cuc.edu.co/entities/publication/ceb07de4-0501-4248-bffe-30807146fdf0" target="_blank" rel="noopener"><b>Leer la tesis en el repositorio CUC ↗</b></a></li>
<li>Promedio acumulado <b>4.34 / 5.00</b> (último semestre: 4.74 / 5.00).</li>
<li>Monitor académico (tutor de estudiantes).</li>
<li>Reconocimiento por alto puntaje en las pruebas nacionales <b>Saber Pro</b>.</li>
<li>Proyecto de tesis presentado en las tres etapas de <b>RedCOLSI 2025</b>: Expociencias CUC (institucional), XXII EDESI Nodo Atlántico (departamental, <b>proyecto meritorio</b>) y XXVIII ENISI en Bogotá (nacional, <b>puntaje perfecto 100/100</b> como ponente).</li>
<li>Miembro adjunto del semillero de investigación.</li></ul>`,
    en: `<p><b>B.S. in Civil Engineering</b> · August 2021 – December 2025 · Barranquilla, Colombia</p><ul>
<li>Graduated with an <b>honors thesis</b>: "Intelligent automation for the visual management of IDEAM hydrometeorological data using Python and Power BI". <a href="https://repositorio.cuc.edu.co/entities/publication/ceb07de4-0501-4248-bffe-30807146fdf0" target="_blank" rel="noopener"><b>Read the thesis in the CUC repository ↗</b></a></li>
<li>Cumulative GPA <b>4.34 / 5.00</b> (last semester: 4.74 / 5.00).</li>
<li>Academic tutor / monitor.</li>
<li>Top-tier score recognition on the national <b>Saber Pro</b> standardized examination.</li>
<li>Thesis project presented at all three stages of <b>RedCOLSI 2025</b>: Expociencias CUC (institutional), XXII EDESI Atlántico Node (departmental, <b>meritorious project</b>) and XXVIII ENISI in Bogotá (national, <b>perfect 100/100 score</b> as speaker).</li>
<li>Attached research seedbed member.</li></ul>`,
  },
  'edu.uninorte.body': {
    es: `<p><b>Ingeniería Civil</b> · Enero 2020 – Junio 2021 · Barranquilla, Colombia</p>
<p>Primeros semestres de la carrera, luego transferido a la Universidad de la Costa (CUC) donde me gradué.</p>`,
    en: `<p><b>B.S. in Civil Engineering</b> · January 2020 – June 2021 · Barranquilla, Colombia</p>
<p>First years of the degree, later transferred to Universidad de la Costa (CUC) where I graduated.</p>`,
  },
  'edu.verano.body': {
    es: `<p><b>XXVII Verano de la Investigación Científica y Tecnológica del Pacífico (Programa Delfín)</b> · Universidad Autónoma de Manizales · Julio 2022</p>
<p>Proyecto: "Análisis de acelerogramas en el municipio de Barichara, Santander, con énfasis en el historial sísmico colombiano", desarrollado en colaboración con la Universidad Veracruzana (México).</p>
<p>Aptitudes: analítica de datos, ingeniería sísmica, procesamiento de señales, investigación aplicada.</p>`,
    en: `<p><b>XXVII Pacific Scientific and Technological Research Summer (Delfín Program)</b> · Universidad Autónoma de Manizales · July 2022</p>
<p>Project: "Accelerogram analysis in the municipality of Barichara, Santander, with emphasis on Colombian seismic history", developed in collaboration with Universidad Veracruzana (Mexico).</p>
<p>Skills: data analytics, earthquake engineering, signal processing, applied research.</p>`,
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

  'proy4.t': { es: 'Investigación sísmica (Programa Delfín)', en: 'Seismic research (Delfín Program)' },
  'proy4.p': {
    es: 'Análisis de acelerogramas en Barichara, Santander, con énfasis en el historial sísmico colombiano. XXVII Verano de la Investigación Científica y Tecnológica del Pacífico, con la Universidad Veracruzana y la UAM. Toca para ver el documento.',
    en: 'Accelerogram analysis in Barichara, Santander, focused on Colombian seismic history. XXVII Pacific Scientific and Technological Research Summer, with Universidad Veracruzana and UAM. Tap to see the document.',
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
    es: 'Haz clic en las páginas: se abre un visor animado con pestañas de español e inglés, mi perfil completo y las 32 certificaciones filtrables por tema, muchas con credencial verificable. La descarga en PDF queda como opción secundaria.',
    en: 'Click the pages: an animated viewer opens with Spanish and English tabs, my full profile and all 32 certifications filterable by topic, many with a verifiable credential. The PDF download stays as a secondary option.',
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
  'cvv.certs.h': { es: 'Certificaciones (32)', en: 'Certifications (32)' },
  'cvv.todas': { es: 'Todas', en: 'All' },
  'cvv.ver': { es: 'Ver credencial ↗', en: 'View credential ↗' },
  'cvv.clic': { es: 'Toca cualquier certificado para abrirlo con su documento.', en: 'Tap any certification to open it with its document.' },
  'tray1.chips': { es: 'Toca una cuenta para leer la historia completa:', en: 'Tap an account to read the full story:' },
  'det.credencial': { es: 'ID de credencial', en: 'Credential ID' },
  'det.pdfalt': { es: 'Si el documento no carga, ábrelo aquí ↗', en: 'If the document does not load, open it here ↗' },
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
      <li><b>Universidad de la Costa (CUC)</b> · Ingeniería Civil · 2021 – Dic 2025 · Graduado con tesis honorífica (automatización de datos IDEAM con Python y Power BI; <a href="https://repositorio.cuc.edu.co/entities/publication/ceb07de4-0501-4248-bffe-30807146fdf0" target="_blank" rel="noopener"><b>leerla en el repositorio CUC ↗</b></a>), promedio 4.34, monitor académico, Saber Pro destacado y RedCOLSI 2025 (meritorio departamental y 100/100 nacional).</li>
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
      <li><b>Universidad de la Costa (CUC)</b> · Civil Engineering · 2021 – Dec 2025 · Graduated with an honors thesis (IDEAM data automation with Python and Power BI; <a href="https://repositorio.cuc.edu.co/entities/publication/ceb07de4-0501-4248-bffe-30807146fdf0" target="_blank" rel="noopener"><b>read it in the CUC repository ↗</b></a>), 4.34 GPA, academic tutor, top-tier Saber Pro score and RedCOLSI 2025 (departmental meritorious and national 100/100).</li>
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
  /** dominio del logo en /logos/<dominio>.png */
  logo?: string
  /** ruta del certificado en PDF dentro de /certs/ para verlo embebido */
  media?: string
}

export const certCats: Record<CertCat, { es: string; en: string }> = {
  ia: { es: 'IA', en: 'AI' },
  datos: { es: 'Datos y BI', en: 'Data and BI' },
  civil: { es: 'Ingeniería civil', en: 'Civil engineering' },
  gestion: { es: 'Gestión y calidad', en: 'Management and quality' },
}

export const certificados: Cert[] = [
  { nombre: 'Google AI Professional Certificate', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'TAI0G1UUXH10', pro: true, logo: 'google.com.png', media: '/certs/google-ai.pdf' },
  { nombre: 'AI for App Building', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'AD7YJO90N838', logo: 'google.com.png', media: '/certs/ai-for-app-building.pdf' },
  { nombre: 'AI for Data Analysis', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'LZWG9WQNBI1Z', logo: 'google.com.png', media: '/certs/ai-for-data-analysis.pdf' },
  { nombre: 'AI for Content Creation', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'F0MS0CL8SCH7', logo: 'google.com.png', media: '/certs/ai-for-content-creation.pdf' },
  { nombre: 'AI for Writing and Communicating', emisor: 'Google', fecha: '2026', cat: 'ia', id: '6G22X94MAG8Q', logo: 'google.com.png', media: '/certs/ai-for-writing-and-communicating.pdf' },
  { nombre: 'AI for Research and Insights', emisor: 'Google', fecha: '2026', cat: 'ia', id: '8BDPWL9YNSAT', logo: 'google.com.png', media: '/certs/ai-for-research-and-insights.pdf' },
  { nombre: 'AI for Brainstorming and Planning', emisor: 'Google', fecha: '2026', cat: 'ia', id: 'JWLUWSNA3A99', logo: 'google.com.png', media: '/certs/ai-for-brainstorming-and-planning.pdf' },
  { nombre: 'AI Fundamentals', emisor: 'Google', fecha: '2026', cat: 'ia', id: '2PE4RTGN12GV', logo: 'google.com.png', media: '/certs/ai-fundamentals.pdf' },
  { nombre: 'Extract, Transform and Load Data in Power BI', emisor: 'Microsoft', fecha: '2025', cat: 'datos', id: 'EADX0QK2GVN1', logo: 'microsoft.com.png', media: '/certs/etl-power-bi.pdf' },
  { nombre: 'Harnessing the Power of Data with Power BI', emisor: 'Microsoft', fecha: '2025', cat: 'datos', id: '8FMW0VG18DEI', logo: 'microsoft.com.png', media: '/certs/harnessing-power-bi.pdf' },
  { nombre: 'Preparing Data for Analysis with Microsoft Excel', emisor: 'Microsoft', fecha: '2024', cat: 'datos', id: '63QNX2OO60XF', logo: 'microsoft.com.png', media: '/certs/preparing-data-excel.jpeg' },
  { nombre: 'Work Smarter with Microsoft Excel (with Honors)', emisor: 'Microsoft', fecha: '2024', cat: 'datos', id: 'ZURI2G89MFQY', logo: 'microsoft.com.png', media: '/certs/work-smarter-excel.jpeg' },
  { nombre: 'Fundamentos profesionales del análisis de datos', emisor: 'Microsoft + LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/fundamentos-profesionales.jpeg' },
  { nombre: 'Aprende análisis de datos: ampliación y aplicación', emisor: 'LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/aprende-analisis-ampliacion.jpeg' },
  { nombre: 'Aprende análisis de datos: fundamentos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/aprende-analisis-fundamentos.jpeg' },
  { nombre: 'Data science: cuenta historias con los datos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/data-science-historias.jpeg' },
  { nombre: 'Aprende análisis de datos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/aprende-analisis.jpeg' },
  { nombre: 'Data science: conceptos básicos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/data-science-conceptos.jpeg' },
  { nombre: 'Habilidades profesionales en análisis de datos', emisor: 'LinkedIn', fecha: '2023', cat: 'datos', logo: 'linkedin.com.png', media: '/certs/habilidades-profesionales.jpeg' },
  { nombre: 'Pavement Construction Practices (IRC and MoRTH)', emisor: 'L&T EduTech', fecha: '2025', cat: 'civil', id: 'ZUM0ULK71M65', logo: 'lntedutech.com.png', media: '/certs/pavement-construction.jpeg' },
  { nombre: 'Pavement Materials and Design (IRC and MoRTH)', emisor: 'L&T EduTech', fecha: '2025', cat: 'civil', id: '5YEALOLZJUE7', logo: 'lntedutech.com.png', media: '/certs/pavement-materials.jpeg' },
  { nombre: 'Highway Geometry and Pavement Design', emisor: 'L&T EduTech', fecha: '2025', cat: 'civil', id: '412024CLX6AV', logo: 'lntedutech.com.png', media: '/certs/highway-geometry.jpeg' },
  { nombre: 'Mastering Bitumen for Better Roads', emisor: 'École des Ponts ParisTech', fecha: '2025', cat: 'civil', id: '9YZMUVLMH7ZV', logo: 'ecoledesponts.fr.png', media: '/certs/bitumen.jpeg' },
  { nombre: 'Verano de Investigación Científica (acelerogramas, Barichara)', emisor: 'U. Autónoma de Manizales', fecha: '2022', cat: 'civil', logo: 'autonoma.edu.co.png', media: '/certs/verano-investigacion.pdf' },
  { nombre: 'ENISI 2025: XXVIII Encuentro Nacional de Semilleros (ponente nacional, 100/100)', emisor: 'RedCOLSI', fecha: '2025', cat: 'gestion', logo: 'redcolsi.org.png', media: '/certs/enisi-2025.pdf' },
  { nombre: 'EDESI 2025: XXII Encuentro Departamental de Semilleros (ponente, proyecto meritorio)', emisor: 'RedCOLSI Nodo Atlántico', fecha: '2025', cat: 'gestion', logo: 'redcolsi.org.png', media: '/certs/edesi-2025.pdf' },
  { nombre: 'Expociencias CUC 2025: III Encuentro Institucional de Semilleros', emisor: 'Universidad de la Costa', fecha: '2025', cat: 'gestion', logo: 'cuc.edu.co.svg', media: '/certs/expociencias-cuc-2025.pdf' },
  { nombre: 'Foundations of Project Management', emisor: 'Google', fecha: '2025', cat: 'gestion', id: '83S2Z8CAOB4Z', logo: 'google.com.png', media: '/certs/foundations-project-management.pdf' },
  { nombre: 'Six Sigma White Belt', emisor: 'CSSC', fecha: '2023', cat: 'gestion', logo: 'sixsigmacouncil.org.png', media: '/certs/six-sigma-white-belt.jpeg' },
  { nombre: 'Redacción Científica', emisor: 'Universidad de la Costa', fecha: '2025', cat: 'gestion', logo: 'cuc.edu.co.svg', media: '/certs/redaccion-cientifica.pdf' },
  { nombre: 'Monitor académico UNICOSTA', emisor: 'Universidad de la Costa', fecha: '2022', cat: 'gestion', logo: 'cuc.edu.co.svg', media: '/certs/monitor-unicosta.jpeg' },
  { nombre: 'Semillero de investigación adjunto', emisor: 'Universidad de la Costa', fecha: '2022', cat: 'gestion', logo: 'cuc.edu.co.svg', media: '/certs/semillero-adjunto.pdf' },
]

/* ===== Experiencia completa (texto íntegro de LinkedIn, ES y EN) ===== */

export interface Rol {
  id: string
  empresa: string
  logoEmpresa: string
  logoCuenta: string
  cuenta: string
  titulo: { es: string; en: string }
  fechas: { es: string; en: string }
  lugar: { es: string; en: string }
  cuerpo: { es: string; en: string }
}

export const roles: Rol[] = [
  {
    id: 'uhc-rta', empresa: 'Foundever', logoEmpresa: 'foundever.com.png', logoCuenta: 'uhc.com.svg', cuenta: 'UnitedHealthcare',
    titulo: { es: 'Real Time Analyst · UnitedHealthcare (UHC)', en: 'Real Time Analyst · UnitedHealthcare (UHC)' },
    fechas: { es: 'Dic 2022 – Abr 2026 · 3 años 5 meses', en: 'Dec 2022 – Apr 2026 · 3 yrs 5 mos' },
    lugar: { es: 'Barranquilla, Colombia · En remoto', en: 'Barranquilla, Colombia · Remote' },
    cuerpo: {
      es: `<p>UnitedHealthcare es la división de beneficios de salud de UnitedHealth Group, la aseguradora de salud más grande de Estados Unidos. Controlo las operaciones de workforce en tiempo real para una plantilla de más de 300 agentes en Colombia, coordinando de cerca con equipos Nearshore, Offshore y Onshore para mantener los niveles de servicio en la meta. Trabajando en un entorno Citrix y usando NICE IEX para programación y monitoreo de adherencia, actúo como el analista senior de la cuenta en Colombia, con liderazgo directo para asegurar el cumplimiento de los objetivos.</p><ul>
<li>Monitoreo en tiempo real de adherencia, asistencia, volumen de contactos y niveles de servicio.</li>
<li>Alertas y reforecasting intradía para equilibrar la dotación con la demanda.</li>
<li>Ajuste de descansos, tiempo libre voluntario y horas extra para optimizar ocupación y shrinkage.</li>
<li>Resúmenes diarios de desempeño.</li>
<li>Dashboards automatizados en Excel con visibilidad de SLA, AHT y ocupación.</li>
<li>Trabajo conjunto con Operaciones, QA, Entrenamiento y Finanzas para alinear las decisiones de dotación con el negocio.</li>
<li>Comunicación directa con el cliente para compartir avances y prioridades.</li></ul>`,
      en: `<p>UnitedHealthcare is the health benefits division of UnitedHealth Group, the largest health insurer in the United States. I control real-time workforce operations for a headcount of more than 300 agents in Colombia while coordinating closely with Nearshore, Offshore and Onshore teams to keep service levels on target. Working in a Citrix environment and using NICE IEX for scheduling and adherence monitoring, I act as the senior analyst for the account in Colombia, providing hands-on leadership to ensure goals are met.</p><ul>
<li>Monitored adherence, attendance, contact volume and service levels in real time.</li>
<li>Issued alerts and executed intraday reforecasting to balance staffing with demand.</li>
<li>Adjusted breaks, voluntary time off and overtime to optimise occupancy and shrinkage.</li>
<li>Prepared daily performance summaries.</li>
<li>Built automated Excel dashboards for visibility into SLA, AHT and occupancy.</li>
<li>Partnered with Operations, QA, Training and Finance to align staffing decisions with business goals.</li>
<li>Maintained direct communication with the client to share performance updates and priorities.</li></ul>`,
    },
  },
  {
    id: 'ebay', empresa: 'Foundever', logoEmpresa: 'foundever.com.png', logoCuenta: 'ebay.com.png', cuenta: 'eBay',
    titulo: { es: 'Real Time Analyst · eBay', en: 'Real Time Analyst · eBay' },
    fechas: { es: 'Abr 2025 – actualidad · 1 año 4 meses', en: 'Apr 2025 – present · 1 yr 4 mos' },
    lugar: { es: 'Barranquilla, Colombia · En remoto', en: 'Barranquilla, Colombia · Remote' },
    cuerpo: {
      es: `<p>eBay Inc. es un marketplace global de comercio electrónico que conecta a millones de compradores y vendedores. Superviso el desempeño intradía de una fuerza laboral de más de 100 agentes de soporte al cliente.</p><ul>
<li>Monitoreo de colas en vivo, adherencia de agentes y niveles de servicio por intervalo con Alvaria (Aspect).</li>
<li>Cambios intradía de horarios y reasignación de skills para proteger los KPI.</li>
<li>Reportes diarios de desempeño y horas perdidas en Microsoft Access y Excel.</li>
<li>Acceso a los sistemas operativos a través de un entorno seguro Citrix.</li>
<li>Alertas y actualizaciones de estado en tiempo real al liderazgo por Microsoft Teams, Slack y Outlook.</li></ul>`,
      en: `<p>eBay Inc. is a global e-commerce marketplace connecting millions of buyers and sellers. I supervise intraday performance for a workforce of more than 100 customer-support agents.</p><ul>
<li>Monitored live queues, agent adherence and interval service levels with Alvaria (Aspect).</li>
<li>Applied intraday schedule changes and skill reassignments to protect KPIs.</li>
<li>Generated daily performance and lost-hours reports in Microsoft Access and Excel.</li>
<li>Accessed operational systems through a secure Citrix environment.</li>
<li>Communicated real-time alerts and status updates to leadership via Microsoft Teams, Slack and Outlook.</li></ul>`,
    },
  },
  {
    id: 'doordash', empresa: 'Foundever', logoEmpresa: 'foundever.com.png', logoCuenta: 'doordash.com.png', cuenta: 'DoorDash',
    titulo: { es: 'Real Time Analyst · DoorDash', en: 'Real Time Analyst · DoorDash' },
    fechas: { es: 'Dic 2025 – actualidad · 8 meses', en: 'Dec 2025 – present · 8 mos' },
    lugar: { es: 'Barranquilla, Colombia · En remoto', en: 'Barranquilla, Colombia · Remote' },
    cuerpo: {
      es: `<p>DoorDash es una compañía global de tecnología que conecta a los consumidores con negocios locales. Soy responsable de las operaciones de workforce en tiempo real para un equipo de ventas dedicado de 20 FTE en Colombia, usando NICE IEX para programación y monitoreo de adherencia con el fin de asegurar la estabilidad operativa y el alineamiento con las metas.</p><ul>
<li>Monitoreo de adherencia y asistencia en tiempo real para una operación de ventas de 20 FTE vía NICE IEX.</li>
<li>Gestión de disponibilidad y ocupación del personal para que el equipo cumpla las metas de ventas y contactos.</li>
<li>Coordinación de descansos, almuerzos y actividades offline para minimizar el shrinkage y mantener cobertura constante.</li></ul>`,
      en: `<p>DoorDash is a global technology company that connects consumers with local businesses. Responsibility for real-time workforce operations for a dedicated sales team of 20 FTE in Colombia. Using NICE IEX for scheduling and adherence monitoring to ensure operational stability and goal alignment.</p><ul>
<li>Monitoring of real-time adherence and attendance for a 20 FTE sales operation via NICE IEX.</li>
<li>Management of staff availability and occupancy to ensure the team is positioned to meet sales and contact targets.</li>
<li>Coordination of breaks, lunches, and offline activities to minimize shrinkage and maintain consistent coverage.</li></ul>`,
    },
  },
  {
    id: 'doxo', empresa: 'Foundever', logoEmpresa: 'foundever.com.png', logoCuenta: 'doxo.com.png', cuenta: 'doxo',
    titulo: { es: 'Real Time Analyst · doxo', en: 'Real Time Analyst · doxo' },
    fechas: { es: 'Ene 2025 – Dic 2025 · 1 año', en: 'Jan 2025 – Dec 2025 · 1 yr' },
    lugar: { es: 'Barranquilla, Colombia · En remoto', en: 'Barranquilla, Colombia · Remote' },
    cuerpo: {
      es: `<p>Doxo es una plataforma estadounidense de pago de facturas que permite a millones de usuarios administrar y pagar sus cuentas del hogar de forma segura. Como Real Time Analyst de la cuenta, gestiono una plantilla de ocho agentes, descargo datos crudos desde Amazon AWS y creo reportes de desempeño con Microsoft Access, Power BI y Excel, manteniendo alineados a los interesados por Microsoft Teams y Outlook.</p><ul>
<li>Seguimiento de adherencia de horarios y niveles de servicio en vivo para 8 FTE.</li>
<li>Extracción de datos detallados de contactos y transacciones desde Amazon AWS para análisis.</li>
<li>Construcción y actualización de dashboards de desempeño y reportes de horas perdidas en Access, Power BI y Excel.</li>
<li>Novedades intradía e insights para supervisores y contactos del cliente vía Teams y Outlook.</li></ul>`,
      en: `<p>Doxo is a U.S. bill-payment platform that allows millions of users to manage and pay household bills securely. As the Real-Time Analyst for the account, I manage an eight-agent headcount, download raw data from Amazon AWS, and create performance reporting using Microsoft Access, Power BI and Excel, while keeping stakeholders aligned through Microsoft Teams and Outlook.</p><ul>
<li>Tracked schedule adherence and live service levels for 8 FTE.</li>
<li>Pulled detailed contact and transaction data from Amazon AWS for analysis.</li>
<li>Built and refreshed performance dashboards and lost-hours reports in Access, Power BI and Excel.</li>
<li>Shared intraday updates and insights with supervisors and client contacts via Teams and Outlook.</li></ul>`,
    },
  },
  {
    id: 'lendingusa', empresa: 'Foundever', logoEmpresa: 'foundever.com.png', logoCuenta: 'lendingusa.com.png', cuenta: 'LendingUSA',
    titulo: { es: 'Real Time Analyst · LendingUSA', en: 'Real Time Analyst · LendingUSA' },
    fechas: { es: 'Jun 2023 – Dic 2023 · 7 meses', en: 'Jun 2023 – Dec 2023 · 7 mos' },
    lugar: { es: 'Barranquilla, Colombia · En remoto', en: 'Barranquilla, Colombia · Remote' },
    cuerpo: {
      es: `<p>LendingUSA es una fintech estadounidense que ofrece préstamos en punto de venta a través de más de diez mil comercios aliados. Como Real Time Analyst de respaldo, gestioné una plantilla de 30 agentes, cargué campañas outbound y de cobranza por SMS, y produje reportes de desempeño usando NICE IEX para el control de horarios y adherencia.</p><ul>
<li>Carga diaria de listas de llamadas salientes y campañas de cobranza por SMS en la plataforma del marcador.</li>
<li>Reportes de desempeño, adherencia y horas perdidas con Microsoft Access y Excel.</li>
<li>Seguimiento del cumplimiento de horarios de 30 FTE y recomendaciones de ajustes intradía en NICE IEX.</li>
<li>Comunicación de novedades e insights a supervisores y contactos del cliente vía Microsoft Teams y Outlook.</li></ul>`,
      en: `<p>LendingUSA is a U.S. fintech that offers point-of-sale loans through more than ten thousand merchant partners. As the backup Real-Time Analyst, I managed a 30-agent headcount, uploaded outbound and SMS collections campaigns, and produced performance reporting while using NICE IEX for schedule and adherence control.</p><ul>
<li>Uploaded daily outbound calling lists and SMS collections campaigns through the dialer platform.</li>
<li>Generated performance, adherence and lost-hours reports using Microsoft Access and Excel.</li>
<li>Tracked schedule compliance for 30 FTE and recommended intraday staffing adjustments in NICE IEX.</li>
<li>Communicated status updates and insights to supervisors and client contacts via Microsoft Teams and Outlook.</li></ul>`,
    },
  },
  {
    id: 'uhc-csr', empresa: 'Foundever', logoEmpresa: 'foundever.com.png', logoCuenta: 'uhc.com.svg', cuenta: 'UnitedHealthcare',
    titulo: { es: 'Representante bilingüe de servicio · UnitedHealthcare', en: 'Bilingual Customer Service Representative · UnitedHealthcare' },
    fechas: { es: 'Jun 2022 – Dic 2022 · 7 meses', en: 'Jun 2022 – Dec 2022 · 7 mos' },
    lugar: { es: 'Barranquilla, Colombia · En remoto', en: 'Barranquilla, Colombia · Remote' },
    cuerpo: {
      es: `<p>UnitedHealthcare atiende a más de cuarenta y seis millones de afiliados. Apoyé a miembros de Medicare, principalmente adultos mayores, resolviendo casos complejos de beneficios en un entorno de llamadas de alto volumen.</p><ul>
<li>Asistencia con beneficios, facturación, deducibles y consultas de póliza.</li>
<li>Orientación sobre cobertura, subsidios del gobierno, reclamaciones y planes de medicamentos.</li>
<li>Ayuda para ubicar proveedores en red, médicos de cabecera y especialistas.</li>
<li>Solicitudes de preautorización y escalamiento de casos médicos urgentes.</li>
<li>Comunicación clara y empática adaptada a adultos mayores con dificultades auditivas o cognitivas.</li>
<li>Educación sobre portales en línea y estados de beneficios enviados por correo.</li>
<li>Cumplimiento de HIPAA, verificación de identidad y documentación de cada interacción en CRM.</li>
<li>Cumplimiento o superación de metas de AHT, calidad y satisfacción del cliente.</li>
<li>Coordinación con administradores de beneficios de farmacia y equipos clínicos para resolver negaciones de reclamos.</li></ul>`,
      en: `<p>UnitedHealthcare serves more than forty-six million members. I supported Medicare members, primarily seniors, by resolving complex benefit issues in a high-volume, back-to-back call environment.</p><ul>
<li>Assisted customers with benefits, billing, deductibles and policy inquiries.</li>
<li>Guided members on coverage, government subsidies, claims and prescription drug plans.</li>
<li>Helped callers locate in-network providers, primary doctors and specialists.</li>
<li>Submitted prior-authorization requests and escalated urgent medical cases when needed.</li>
<li>Delivered clear, empathetic communication adapted to seniors with hearing or cognitive challenges.</li>
<li>Educated members on using online portals and mailed explanation-of-benefits statements.</li>
<li>Followed HIPAA rules, verified caller identity and documented each interaction in CRM notes.</li>
<li>Met or exceeded targets for average handle time, quality assurance and customer satisfaction.</li>
<li>Coordinated with pharmacy benefit managers and internal clinical teams to resolve claim denials.</li></ul>`,
    },
  },
  {
    id: 'walmart', empresa: 'Teleperformance', logoEmpresa: 'teleperformance.com.png', logoCuenta: 'walmart.com.png', cuenta: 'Walmart.com',
    titulo: { es: 'Representante bilingüe de servicio · Walmart.com', en: 'Bilingual Customer Service Representative · Walmart.com' },
    fechas: { es: 'Jun 2021 – Jul 2021 · 2 meses', en: 'Jun 2021 – Jul 2021 · 2 mos' },
    lugar: { es: 'Colombia · En remoto', en: 'Colombia · Remote' },
    cuerpo: {
      es: `<p>Walmart Inc. es el minorista más grande del mundo, llegando a más de doscientos cincuenta millones de clientes cada semana a través de diez mil tiendas y una plataforma líder de comercio electrónico. Apoyando a Walmart.com a través de Teleperformance, aseguré experiencias de cliente fluidas durante picos de volumen de pedidos.</p><ul>
<li>Atención de llamadas, chats y correos sobre pedidos, devoluciones, reemplazos y estado de entregas.</li>
<li>Investigación de problemas de pago, demoras de reembolsos y discrepancias de inventario.</li>
<li>Acompañamiento en pasos de solución de errores del sitio web y la app.</li>
<li>Ajustes por artículos dañados y coordinación de recogidas con transportadoras.</li>
<li>Escucha activa y enfoque en soluciones para lograr resolución en el primer contacto.</li>
<li>Protección de datos confidenciales y cumplimiento de PCI-DSS para pagos con tarjeta.</li>
<li>Resolución proactiva para mejorar el Net Promoter Score y la lealtad de marca.</li>
<li>Cumplimiento de metas diarias de tiempo de atención, calidad y empatía.</li></ul>`,
      en: `<p>Walmart Inc. is the world's largest retailer, reaching more than two hundred fifty million customers weekly through ten thousand stores and a leading ecommerce platform. Supporting Walmart.com through Teleperformance, I ensured seamless customer experiences during peak order volumes.</p><ul>
<li>Handled calls, chats and emails about orders, returns, replacements and delivery status.</li>
<li>Investigated payment issues, refund delays and inventory discrepancies.</li>
<li>Walked customers through troubleshooting steps for website and app errors.</li>
<li>Processed adjustments for damaged items and arranged carrier pickups when required.</li>
<li>Applied active listening and solution-focused techniques to achieve first-contact resolution.</li>
<li>Protected confidential data and adhered to PCI-DSS guidelines for card payments.</li>
<li>Resolved inquiries proactively to boost Net Promoter Score and brand loyalty.</li>
<li>Met daily targets for handle time, quality and customer empathy scores.</li></ul>`,
    },
  },
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
