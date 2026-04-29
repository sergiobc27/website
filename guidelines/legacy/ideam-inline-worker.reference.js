const DEFAULT_CONFIG = {
  socrataDomain: "https://www.datos.gov.co",
  catalogDatasetId: "hp9r-jxuu",
  pageLimit: 50000,
  previewLimit: 200,
  maxExportRows: 100000,
};

const DATASETS = [
  { name: "Precipitacion", id: "s54a-sgyg", dateColumn: "fechaobservacion", category: "Hidrometeorologia" },
  { name: "Nivel del Mar", id: "ia8x-22em", dateColumn: "fechaobservacion", category: "Oceanografia" },
  { name: "Direccion del Viento", id: "kiw7-v9ta", dateColumn: "fechaobservacion", category: "Meteorologia" },
  { name: "Velocidad del Viento", id: "sgfv-3yp8", dateColumn: "fechaobservacion", category: "Meteorologia" },
  { name: "Presion Atmosferica", id: "62tk-nxj5", dateColumn: "fechaobservacion", category: "Meteorologia" },
  { name: "Humedad del Aire", id: "uext-mhny", dateColumn: "fechaobservacion", category: "Meteorologia" },
  { name: "Temperatura Maxima del Aire", id: "ccvq-rp9s", dateColumn: "fechaobservacion", category: "Meteorologia" },
  { name: "Temperatura Minima del Aire", id: "afdg-3zpb", dateColumn: "fechaobservacion", category: "Meteorologia" },
  { name: "Nivel Maximo del Rio", id: "vfth-yucv", dateColumn: "fechaobservacion", category: "Hidrologia" },
  { name: "Nivel Instantaneo del Rio", id: "bdmn-sqnh", dateColumn: "fechaobservacion", category: "Hidrologia" },
  { name: "Nivel Minimo del Rio", id: "pt9a-aamx", dateColumn: "fechaobservacion", category: "Hidrologia" },
  { name: "Nivel del Mar Maximo", id: "uxy3-jchf", dateColumn: "fechaobservacion", category: "Oceanografia" },
  { name: "Nivel del Mar Minimo", id: "7z6g-yx9q", dateColumn: "fechaobservacion", category: "Oceanografia" }
];

const DEPARTMENT_MAP = {
  "AMAZONAS": ["AMAZONAS"],
  "ANTIOQUIA": ["ANTIOQUIA"],
  "ARAUCA": ["ARAUCA"],
  "ATLANTICO": ["ATLANTICO", "ATLÁNTICO"],
  "BOLIVAR": ["BOLIVAR", "BOLÍVAR"],
  "BOGOTA D.C.": ["BOGOTA", "BOGOTÁ", "BOGOTÁ D.C.", "BOGOTA, D.C"],
  "BOYACA": ["BOYACA", "BOYACÁ"],
  "CALDAS": ["CALDAS"],
  "CAQUETA": ["CAQUETA", "CAQUETÁ"],
  "CASANARE": ["CASANARE"],
  "CAUCA": ["CAUCA"],
  "CESAR": ["CESAR"],
  "CHOCO": ["CHOCO", "CHOCÓ"],
  "CORDOBA": ["CORDOBA", "CÓRDOBA"],
  "CUNDINAMARCA": ["CUNDINAMARCA"],
  "GUAINIA": ["GUAINIA", "GUAINÍA"],
  "GUAVIARE": ["GUAVIARE"],
  "HUILA": ["HUILA"],
  "LA GUAJIRA": ["LA GUAJIRA", "GUAJIRA"],
  "MAGDALENA": ["MAGDALENA"],
  "META": ["META"],
  "NARIÑO": ["NARIÑO", "NARINO"],
  "NORTE DE SANTANDER": ["NORTE DE SANTANDER"],
  "PUTUMAYO": ["PUTUMAYO"],
  "QUINDIO": ["QUINDIO", "QUINDÍO"],
  "RISARALDA": ["RISARALDA"],
  "SAN ANDRES Y PROVIDENCIA": ["SAN ANDRES", "SAN ANDRÉS Y PROVIDENCIA"],
  "SANTANDER": ["SANTANDER"],
  "SUCRE": ["SUCRE"],
  "TOLIMA": ["TOLIMA"],
  "VALLE DEL CAUCA": ["VALLE DEL CAUCA", "VALLE"],
  "VAUPES": ["VAUPES", "VAUPÉS"],
  "VICHADA": ["VICHADA"]
};

function getConfig(env) {
  return {
    socrataDomain: env?.SOCRATA_DOMAIN || DEFAULT_CONFIG.socrataDomain,
    catalogDatasetId: env?.CATALOG_DATASET_ID || DEFAULT_CONFIG.catalogDatasetId,
    pageLimit: Number(env?.PAGE_LIMIT || DEFAULT_CONFIG.pageLimit),
    previewLimit: Number(env?.PREVIEW_LIMIT || DEFAULT_CONFIG.previewLimit),
    maxExportRows: Number(env?.MAX_EXPORT_ROWS || DEFAULT_CONFIG.maxExportRows),
  };
}

const HTML = String.raw`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="Plataforma web para consultar y descargar datos hidricos del IDEAM desde Socrata."
    />
    <title>IDEAM Data Hub</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">ID</span>
          <div>
            <p class="brand-eyebrow">AUTOMATIZACION</p>
            <h1>IDEAM Data Hub</h1>
          </div>
        </div>

        <nav class="sidebar-nav">
          <button class="nav-item is-active" data-view-target="dashboard">Dashboard</button>
          <button class="nav-item" data-view-target="extractor">Extractor de Datos</button>
          <button class="nav-item" data-view-target="history">Historial</button>
          <button class="nav-item" data-view-target="docs">Documentacion</button>
        </nav>

        <div class="sidebar-footer">
          <div class="status-chip">
            <span class="status-dot" id="apiStatusDot"></span>
            <span id="apiStatusText">Conectando a IDEAM...</span>
          </div>
          <p class="sidebar-note">ideam.sergiobc.com</p>
        </div>
      </aside>

      <div class="main-shell">
        <header class="topbar">
          <div>
            <p class="topbar-breadcrumb">Inicio / Plataforma</p>
            <h2 id="pageTitle">Dashboard</h2>
          </div>
          <div class="topbar-actions">
            <span class="subtle-badge" id="datasetCountBadge">0 datasets</span>
            <a class="support-link" href="https://github.com/sergiobc27/website" rel="noreferrer">GitHub</a>
          </div>
        </header>

        <main class="content-shell">
          <section class="view is-active" data-view="dashboard">
            <div class="metrics-grid">
              <article class="metric-card">
                <p class="metric-label">Datasets operativos</p>
                <strong class="metric-value" id="metricDatasets">0</strong>
              </article>
              <article class="metric-card">
                <p class="metric-label">Descargas en esta sesion</p>
                <strong class="metric-value" id="metricDownloads">0</strong>
              </article>
              <article class="metric-card">
                <p class="metric-label">Filas descargadas</p>
                <strong class="metric-value" id="metricRows">0</strong>
              </article>
              <article class="metric-card">
                <p class="metric-label">Ultima ejecucion</p>
                <strong class="metric-value metric-small" id="metricLastRun">Sin registros</strong>
              </article>
            </div>

            <div class="panel-grid">
              <article class="panel">
                <div class="panel-header">
                  <h3>Resumen operativo</h3>
                </div>
                <ul class="summary-list" id="dashboardSummary">
                  <li>Preparando resumen...</li>
                </ul>
              </article>
              <article class="panel">
                <div class="panel-header">
                  <h3>Arquitectura online</h3>
                </div>
                <div class="architecture-card">
                  <div class="arch-step">Usuario</div>
                  <div class="arch-arrow">→</div>
                  <div class="arch-step">Worker Cloudflare</div>
                  <div class="arch-arrow">→</div>
                  <div class="arch-step">Socrata IDEAM</div>
                </div>
                <p class="panel-copy">
                  Esta interfaz consulta Socrata desde Cloudflare. El usuario ya no necesita
                  ejecutar scripts localmente para explorar o descargar los datos.
                </p>
              </article>
            </div>
          </section>

          <section class="view" data-view="extractor">
            <div class="extractor-grid">
              <article class="panel form-panel">
                <div class="panel-header">
                  <h3>Nueva Consulta</h3>
                  <p>Filtros espaciales, temporales y de descarga.</p>
                </div>

                <form id="extractorForm" class="extractor-form">
                  <label class="field">
                    <span>Variable</span>
                    <select id="datasetSelect" name="datasetId" required></select>
                  </label>

                  <label class="field">
                    <span>Departamento</span>
                    <select id="departmentSelect" name="department">
                      <option value="">Todos</option>
                    </select>
                  </label>

                  <label class="field">
                    <span>Municipio</span>
                    <select id="municipalitySelect" name="municipality" disabled>
                      <option value="">Todos</option>
                    </select>
                  </label>

                  <label class="field">
                    <span>Codigo de estacion</span>
                    <input id="stationCodeInput" name="stationCode" type="text" placeholder="Opcional" />
                  </label>

                  <div class="field-row">
                    <label class="field">
                      <span>Fecha inicio</span>
                      <input id="startDateInput" name="startDate" type="date" required />
                    </label>
                    <label class="field">
                      <span>Fecha fin</span>
                      <input id="endDateInput" name="endDate" type="date" required />
                    </label>
                  </div>

                  <div class="segmented-group">
                    <p class="segmented-label">Formato</p>
                    <div class="segmented-control">
                      <label><input type="radio" name="format" value="csv" checked />CSV</label>
                      <label><input type="radio" name="format" value="json" />JSON</label>
                    </div>
                  </div>

                  <div class="button-row">
                    <button type="button" class="secondary-button" id="previewButton">Vista previa</button>
                    <button type="submit" class="primary-button" id="downloadButton">Descargar</button>
                  </div>
                </form>

                <div class="coverage-box">
                  <div class="panel-header small-gap">
                    <h4>Verificacion territorial</h4>
                    <button type="button" class="text-button" id="coverageButton">Revisar cobertura</button>
                  </div>
                  <div id="coverageResult" class="coverage-result">
                    Selecciona un departamento para validar variantes como ATLANTICO / ATLÁNTICO.
                  </div>
                </div>
              </article>

              <article class="panel output-panel">
                <div class="panel-header">
                  <h3>Centro de operaciones</h3>
                  <p>Estado de consulta, logs y vista previa.</p>
                </div>

                <div class="progress-shell">
                  <div class="progress-meta">
                    <span id="progressLabel">Listo</span>
                    <span id="progressStats">0 filas</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-bar" id="progressBar"></div>
                  </div>
                </div>

                <div class="live-stats" id="liveStats">
                  <span>Esperando consulta</span>
                </div>

                <div class="terminal" id="terminalLog"></div>

                <div class="table-shell">
                  <div class="panel-header small-gap">
                    <h4>Vista previa</h4>
                    <span class="subtle-badge" id="previewCountBadge">0 filas</span>
                  </div>
                  <div class="table-wrap">
                    <table id="previewTable">
                      <thead></thead>
                      <tbody></tbody>
                    </table>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="view" data-view="history">
            <article class="panel">
              <div class="panel-header">
                <h3>Historial de descargas</h3>
                <button type="button" class="text-button" id="clearHistoryButton">Limpiar</button>
              </div>
              <div id="historyList" class="history-list"></div>
            </article>
          </section>

          <section class="view" data-view="docs">
            <article class="panel">
              <div class="panel-header">
                <h3>Como funciona</h3>
              </div>
              <ul class="summary-list">
                <li>La app consulta datasets publicos de IDEAM en Socrata desde Cloudflare Workers.</li>
                <li>Los filtros de departamento usan variantes normalizadas para evitar perder registros por acentos.</li>
                <li>La vista previa limita el volumen de respuesta para mantener la UI rapida y segura.</li>
                <li>Las descargas completas se limitan a ${DEFAULT_CONFIG.maxExportRows.toLocaleString("es-CO")} filas por solicitud para proteger el worker.</li>
                <li>El siguiente paso natural es agregar jobs asincronicos y almacenamiento en R2 para descargas masivas.</li>
              </ul>
            </article>
          </section>
        </main>
      </div>
    </div>

    <script src="/app.js"></script>
  </body>
</html>`;

const CSS = String.raw`
:root {
  color-scheme: dark;
  --bg: #0a0f1c;
  --panel: #111827;
  --panel-border: #1f2937;
  --panel-soft: #0f172a;
  --text: #e5eef9;
  --muted: #8fa3bf;
  --accent: #06b6d4;
  --accent-2: #3b82f6;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #fb7185;
  --shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(6, 182, 212, 0.14), transparent 28%),
    radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.12), transparent 24%),
    var(--bg);
  color: var(--text);
}

body {
  min-height: 100vh;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
}

.sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px 18px;
  border-right: 1px solid rgba(143, 163, 191, 0.14);
  background: rgba(10, 15, 28, 0.76);
  backdrop-filter: blur(12px);
}

.brand {
  display: flex;
  gap: 14px;
  align-items: center;
}

.brand-mark {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: white;
  font-weight: 800;
}

.brand h1,
.panel-header h3,
.panel-header h4,
.topbar h2 {
  margin: 0;
}

.brand-eyebrow,
.topbar-breadcrumb,
.metric-label,
.sidebar-note,
.panel-header p,
.segmented-label {
  margin: 0;
  color: var(--muted);
}

.sidebar-nav {
  display: grid;
  gap: 10px;
  margin-top: 36px;
}

.nav-item {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  text-align: left;
  padding: 12px 14px;
  border-radius: 8px;
  transition: 0.2s ease;
}

.nav-item:hover,
.nav-item.is-active {
  color: var(--text);
  background: rgba(17, 24, 39, 0.88);
  border-color: rgba(6, 182, 212, 0.28);
  box-shadow: inset 0 0 0 1px rgba(6, 182, 212, 0.18);
}

.status-chip,
.subtle-badge,
.live-stats span,
.history-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(143, 163, 191, 0.14);
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(17, 24, 39, 0.7);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--warning);
  box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.12);
}

.main-shell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 24px 32px 12px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.support-link,
.text-button {
  color: var(--accent);
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
}

.content-shell {
  padding: 12px 32px 32px;
}

.view {
  display: none;
}

.view.is-active {
  display: block;
}

.metrics-grid,
.panel-grid {
  display: grid;
  gap: 18px;
}

.metrics-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.panel-grid {
  grid-template-columns: 1.1fr 0.9fr;
  margin-top: 18px;
}

.metric-card,
.panel {
  background: rgba(17, 24, 39, 0.82);
  border: 1px solid rgba(31, 41, 55, 0.96);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.metric-card {
  padding: 20px;
}

.metric-value {
  display: block;
  margin-top: 12px;
  font-size: clamp(1.9rem, 4vw, 2.7rem);
}

.metric-small {
  font-size: 1rem;
  line-height: 1.4;
}

.panel {
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  margin-bottom: 16px;
}

.small-gap {
  margin-bottom: 10px;
}

.summary-list {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  display: grid;
  gap: 10px;
}

.architecture-card {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.arch-step,
.arch-arrow {
  border-radius: 8px;
  padding: 10px 14px;
}

.arch-step {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(6, 182, 212, 0.2);
}

.arch-arrow {
  color: var(--accent);
}

.panel-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.extractor-grid {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 18px;
}

.extractor-form {
  display: grid;
  gap: 14px;
}

.field,
.field-row {
  display: grid;
  gap: 10px;
}

.field span {
  font-size: 0.92rem;
  color: var(--muted);
}

.field-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field input,
.field select {
  width: 100%;
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(143, 163, 191, 0.16);
  background: rgba(10, 15, 28, 0.86);
  color: var(--text);
  padding: 0 12px;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: rgba(6, 182, 212, 0.6);
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.14);
}

.segmented-control {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 4px;
  gap: 4px;
  border-radius: 8px;
  background: rgba(10, 15, 28, 0.86);
  border: 1px solid rgba(143, 163, 191, 0.16);
}

.segmented-control label {
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: 96px;
  min-height: 38px;
  border-radius: 6px;
  color: var(--muted);
}

.segmented-control input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.segmented-control label:has(input:checked) {
  color: white;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.26), rgba(59, 130, 246, 0.32));
}

.button-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.primary-button,
.secondary-button {
  min-height: 46px;
  border-radius: 8px;
  border: 1px solid transparent;
}

.primary-button {
  color: white;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}

.secondary-button {
  color: var(--text);
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(143, 163, 191, 0.16);
}

.coverage-box {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(143, 163, 191, 0.12);
}

.coverage-result {
  color: var(--muted);
  line-height: 1.6;
}

.progress-shell {
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(10, 15, 28, 0.72);
  border: 1px solid rgba(143, 163, 191, 0.12);
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--muted);
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(31, 41, 55, 1);
  overflow: hidden;
}

.progress-bar {
  width: 0%;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transition: width 0.2s ease;
}

.live-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 14px 0 16px;
}

.terminal {
  min-height: 180px;
  max-height: 240px;
  overflow: auto;
  border-radius: 8px;
  padding: 14px;
  background: #020617;
  border: 1px solid rgba(16, 185, 129, 0.18);
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.86rem;
  line-height: 1.6;
  color: #a7f3d0;
}

.terminal-line {
  margin: 0;
}

.terminal-line.error {
  color: #fecdd3;
}

.table-shell {
  margin-top: 18px;
}

.table-wrap {
  overflow: auto;
  border-radius: 8px;
  border: 1px solid rgba(143, 163, 191, 0.12);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
}

thead {
  background: rgba(15, 23, 42, 0.92);
}

th,
td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid rgba(143, 163, 191, 0.08);
  vertical-align: top;
}

th {
  font-size: 0.85rem;
  color: var(--muted);
}

td {
  font-size: 0.92rem;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-card {
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(143, 163, 191, 0.12);
  background: rgba(10, 15, 28, 0.72);
}

.history-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
  margin-bottom: 8px;
}

.history-title,
.history-meta {
  margin: 0;
}

.history-meta {
  color: var(--muted);
  line-height: 1.55;
}

@media (max-width: 1200px) {
  .metrics-grid,
  .panel-grid,
  .extractor-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(143, 163, 191, 0.14);
  }

  .topbar,
  .content-shell {
    padding-left: 20px;
    padding-right: 20px;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-row,
  .button-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 540px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
`;

const APP_JS = String.raw`
const state = {
  meta: null,
  history: [],
  previewRows: [],
};

const els = {
  pageTitle: document.getElementById("pageTitle"),
  apiStatusDot: document.getElementById("apiStatusDot"),
  apiStatusText: document.getElementById("apiStatusText"),
  datasetCountBadge: document.getElementById("datasetCountBadge"),
  metricDatasets: document.getElementById("metricDatasets"),
  metricDownloads: document.getElementById("metricDownloads"),
  metricRows: document.getElementById("metricRows"),
  metricLastRun: document.getElementById("metricLastRun"),
  dashboardSummary: document.getElementById("dashboardSummary"),
  datasetSelect: document.getElementById("datasetSelect"),
  departmentSelect: document.getElementById("departmentSelect"),
  municipalitySelect: document.getElementById("municipalitySelect"),
  stationCodeInput: document.getElementById("stationCodeInput"),
  startDateInput: document.getElementById("startDateInput"),
  endDateInput: document.getElementById("endDateInput"),
  previewButton: document.getElementById("previewButton"),
  extractorForm: document.getElementById("extractorForm"),
  coverageButton: document.getElementById("coverageButton"),
  coverageResult: document.getElementById("coverageResult"),
  progressLabel: document.getElementById("progressLabel"),
  progressStats: document.getElementById("progressStats"),
  progressBar: document.getElementById("progressBar"),
  liveStats: document.getElementById("liveStats"),
  terminalLog: document.getElementById("terminalLog"),
  previewCountBadge: document.getElementById("previewCountBadge"),
  previewHead: document.querySelector("#previewTable thead"),
  previewBody: document.querySelector("#previewTable tbody"),
  historyList: document.getElementById("historyList"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
};

function logLine(message, kind = "") {
  const line = document.createElement("p");
  line.className = "terminal-line" + (kind ? " " + kind : "");
  line.textContent = "[" + new Date().toLocaleTimeString("es-CO") + "] " + message;
  els.terminalLog.prepend(line);
}

function setProgress(percent, label, stats) {
  els.progressBar.style.width = percent + "%";
  els.progressLabel.textContent = label;
  els.progressStats.textContent = stats;
}

function setLiveStats(items) {
  els.liveStats.innerHTML = "";
  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = item;
    els.liveStats.appendChild(chip);
  });
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("ideam-history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem("ideam-history", JSON.stringify(history.slice(0, 20)));
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CO").format(value || 0);
}

function switchView(name) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === name);
  });
  const titles = {
    dashboard: "Dashboard",
    extractor: "Extractor de Datos",
    history: "Historial de Descargas",
    docs: "Documentacion",
  };
  els.pageTitle.textContent = titles[name] || "IDEAM Data Hub";
}

function selectedFormat() {
  return new FormData(els.extractorForm).get("format") || "csv";
}

function getPayload() {
  return {
    datasetId: els.datasetSelect.value,
    department: els.departmentSelect.value,
    municipality: els.municipalitySelect.value,
    stationCode: els.stationCodeInput.value.trim(),
    startDate: els.startDateInput.value,
    endDate: els.endDateInput.value,
    format: selectedFormat(),
  };
}

function validatePayload(payload) {
  if (!payload.datasetId || !payload.startDate || !payload.endDate) {
    throw new Error("Completa variable, fecha inicio y fecha fin.");
  }
  if (payload.startDate > payload.endDate) {
    throw new Error("La fecha inicio no puede ser mayor que la fecha fin.");
  }
}

async function loadMeta() {
  const response = await fetch("/api/meta");
  if (!response.ok) {
    throw new Error("No fue posible cargar la configuracion.");
  }
  const meta = await response.json();
  state.meta = meta;
  els.datasetCountBadge.textContent = meta.datasets.length + " datasets";
  els.metricDatasets.textContent = meta.datasets.length;

  els.datasetSelect.innerHTML = meta.datasets
    .map((dataset) => '<option value="' + dataset.id + '">' + dataset.name + " · " + dataset.category + "</option>")
    .join("");

  const deptOptions = ['<option value="">Todos</option>']
    .concat(meta.departments.map((department) => '<option value="' + department + '">' + department + "</option>"))
    .join("");
  els.departmentSelect.innerHTML = deptOptions;

  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  els.startDateInput.value = start.toISOString().slice(0, 10);
  els.endDateInput.value = new Date().toISOString().slice(0, 10);

  els.apiStatusDot.style.background = "#10b981";
  els.apiStatusDot.style.boxShadow = "0 0 0 6px rgba(16, 185, 129, 0.12)";
  els.apiStatusText.textContent = "API online · Cloudflare Worker activo";

  logLine("Metadata inicial cargada.");
}

async function loadMunicipalities() {
  const department = els.departmentSelect.value;
  if (!department) {
    els.municipalitySelect.innerHTML = '<option value="">Todos</option>';
    els.municipalitySelect.disabled = true;
    return;
  }
  els.municipalitySelect.disabled = true;
  els.municipalitySelect.innerHTML = '<option value="">Cargando...</option>';
  const response = await fetch("/api/municipalities?department=" + encodeURIComponent(department));
  const data = await response.json();
  const options = ['<option value="">Todos</option>']
    .concat(data.municipalities.map((municipality) => '<option value="' + municipality + '">' + municipality + "</option>"))
    .join("");
  els.municipalitySelect.innerHTML = options;
  els.municipalitySelect.disabled = false;
}

function renderPreview(rows) {
  state.previewRows = rows;
  els.previewCountBadge.textContent = rows.length + " filas";
  els.previewHead.innerHTML = "";
  els.previewBody.innerHTML = "";

  if (!rows.length) {
    els.previewHead.innerHTML = "<tr><th>Sin datos</th></tr>";
    els.previewBody.innerHTML = "<tr><td>No se encontraron registros para los filtros actuales.</td></tr>";
    return;
  }

  const columns = Object.keys(rows[0]).slice(0, 8);
  const headRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.appendChild(th);
  });
  els.previewHead.appendChild(headRow);

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      const value = row[column];
      td.textContent = value === null || value === undefined ? "" : String(value);
      tr.appendChild(td);
    });
    els.previewBody.appendChild(tr);
  });
}

function renderHistory() {
  state.history = getHistory();
  els.metricDownloads.textContent = state.history.length;
  const totalRows = state.history.reduce((sum, item) => sum + (item.rowCount || 0), 0);
  els.metricRows.textContent = formatNumber(totalRows);
  els.metricLastRun.textContent = state.history[0]?.timestamp || "Sin registros";

  if (!state.history.length) {
    els.historyList.innerHTML = '<div class="history-card"><p class="history-title">Aun no hay descargas registradas.</p></div>';
  } else {
    els.historyList.innerHTML = state.history.map((entry) => {
      return [
        '<article class="history-card">',
        '  <div class="history-head">',
        "    <div>",
        '      <p class="history-title">' + entry.variable + "</p>",
        '      <p class="history-meta">' + entry.timestamp + "</p>",
        "    </div>",
        '    <span class="history-pill">' + formatNumber(entry.rowCount) + " filas</span>",
        "  </div>",
        '  <p class="history-meta">Departamento: ' + (entry.department || "Todos") + " · Municipio: " + (entry.municipality || "Todos") + "</p>",
        '  <p class="history-meta">Formato: ' + entry.format.toUpperCase() + "</p>",
        "</article>",
      ].join("");
    }).join("");
  }

  const summaryItems = [
    "Datasets disponibles: " + (state.meta?.datasets.length || 0),
    "Historial local de descargas: " + state.history.length,
    "Filas descargadas en esta sesion: " + formatNumber(totalRows),
    "Subdominio productivo: ideam.sergiobc.com",
  ];
  els.dashboardSummary.innerHTML = summaryItems.map((item) => "<li>" + item + "</li>").join("");
}

async function runPreview() {
  try {
    const payload = getPayload();
    validatePayload(payload);
    setProgress(25, "Consultando IDEAM", "Preparando vista previa");
    setLiveStats(["Construyendo filtros", "Consultando Socrata", "Limite: 200 filas"]);
    logLine("Iniciando vista previa para " + payload.datasetId + ".");

    const response = await fetch("/api/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Error consultando vista previa.");
    }

    renderPreview(data.rows);
    setProgress(100, "Vista previa lista", formatNumber(data.rowCount) + " filas");
    setLiveStats([
      "Dataset: " + data.datasetId,
      "Filas: " + formatNumber(data.rowCount),
      "Cobertura depto: " + (payload.department || "Todos"),
    ]);
    logLine("Vista previa completada con " + data.rowCount + " filas.");
    switchView("extractor");
  } catch (error) {
    setProgress(100, "Error", "Revisa los filtros");
    setLiveStats(["Error en vista previa"]);
    logLine(error.message, "error");
  }
}

async function runCoverage() {
  const datasetId = els.datasetSelect.value;
  const department = els.departmentSelect.value;
  if (!department) {
    els.coverageResult.textContent = "Selecciona primero un departamento.";
    return;
  }
  els.coverageResult.textContent = "Validando variantes...";
  try {
    const response = await fetch(
      "/api/coverage?datasetId=" + encodeURIComponent(datasetId) + "&department=" + encodeURIComponent(department)
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "No fue posible validar la cobertura.");
    }
    const matched = data.matched_rows || 0;
    const unmatched = data.unmatched_rows || 0;
    els.coverageResult.innerHTML = [
      "<strong>Configuradas:</strong> " + data.configured_variants.join(", "),
      "<br /><strong>Filas cubiertas:</strong> " + formatNumber(matched),
      "<br /><strong>Filas no cubiertas:</strong> " + formatNumber(unmatched),
      unmatched ? "<br /><strong>Variantes nuevas:</strong> " + data.unmatched_discovered.map((row) => row.departamento).join(", ") : "",
    ].join("");
    logLine("Verificacion territorial completada para " + department + ".");
  } catch (error) {
    els.coverageResult.textContent = error.message;
    logLine(error.message, "error");
  }
}

async function runDownload(event) {
  event.preventDefault();
  try {
    const payload = getPayload();
    validatePayload(payload);
    setProgress(20, "Preparando descarga", "Calculando volumen");
    setLiveStats(["Validando filtros", "Consultando API", "Generando archivo"]);
    logLine("Iniciando descarga " + payload.format.toUpperCase() + ".");

    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "No fue posible completar la descarga.");
    }

    const blob = await response.blob();
    const fileName = response.headers.get("x-export-name") || "ideam-export." + payload.format;
    const rowCount = Number(response.headers.get("x-row-count") || "0");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);

    setProgress(100, "Descarga lista", formatNumber(rowCount) + " filas");
    setLiveStats([
      "Archivo: " + fileName,
      "Filas: " + formatNumber(rowCount),
      "Formato: " + payload.format.toUpperCase(),
    ]);
    logLine("Descarga completada: " + fileName + ".");

    const selectedDataset = state.meta.datasets.find((dataset) => dataset.id === payload.datasetId);
    const history = getHistory();
    history.unshift({
      timestamp: new Date().toLocaleString("es-CO"),
      variable: selectedDataset?.name || payload.datasetId,
      department: payload.department,
      municipality: payload.municipality,
      format: payload.format,
      rowCount,
      fileName,
    });
    saveHistory(history);
    renderHistory();
  } catch (error) {
    setProgress(100, "Error", "Descarga interrumpida");
    setLiveStats(["Error de descarga"]);
    logLine(error.message, "error");
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewTarget));
  });
  els.departmentSelect.addEventListener("change", () => {
    loadMunicipalities().catch((error) => logLine(error.message, "error"));
  });
  els.previewButton.addEventListener("click", runPreview);
  els.coverageButton.addEventListener("click", runCoverage);
  els.extractorForm.addEventListener("submit", runDownload);
  els.clearHistoryButton.addEventListener("click", () => {
    localStorage.removeItem("ideam-history");
    renderHistory();
    logLine("Historial local eliminado.");
  });
}

async function boot() {
  bindEvents();
  renderHistory();
  setProgress(0, "Listo", "0 filas");
  setLiveStats(["Worker iniciado", "Esperando consulta"]);
  await loadMeta();
  renderHistory();
  switchView("dashboard");
}

boot().catch((error) => {
  els.apiStatusText.textContent = "Error inicial";
  logLine(error.message, "error");
});
`;

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function textResponse(text, contentType, cacheControl) {
  return new Response(text, {
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl || "public, max-age=300",
    },
  });
}

function normalizeLabel(value) {
  return (value || "")
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function quoteSoql(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function departmentVariants(department) {
  const configured = DEPARTMENT_MAP[department] || [department];
  const variants = new Set(configured.concat([department]).filter(Boolean));
  Array.from(variants).forEach((variant) => variants.add(normalizeLabel(variant)));
  return Array.from(variants).filter(Boolean).sort();
}

function buildDepartmentFilter(department, column) {
  const variants = departmentVariants(department);
  const replacements = {};
  variants.forEach((variant) => {
    replacements[normalizeLabel(variant)] = department;
  });
  const inClause = variants.map((variant) => quoteSoql(variant.toUpperCase())).join(", ");
  return {
    filter: "upper(" + (column || "departamento") + ") IN (" + inClause + ")",
    replacements,
    variants,
  };
}

function buildMunicipalityFilter(municipality, column) {
  if (!municipality) {
    return null;
  }
  return "upper(" + (column || "municipio") + ") = " + quoteSoql(String(municipality).toUpperCase());
}

function buildStationFilter(stationCode) {
  if (!stationCode) {
    return null;
  }
  return "codigoestacion = " + quoteSoql(stationCode);
}

function buildDateFilters(config, startDate, endDate) {
  if (!config.dateColumn || !startDate || !endDate) {
    return [];
  }
  return [
    config.dateColumn + " >= '" + startDate + "T00:00:00.000'",
    config.dateColumn + " < '" + endDate + "T23:59:59.999'",
  ];
}

function resolveDataset(datasetId) {
  return DATASETS.find((dataset) => dataset.id === datasetId);
}

function fileSafePart(value, fallback) {
  return String(value || fallback || "sin_dato")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^[._ ]+|[._ ]+$/g, "") || (fallback || "sin_dato");
}

function timestampStamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return hh + mm + "_" + dd + month + yy;
}

async function socrataGet(config, datasetId, params) {
  const url = new URL(config.socrataDomain + "/resource/" + datasetId + ".json");
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString(), {
    headers: {
      "accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Socrata respondio con estado " + response.status + " para " + datasetId + ".");
  }
  return response.json();
}

async function fetchCount(config, datasetId, where) {
  const rows = await socrataGet(config, datasetId, {
    "$select": "count(*) as total",
    "$where": where,
    "$limit": 1,
  });
  return Number(rows?.[0]?.total || 0);
}

async function fetchAllRows(config, datasetId, where, order, limitCap) {
  const rows = [];
  let offset = 0;

  while (true) {
    const page = await socrataGet(datasetId, {
      "$where": where,
      "$order": order || ":id",
      "$limit": config.pageLimit,
      "$offset": offset,
    });

    if (!page.length) {
      break;
    }

    rows.push.apply(rows, page);
    if (rows.length > limitCap) {
      throw new Error(
        "La consulta excede el limite operativo de " +
          config.maxExportRows.toLocaleString("es-CO") +
          " filas. Reduce el rango o agrega filtros."
      );
    }

    if (page.length < config.pageLimit) {
      break;
    }
    offset += config.pageLimit;
  }

  return rows;
}

function normalizeRows(rows, datasetId, replacements, dateColumn) {
  return rows.map((row) => {
    const normalized = Object.assign({}, row);
    if (normalized.departamento) {
      const key = normalizeLabel(normalized.departamento);
      normalized.departamento = replacements[key] || normalized.departamento;
    }
    ["valorobservado", "latitud", "longitud"].forEach((column) => {
      if (normalized[column] !== undefined) {
        const asNumber = Number(normalized[column]);
        normalized[column] = Number.isFinite(asNumber) ? asNumber : normalized[column];
      }
    });
    if (dateColumn && normalized[dateColumn]) {
      const date = new Date(normalized[dateColumn]);
      if (!Number.isNaN(date.valueOf())) {
        normalized[dateColumn] = date.toISOString();
      }
    }
    normalized.source_dataset_id = datasetId;
    return normalized;
  });
}

function rowsToCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  };

  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escape(row[column])).join(","));
  return [header].concat(body).join("\n");
}

function buildFilters(payload, dataset) {
  const filters = [];
  const replacements = {};

  if (payload.department) {
    const department = buildDepartmentFilter(payload.department, "departamento");
    filters.push(department.filter);
    Object.assign(replacements, department.replacements);
  }

  const municipality = buildMunicipalityFilter(payload.municipality, "municipio");
  if (municipality) {
    filters.push(municipality);
  }

  const station = buildStationFilter(payload.stationCode);
  if (station) {
    filters.push(station);
  }

  buildDateFilters(dataset, payload.startDate, payload.endDate).forEach((filter) => filters.push(filter));
  return {
    where: filters.length ? filters.join(" AND ") : null,
    replacements,
  };
}

async function handleMeta(env) {
  const config = getConfig(env);
  return jsonResponse({
    datasets: DATASETS,
    departments: Object.keys(DEPARTMENT_MAP).sort(),
    previewLimit: config.previewLimit,
    maxExportRows: config.maxExportRows,
  });
}

async function handleMunicipalities(request, env) {
  const config = getConfig(env);
  const url = new URL(request.url);
  const department = url.searchParams.get("department");
  if (!department) {
    return jsonResponse({ municipalities: [] });
  }
  const departmentFilter = buildDepartmentFilter(department, "departamento");
  const rows = await socrataGet(config, config.catalogDatasetId, {
    "$select": "municipio",
    "$where": departmentFilter.filter,
    "$group": "municipio",
    "$order": "municipio",
    "$limit": 5000,
  });

  const municipalities = rows
    .map((row) => row.municipio)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));

  return jsonResponse({ municipalities });
}

async function handleCoverage(request, env) {
  const config = getConfig(env);
  const url = new URL(request.url);
  const datasetId = url.searchParams.get("datasetId");
  const department = url.searchParams.get("department");
  if (!datasetId || !department) {
    return jsonResponse({ error: "datasetId y department son requeridos." }, 400);
  }

  const configured = departmentVariants(department).map((value) => normalizeLabel(value));
  const needle = normalizeLabel(department).slice(0, 4);
  const discovered = await socrataGet(config, datasetId, {
    "$select": "departamento, count(*) as total",
    "$where": "upper(departamento) like " + quoteSoql("%" + needle + "%"),
    "$group": "departamento",
    "$order": "departamento",
    "$limit": 5000,
  });

  const matched = [];
  const unmatched = [];
  discovered.forEach((row) => {
    const normalized = normalizeLabel(row.departamento);
    const record = {
      departamento: row.departamento,
      normalized,
      total: Number(row.total || 0),
    };
    if (configured.includes(normalized)) {
      matched.push(record);
    } else {
      unmatched.push(record);
    }
  });

  return jsonResponse({
    department,
    configured_variants: Array.from(new Set(configured)).sort(),
    matched,
    unmatched_discovered: unmatched,
    matched_rows: matched.reduce((sum, row) => sum + row.total, 0),
    unmatched_rows: unmatched.reduce((sum, row) => sum + row.total, 0),
  });
}

async function parsePayload(request) {
  const payload = await request.json();
  if (!payload.datasetId || !payload.startDate || !payload.endDate) {
    throw new Error("datasetId, startDate y endDate son obligatorios.");
  }
  const dataset = resolveDataset(payload.datasetId);
  if (!dataset) {
    throw new Error("Dataset no soportado en la interfaz web.");
  }
  return { payload, dataset };
}

async function handlePreview(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const built = buildFilters(payload, dataset);
  const rowCount = await fetchCount(config, dataset.id, built.where);
  const rows = await socrataGet(config, dataset.id, {
    "$where": built.where,
    "$order": dataset.dateColumn ? dataset.dateColumn + " DESC" : ":id",
    "$limit": config.previewLimit,
  });
  const normalized = normalizeRows(rows, dataset.id, built.replacements, dataset.dateColumn);
  return jsonResponse({
    datasetId: dataset.id,
    rowCount,
    rows: normalized,
  });
}

async function handleExport(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const built = buildFilters(payload, dataset);
  const total = await fetchCount(config, dataset.id, built.where);
  if (total > config.maxExportRows) {
    return jsonResponse(
      {
        error:
          "La consulta excede el limite operativo de " +
          config.maxExportRows.toLocaleString("es-CO") +
          " filas. Reduce el rango o agrega filtros.",
      },
      413
    );
  }

  const rows = await fetchAllRows(
    config,
    dataset.id,
    built.where,
    dataset.dateColumn ? dataset.dateColumn + " DESC" : ":id",
    config.maxExportRows
  );
  const normalized = normalizeRows(rows, dataset.id, built.replacements, dataset.dateColumn);

  const fileStem = [
    fileSafePart(dataset.name, "variable").toLowerCase(),
    fileSafePart(payload.department || "todos", "todos").toLowerCase(),
    fileSafePart(payload.municipality || "todos", "todos").toLowerCase(),
    timestampStamp(),
  ].join("_");

  if ((payload.format || "csv").toLowerCase() === "json") {
    return new Response(JSON.stringify(normalized, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="' + fileStem + '.json"',
        "x-export-name": fileStem + ".json",
        "x-row-count": String(normalized.length),
      },
    });
  }

  return new Response(rowsToCsv(normalized), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="' + fileStem + '.csv"',
      "x-export-name": fileStem + ".csv",
      "x-row-count": String(normalized.length),
    },
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "ideam-web-app" });
    }
    if (url.pathname === "/api/meta" && request.method === "GET") {
      return await handleMeta(env);
    }
    if (url.pathname === "/api/municipalities" && request.method === "GET") {
      return await handleMunicipalities(request, env);
    }
    if (url.pathname === "/api/coverage" && request.method === "GET") {
      return await handleCoverage(request, env);
    }
    if (url.pathname === "/api/preview" && request.method === "POST") {
      return await handlePreview(request, env);
    }
    if (url.pathname === "/api/export" && request.method === "POST") {
      return await handleExport(request, env);
    }
    return jsonResponse({ error: "Ruta API no encontrada." }, 404);
  } catch (error) {
    return jsonResponse({ error: error.message || "Error interno del Worker." }, 500);
  }
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(request, env);
  }
  if (url.pathname === "/styles.css") {
    return textResponse(CSS, "text/css; charset=utf-8");
  }
  if (url.pathname === "/app.js") {
    return textResponse(APP_JS, "application/javascript; charset=utf-8");
  }
  return textResponse(HTML, "text/html; charset=utf-8");
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
