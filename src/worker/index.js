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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
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
  for (const variant of Array.from(variants)) {
    variants.add(normalizeLabel(variant));
  }
  return Array.from(variants).filter(Boolean).sort();
}

function buildDepartmentFilter(department, column = "departamento") {
  const variants = departmentVariants(department);
  const replacements = {};
  for (const variant of variants) {
    replacements[normalizeLabel(variant)] = department;
  }
  const inClause = variants.map((variant) => quoteSoql(variant.toUpperCase())).join(", ");
  return {
    filter: `upper(${column}) IN (${inClause})`,
    replacements,
  };
}

function buildMunicipalityFilter(municipality, column = "municipio") {
  if (!municipality) return null;
  return `upper(${column}) = ${quoteSoql(String(municipality).toUpperCase())}`;
}

function buildStationFilter(stationCode) {
  if (!stationCode) return null;
  return `codigoestacion = ${quoteSoql(stationCode)}`;
}

function buildDateFilters(config, startDate, endDate) {
  if (!config.dateColumn || !startDate || !endDate) return [];
  return [
    `${config.dateColumn} >= '${startDate}T00:00:00.000'`,
    `${config.dateColumn} < '${endDate}T23:59:59.999'`,
  ];
}

function resolveDataset(datasetId) {
  return DATASETS.find((dataset) => dataset.id === datasetId);
}

function fileSafePart(value, fallback) {
  return (
    String(value || fallback || "sin_dato")
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*]+/g, "_")
      .replace(/\s+/g, "_")
      .replace(/^[._ ]+|[._ ]+$/g, "") || (fallback || "sin_dato")
  );
}

function timestampStamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${hh}${mm}_${dd}${month}${yy}`;
}

async function socrataGet(config, datasetId, params) {
  const url = new URL(`${config.socrataDomain}/resource/${datasetId}.json`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Socrata respondio con estado ${response.status} para ${datasetId}.`);
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
    const page = await socrataGet(config, datasetId, {
      "$where": where,
      "$order": order || ":id",
      "$limit": config.pageLimit,
      "$offset": offset,
    });

    if (!page.length) break;

    rows.push(...page);
    if (rows.length > limitCap) {
      throw new Error(
        `La consulta excede el limite operativo de ${config.maxExportRows.toLocaleString("es-CO")} filas. Reduce el rango o agrega filtros.`
      );
    }
    if (page.length < config.pageLimit) break;
    offset += config.pageLimit;
  }

  return rows;
}

function normalizeRows(rows, datasetId, replacements, dateColumn) {
  return rows.map((row) => {
    const normalized = { ...row };
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
  if (!rows.length) return "";

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escape(row[column])).join(","));
  return [header, ...body].join("\n");
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
  if (municipality) filters.push(municipality);

  const station = buildStationFilter(payload.stationCode);
  if (station) filters.push(station);

  buildDateFilters(dataset, payload.startDate, payload.endDate).forEach((filter) => filters.push(filter));

  return {
    where: filters.length ? filters.join(" AND ") : null,
    replacements,
  };
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
  if (!department) return jsonResponse({ municipalities: [] });

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
    "$where": `upper(departamento) like ${quoteSoql(`%${needle}%`)}`,
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
    if (configured.includes(normalized)) matched.push(record);
    else unmatched.push(record);
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

async function handlePreview(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const built = buildFilters(payload, dataset);
  const rowCount = await fetchCount(config, dataset.id, built.where);
  const rows = await socrataGet(config, dataset.id, {
    "$where": built.where,
    "$order": dataset.dateColumn ? `${dataset.dateColumn} DESC` : ":id",
    "$limit": config.previewLimit,
  });
  const normalized = normalizeRows(rows, dataset.id, built.replacements, dataset.dateColumn);
  return jsonResponse({ datasetId: dataset.id, rowCount, rows: normalized });
}

async function handleExport(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const built = buildFilters(payload, dataset);
  const total = await fetchCount(config, dataset.id, built.where);

  if (total > config.maxExportRows) {
    return jsonResponse(
      {
        error: `La consulta excede el limite operativo de ${config.maxExportRows.toLocaleString("es-CO")} filas. Reduce el rango o agrega filtros.`,
      },
      413
    );
  }

  const rows = await fetchAllRows(
    config,
    dataset.id,
    built.where,
    dataset.dateColumn ? `${dataset.dateColumn} DESC` : ":id",
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
        "content-disposition": `attachment; filename="${fileStem}.json"`,
        "x-export-name": `${fileStem}.json`,
        "x-row-count": String(normalized.length),
      },
    });
  }

  return new Response(rowsToCsv(normalized), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileStem}.csv"`,
      "x-export-name": `${fileStem}.csv`,
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
      return handleMeta(env);
    }
    if (url.pathname === "/api/municipalities" && request.method === "GET") {
      return handleMunicipalities(request, env);
    }
    if (url.pathname === "/api/coverage" && request.method === "GET") {
      return handleCoverage(request, env);
    }
    if (url.pathname === "/api/preview" && request.method === "POST") {
      return handlePreview(request, env);
    }
    if (url.pathname === "/api/export" && request.method === "POST") {
      return handleExport(request, env);
    }
    return jsonResponse({ error: "Ruta API no encontrada." }, 404);
  } catch (error) {
    return jsonResponse({ error: error.message || "Error interno del Worker." }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
