import JSZip from "jszip";
import writerModule from "parquetjs-lite/lib/writer.js";
import schemaModule from "parquetjs-lite/lib/schema.js";

const { ParquetWriter } = writerModule;
const { ParquetSchema } = schemaModule;

const ASYNC_EXPORT_PAGE_BATCH = 1;
const EXPORT_RATE_LIMIT = 30;
const EXPORT_RATE_WINDOW_MS = 60 * 60 * 1000;
const EXPORT_OBJECT_TTL_SECONDS = 60 * 60;
const SOCRATA_MAX_ATTEMPTS = 4;
const SOCRATA_RETRY_BASE_MS = 350;

const DEFAULT_CONFIG = {
  socrataDomain: "https://www.datos.gov.co",
  catalogDatasetId: "hp9r-jxuu",
  pageLimit: 50000,
  previewLimit: 200,
  exportPageSize: 50000,
  maxExportRows: null,
  maxCatalogStations: null,
};

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
  "ATLANTICO": ["ATLANTICO", "ATLÃNTICO"],
  "BOLIVAR": ["BOLIVAR", "BOLÃVAR"],
  "BOGOTA D.C.": ["BOGOTA", "BOGOTÃ", "BOGOTÃ D.C.", "BOGOTA, D.C"],
  "BOYACA": ["BOYACA", "BOYACÃ"],
  "CALDAS": ["CALDAS"],
  "CAQUETA": ["CAQUETA", "CAQUETÃ"],
  "CASANARE": ["CASANARE"],
  "CAUCA": ["CAUCA"],
  "CESAR": ["CESAR"],
  "CHOCO": ["CHOCO", "CHOCÃ“"],
  "CORDOBA": ["CORDOBA", "CÃ“RDOBA"],
  "CUNDINAMARCA": ["CUNDINAMARCA"],
  "GUAINIA": ["GUAINIA", "GUAINÃA"],
  "GUAVIARE": ["GUAVIARE"],
  "HUILA": ["HUILA"],
  "LA GUAJIRA": ["LA GUAJIRA", "GUAJIRA"],
  "MAGDALENA": ["MAGDALENA"],
  "META": ["META"],
  "NARINO": ["NARIÃ‘O", "NARINO"],
  "NORTE DE SANTANDER": ["NORTE DE SANTANDER"],
  "PUTUMAYO": ["PUTUMAYO"],
  "QUINDIO": ["QUINDIO", "QUINDÃO"],
  "RISARALDA": ["RISARALDA"],
  "SAN ANDRES Y PROVIDENCIA": ["SAN ANDRES", "SAN ANDRÃ‰S Y PROVIDENCIA"],
  "SANTANDER": ["SANTANDER"],
  "SUCRE": ["SUCRE"],
  "TOLIMA": ["TOLIMA"],
  "VALLE DEL CAUCA": ["VALLE DEL CAUCA", "VALLE"],
  "VAUPES": ["VAUPES", "VAUPÃ‰S"],
  "VICHADA": ["VICHADA"]
};

const CLEAN_DEPARTMENT_MAP = {
  "ATLANTICO": ["ATLANTICO", "ATL\u00c1NTICO"],
  "BOLIVAR": ["BOLIVAR", "BOL\u00cdVAR"],
  "BOGOTA D.C.": ["BOGOTA", "BOGOT\u00c1", "BOGOT\u00c1 D.C.", "BOGOTA, D.C"],
  "BOYACA": ["BOYACA", "BOYAC\u00c1"],
  "CAQUETA": ["CAQUETA", "CAQUET\u00c1"],
  "CHOCO": ["CHOCO", "CHOC\u00d3"],
  "CORDOBA": ["CORDOBA", "C\u00d3RDOBA"],
  "GUAINIA": ["GUAINIA", "GUAIN\u00cdA"],
  "NARINO": ["NARI\u00d1O", "NARINO"],
  "QUINDIO": ["QUINDIO", "QUIND\u00cdO"],
  "SAN ANDRES Y PROVIDENCIA": ["SAN ANDRES", "SAN ANDR\u00c9S Y PROVIDENCIA"],
  "VAUPES": ["VAUPES", "VAUP\u00c9S"],
};

const CATALOG_FILTERS = [
  { key: "municipalities", label: "Municipio", column: "municipio" },
  { key: "hydrologicZones", label: "Zona hidrografica", column: "zonahidrografica" },
  { key: "stations", label: "Codigo de estacion", column: "codigoestacion", labelColumn: "nombreestacion" },
  { key: "stationNames", label: "Nombre de estacion", column: "nombreestacion" },
  { key: "sensors", label: "Codigo de sensor", column: "codigosensor" },
  { key: "sensorDescriptions", label: "Descripcion del sensor", column: "descripcionsensor" },
  { key: "units", label: "Unidad de medida", column: "unidadmedida" },
];

function getConfig(env) {
  return {
    socrataDomain: env?.SOCRATA_DOMAIN || DEFAULT_CONFIG.socrataDomain,
    catalogDatasetId: env?.CATALOG_DATASET_ID || DEFAULT_CONFIG.catalogDatasetId,
    pageLimit: positiveNumber(env?.PAGE_LIMIT, DEFAULT_CONFIG.pageLimit),
    previewLimit: positiveNumber(env?.PREVIEW_LIMIT, DEFAULT_CONFIG.previewLimit),
    exportPageSize: positiveNumber(env?.EXPORT_PAGE_SIZE, DEFAULT_CONFIG.exportPageSize),
    maxExportRows: positiveNumber(env?.MAX_EXPORT_ROWS, DEFAULT_CONFIG.maxExportRows),
    maxCatalogStations: env?.MAX_CATALOG_STATIONS ? positiveNumber(env.MAX_CATALOG_STATIONS, DEFAULT_CONFIG.maxCatalogStations) : DEFAULT_CONFIG.maxCatalogStations,
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
      ...extraHeaders,
    },
  });
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function uniqueSorted(values, locale = "es") {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), locale));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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

function buildUpperInFilter(values, column) {
  const normalized = uniqueSorted(values.map((value) => String(value).trim().toUpperCase()));
  if (!normalized.length) return null;
  return `upper(${column}) IN (${normalized.map((value) => quoteSoql(value)).join(", ")})`;
}

function buildExactInFilter(values, column) {
  const normalized = uniqueSorted(values.map((value) => String(value).trim()));
  if (!normalized.length) return null;
  return `${column} IN (${normalized.map((value) => quoteSoql(value)).join(", ")})`;
}

function departmentVariants(department) {
  const configured = CLEAN_DEPARTMENT_MAP[department] || DEPARTMENT_MAP[department] || [department];
  const variants = new Set(configured.concat([department]).filter(Boolean));
  for (const variant of Array.from(variants)) {
    variants.add(normalizeLabel(variant));
  }
  return Array.from(variants).filter(Boolean).sort();
}

function buildDepartmentFilter(departments, column = "departamento") {
  const selected = asArray(departments);
  const variants = [];
  const replacements = {};

  selected.forEach((department) => {
    departmentVariants(department).forEach((variant) => {
      variants.push(variant);
      replacements[normalizeLabel(variant)] = department;
    });
  });

  const uniqueVariants = uniqueSorted(variants);
  return {
    filter: uniqueVariants.length
      ? `upper(${column}) IN (${uniqueVariants.map((variant) => quoteSoql(variant.toUpperCase())).join(", ")})`
      : null,
    replacements,
    variants: uniqueVariants,
  };
}

function canonicalDepartment(value) {
  const normalized = normalizeLabel(value);
  return Object.keys(DEPARTMENT_MAP).find((department) => {
    if (normalizeLabel(department) === normalized) return true;
    return departmentVariants(department).some((variant) => normalizeLabel(variant) === normalized);
  }) || null;
}

function validateRequiredDepartments(payload) {
  const requested = asArray(payload.departments ?? payload.department).map((value) => String(value).trim()).filter(Boolean);
  if (!requested.length) {
    return {
      ok: false,
      error: "Debes seleccionar al menos un departamento. Las descargas globales no estan permitidas para proteger el costo y la estabilidad del servicio.",
      departments: [],
    };
  }

  const invalid = requested.filter((department) => !canonicalDepartment(department));
  if (invalid.length) {
    return {
      ok: false,
      error: `Departamento no soportado: ${invalid.join(", ")}.`,
      departments: [],
    };
  }

  return {
    ok: true,
    error: null,
    departments: Array.from(new Set(requested.map((department) => canonicalDepartment(department)).filter(Boolean))),
  };
}

function buildDateFilters(dataset, startDate, endDate) {
  if (!dataset.dateColumn || !startDate || !endDate) return [];
  return [
    `${dataset.dateColumn} >= '${startDate}T00:00:00.000'`,
    `${dataset.dateColumn} <= '${endDate}T23:59:59.999'`,
  ];
}

function resolveDataset(datasetId) {
  return DATASETS.find((dataset) => dataset.id === datasetId);
}

function resolveCatalogFilter(key) {
  return CATALOG_FILTERS.find((item) => item.key === key) || null;
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

function buildFileStem(payload, dataset) {
  return [
    fileSafePart(dataset.name, "variable").toLowerCase(),
    fileSafePart(asArray(payload.departments ?? payload.department).join("-") || "todos", "todos").toLowerCase(),
    fileSafePart(asArray(payload.outputMunicipalities ?? payload.municipality).join("-") || "todos", "todos").toLowerCase(),
    timestampStamp(),
  ].join("_");
}

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function summarizeRows(rows, dataset) {
  const stationCodes = new Set();
  const municipalities = new Set();
  const departments = new Set();
  const zones = new Set();
  const dates = [];

  rows.forEach((row) => {
    if (row.codigoestacion) stationCodes.add(String(row.codigoestacion));
    if (row.municipio) municipalities.add(String(row.municipio));
    if (row.departamento) departments.add(String(row.departamento));
    if (row.zonahidrografica) zones.add(String(row.zonahidrografica));
    if (dataset.dateColumn && row[dataset.dateColumn]) {
      const parsed = parseDate(row[dataset.dateColumn]);
      if (parsed) dates.push(parsed);
    }
  });

  const orderedDates = dates.sort((left, right) => left.valueOf() - right.valueOf());

  return {
    rowCount: rows.length,
    stationCount: stationCodes.size,
    municipalityCount: municipalities.size,
    departmentCount: departments.size,
    zoneCount: zones.size,
    observedStart: orderedDates[0]?.toISOString() || null,
    observedEnd: orderedDates[orderedDates.length - 1]?.toISOString() || null,
  };
}

async function socrataGet(config, datasetId, params) {
  const url = new URL(`${config.socrataDomain}/resource/${datasetId}.json`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let lastError = null;
  for (let attempt = 1; attempt <= SOCRATA_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });
      if (response.ok) {
        return response.json();
      }

      const retryable = response.status === 429 || response.status >= 500;
      const body = await response.text().catch(() => "");
      lastError = new Error(`Socrata respondio con estado ${response.status} para ${datasetId}.${body ? ` ${body.slice(0, 180)}` : ""}`);
      if (!retryable || attempt === SOCRATA_MAX_ATTEMPTS) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
      if (attempt === SOCRATA_MAX_ATTEMPTS) {
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, SOCRATA_RETRY_BASE_MS * attempt));
  }

  throw lastError || new Error(`No fue posible consultar Socrata para ${datasetId}.`);
}

async function fetchCount(config, datasetId, where) {
  const rows = await socrataGet(config, datasetId, {
    "$select": "count(*) as total",
    "$where": where,
    "$limit": 1,
  });
  return Number(rows?.[0]?.total || 0);
}

async function fetchAllRows(config, datasetId, where, order, limitCap = Number.POSITIVE_INFINITY, extraParams = {}) {
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await socrataGet(config, datasetId, {
      ...extraParams,
      "$where": where,
      "$order": order || ":id",
      "$limit": config.pageLimit,
      "$offset": offset,
    });
    if (!page.length) break;
    rows.push(...page);
    if (Number.isFinite(limitCap) && rows.length > limitCap) {
      throw new Error("La consulta excede el limite operativo de " + limitCap.toLocaleString("es-CO") + " registros intermedios.");
    }
    if (page.length < config.pageLimit) break;
    offset += config.pageLimit;
  }
  return rows;
}

async function fetchPlanPage(config, datasetId, where, order, offset, limit) {
  return socrataGet(config, datasetId, {
    "$where": where,
    "$order": order || ":id",
    "$limit": limit,
    "$offset": offset,
  });
}

async function fetchPreviewRowsForPlans(config, datasetId, plans, order) {
  const rows = [];

  for (const plan of plans) {
    if (rows.length >= config.previewLimit) break;
    const page = await socrataGet(config, datasetId, {
      "$where": plan.where,
      "$order": order || ":id",
      "$limit": config.previewLimit - rows.length,
    });
    rows.push(...page);
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

  const columns = getRowColumns(rows);

  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => escape(row[column])).join(","));
  return [header, ...body].join("\n");
}

function getRowColumns(rows) {
  return Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );
}

function expandStationCodes(values) {
  const codes = new Set();
  asArray(values).forEach((value) => {
    const code = String(value).trim();
    if (!code) return;
    codes.add(code);
    if (/^\d{8}$/.test(code)) codes.add(`00${code}`);
    if (/^00\d{8}$/.test(code)) codes.add(code.slice(2));
  });
  return Array.from(codes);
}

function buildDatasetFilterClause(definition, values) {
  if (!values.length) return null;
  if (definition.column === "codigoestacion") {
    return buildExactInFilter(expandStationCodes(values), definition.column);
  }
  return buildUpperInFilter(values, definition.column);
}

function collectDatasetFilters(payload, dataset, excludeKey = null, includeDepartment = true) {
  const filters = [];
  const replacements = {};
  const departments = asArray(payload.departments ?? payload.department);

  if (includeDepartment && departments.length) {
    const department = buildDepartmentFilter(departments, "departamento");
    if (department.filter) filters.push(department.filter);
    Object.assign(replacements, department.replacements);
  }

  const catalogFilters = payload.catalogFilters || {};
  CATALOG_FILTERS.forEach((definition) => {
    if (definition.key === excludeKey) return;
    let values = asArray(catalogFilters[definition.key]);
    if (definition.key === "municipalities") {
      values = uniqueSorted(values.concat(asArray(payload.outputMunicipalities ?? payload.municipality)));
    }
    const clause = buildDatasetFilterClause(definition, values);
    if (clause) filters.push(clause);
  });

  buildDateFilters(dataset, payload.startDate, payload.endDate).forEach((filter) => filters.push(filter));

  return {
    filters: filters.filter(Boolean),
    where: filters.filter(Boolean).join(" AND ") || null,
    replacements,
  };
}

function buildCatalogWhere(payload, dataset, excludeKey = null) {
  return collectDatasetFilters(payload, dataset, excludeKey).where;
}

async function resolveStationPool(_config, payload) {
  const manualCodes = expandStationCodes(payload.stationCodes || payload.stationCode);
  const catalogFilters = payload.catalogFilters || {};
  const combined = new Set(manualCodes);
  asArray(catalogFilters.stations).forEach((code) => {
    expandStationCodes(code).forEach((expanded) => combined.add(expanded));
  });
  return combined.size ? uniqueSorted(Array.from(combined)) : null;
}

async function buildQueryPlans(config, payload, dataset) {
  const base = collectDatasetFilters(payload, dataset, "stations");
  const stationPool = await resolveStationPool(config, payload);
  if (stationPool === null) {
    return {
      plans: [{ where: base.where }],
      replacements: base.replacements,
      stationPoolSize: 0,
    };
  }

  if (!stationPool.length) {
    return {
      plans: [],
      replacements: base.replacements,
      stationPoolSize: 0,
    };
  }

  return {
    plans: chunkArray(stationPool, 400).map((chunk) => ({
      where: base.filters.concat([buildExactInFilter(chunk, "codigoestacion")]).filter(Boolean).join(" AND "),
    })),
    replacements: base.replacements,
    stationPoolSize: stationPool.length,
  };
}

async function buildCoveragePlans(config, payload, dataset) {
  const built = await buildQueryPlans(config, payload, dataset);
  return {
    plans: built.plans,
    stationPoolSize: built.stationPoolSize,
  };
}

async function collectCoverageRows(config, payload, dataset) {
  const built = await buildCoveragePlans(config, payload, dataset);
  const totals = new Map();

  for (const plan of built.plans) {
    const rows = await socrataGet(config, dataset.id, {
      "$select": "departamento, count(*) as total",
      "$where": plan.where,
      "$group": "departamento",
      "$order": "departamento",
      "$limit": 5000,
    });

    rows.forEach((row) => {
      if (!row?.departamento) return;
      const key = String(row.departamento);
      const current = totals.get(key) || { departamento: key, normalized: normalizeLabel(key), total: 0 };
      current.total += Number(row.total || 0);
      totals.set(key, current);
    });
  }

  return {
    rows: Array.from(totals.values()).sort((left, right) => left.departamento.localeCompare(right.departamento, "es")),
    stationPoolSize: built.stationPoolSize,
    queryPlans: built.plans.length,
  };
}

function classifyCoverageRows(department, discoveredRows) {
  const configuredVariants = Array.from(new Set(departmentVariants(department).map((value) => normalizeLabel(value)))).sort();
  const searchTokens = Array.from(
    new Set(
      configuredVariants
        .flatMap((value) => value.split(/[^A-Z0-9]+/))
        .filter((token) => token.length >= 4)
    )
  );

  const matched = [];
  const unmatched = [];

  discoveredRows.forEach((row) => {
    const normalized = normalizeLabel(row.departamento);
    const looksRelated =
      configuredVariants.includes(normalized) ||
      searchTokens.some((token) => normalized.includes(token) || token.includes(normalized));

    if (!looksRelated) return;

    const record = {
      departamento: row.departamento,
      normalized,
      total: Number(row.total || 0),
    };

    if (configuredVariants.includes(normalized)) {
      matched.push(record);
    } else {
      unmatched.push(record);
    }
  });

  return {
    department,
    configured_variants: configuredVariants,
    matched,
    unmatched_discovered: unmatched,
    matched_rows: matched.reduce((sum, row) => sum + row.total, 0),
    unmatched_rows: unmatched.reduce((sum, row) => sum + row.total, 0),
  };
}

async function buildExportPlan(config, payload, dataset) {
  const built = await buildQueryPlans(config, payload, dataset);
  const planPages = [];
  let rowCount = 0;

  for (let index = 0; index < built.plans.length; index += 1) {
    const where = built.plans[index].where;
    const count = await fetchCount(config, dataset.id, where);
    rowCount += count;
    planPages.push({
      planIndex: index,
      where,
      rowCount: count,
      pageCount: Math.ceil(count / config.exportPageSize),
    });
  }

  return {
    dataset,
    replacements: built.replacements,
    stationPoolSize: built.stationPoolSize,
    queryPlans: built.plans.length,
    rowCount,
    pageSize: config.exportPageSize,
    totalPages: planPages.reduce((sum, item) => sum + item.pageCount, 0),
    fileStem: buildFileStem(payload, dataset),
    planPages,
  };
}

async function parsePayload(request) {
  const payload = await request.json();
  if (!payload.datasetId || !payload.startDate || !payload.endDate) {
    throw new ApiError("datasetId, startDate y endDate son obligatorios.", 400);
  }
  const dataset = resolveDataset(payload.datasetId);
  if (!dataset) {
    throw new ApiError("Dataset no soportado en la interfaz web.", 400);
  }
  const departmentState = validateRequiredDepartments(payload);
  if (!departmentState.ok) {
    throw new ApiError(departmentState.error, 400);
  }
  payload.departments = departmentState.departments;
  return { payload, dataset };
}

async function handleMeta(env) {
  const config = getConfig(env);
  return jsonResponse({
    datasets: DATASETS,
    departments: Object.keys(DEPARTMENT_MAP).sort(),
    previewLimit: config.previewLimit,
    exportPageSize: config.exportPageSize,
    maxExportRows: null,
    catalogFilters: CATALOG_FILTERS,
  });
}

async function handleDateRange(request, env) {
  const config = getConfig(env);
  const url = new URL(request.url);
  const datasetId = url.searchParams.get("datasetId");
  const dataset = resolveDataset(datasetId);

  if (!datasetId || !dataset || !dataset.dateColumn) {
    return jsonResponse({ error: "datasetId invalido o sin columna temporal." }, 400);
  }

  const firstRow = await socrataGet(config, datasetId, {
    "$select": dataset.dateColumn,
    "$order": `${dataset.dateColumn} ASC`,
    "$limit": 1,
  });
  const lastRow = await socrataGet(config, datasetId, {
    "$select": dataset.dateColumn,
    "$order": `${dataset.dateColumn} DESC`,
    "$limit": 1,
  });

  const start = firstRow?.[0]?.[dataset.dateColumn] || null;
  const end = lastRow?.[0]?.[dataset.dateColumn] || null;
  const startDate = start ? String(start).slice(0, 10) : null;
  const endDate = end ? String(end).slice(0, 10) : null;

  return jsonResponse({
    datasetId,
    dateColumn: dataset.dateColumn,
    startDate,
    endDate,
    startYear: startDate ? Number(startDate.slice(0, 4)) : null,
    endYear: endDate ? Number(endDate.slice(0, 4)) : null,
  });
}

async function handleMunicipalities(request, env) {
  const config = getConfig(env);
  const url = new URL(request.url);
  const departments = url.searchParams.getAll("department");
  if (!departments.length) return jsonResponse({ municipalities: [] });

  const departmentFilter = buildDepartmentFilter(departments, "departamento");
  const rows = await socrataGet(config, config.catalogDatasetId, {
    "$select": "municipio",
    "$where": departmentFilter.filter,
    "$group": "municipio",
    "$order": "municipio",
    "$limit": 5000,
  });

  return jsonResponse({ municipalities: uniqueSorted(rows.map((row) => row.municipio)) });
}

async function handleCatalogOptions(request, env) {
  const config = getConfig(env);
  const payload = await request.json();
  const dataset = resolveDataset(payload.datasetId);
  if (!dataset) {
    return jsonResponse({ error: "Dataset no soportado para filtros." }, 400);
  }
  const definition = resolveCatalogFilter(payload.attributeKey);
  if (!definition) {
    return jsonResponse({ error: "Filtro de catalogo no soportado." }, 400);
  }

  const where = buildCatalogWhere(payload, dataset, definition.key);
  const selectColumns = definition.labelColumn
    ? `${definition.column}, ${definition.labelColumn}, count(*) as total`
    : `${definition.column}, count(*) as total`;
  const groupColumns = definition.labelColumn
    ? `${definition.column}, ${definition.labelColumn}`
    : definition.column;
  const rows = await socrataGet(config, dataset.id, {
    "$select": selectColumns,
    "$where": where,
    "$group": groupColumns,
    "$order": definition.column,
    "$limit": 5000,
  });

  return jsonResponse({
    attributeKey: definition.key,
    options: rows
      .map((row) => ({
        value: row[definition.column],
        label: definition.labelColumn && row[definition.labelColumn]
          ? `${row[definition.column]} - ${row[definition.labelColumn]}`
          : row[definition.column],
        total: Number(row.total || 0),
      }))
      .filter((row) => row.value),
  });
}

async function handleStationHelper(request, env) {
  const config = getConfig(env);
  const payload = await request.json();
  const dataset = resolveDataset(payload.datasetId);
  if (!dataset) {
    return jsonResponse({ error: "Dataset no soportado para estaciones." }, 400);
  }
  const where = buildCatalogWhere(payload, dataset);
  const rows = await socrataGet(config, dataset.id, {
    "$select": "codigoestacion, nombreestacion, departamento, municipio, zonahidrografica, count(*) as total",
    "$where": where,
    "$group": "codigoestacion, nombreestacion, departamento, municipio, zonahidrografica",
    "$order": "nombreestacion",
    "$limit": 500,
  });

  return jsonResponse({
    stations: rows.map((row) => ({
      code: row.codigoestacion || "",
      name: row.nombreestacion || "",
      department: row.departamento || "",
      municipality: row.municipio || "",
      zone: row.zonahidrografica || "",
      entity: `${Number(row.total || 0).toLocaleString("es-CO")} filas`,
    })),
  });
}

async function handleCoverage(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const departments = asArray(payload.departments ?? payload.department);

  if (!departments.length) {
    return jsonResponse({ error: "Debes seleccionar al menos un departamento para validar cobertura." }, 400);
  }

  const discovered = await collectCoverageRows(config, payload, dataset);
  const reports = departments.map((department) => classifyCoverageRows(department, discovered.rows));

  return jsonResponse({
    datasetId: dataset.id,
    reports,
    stationPoolSize: discovered.stationPoolSize,
    queryPlans: discovered.queryPlans,
    totalMatchedRows: reports.reduce((sum, item) => sum + item.matched_rows, 0),
    totalUnmatchedRows: reports.reduce((sum, item) => sum + item.unmatched_rows, 0),
  });
}

async function handlePreview(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const startedAt = Date.now();
  const built = await buildQueryPlans(config, payload, dataset);
  let rowCount = 0;

  for (const plan of built.plans) {
    rowCount += await fetchCount(config, dataset.id, plan.where);
  }

  const rows = built.plans.length
    ? await fetchPreviewRowsForPlans(config, dataset.id, built.plans, dataset.dateColumn ? `${dataset.dateColumn} DESC` : ":id")
    : [];
  const normalized = normalizeRows(rows, dataset.id, built.replacements, dataset.dateColumn);

  return jsonResponse({
    datasetId: dataset.id,
    rowCount,
    rows: normalized,
    summary: summarizeRows(normalized, dataset),
    stationPoolSize: built.stationPoolSize,
    queryPlans: built.plans.length,
    processingMs: Date.now() - startedAt,
  });
}

async function handleExportPlan(request, env) {
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const startedAt = Date.now();
  const plan = await buildExportPlan(config, payload, dataset);

  return jsonResponse({
    datasetId: dataset.id,
    fileStem: plan.fileStem,
    rowCount: plan.rowCount,
    pageSize: plan.pageSize,
    totalPages: plan.totalPages,
    queryPlans: plan.queryPlans,
    stationPoolSize: plan.stationPoolSize,
    replacements: plan.replacements,
    planPages: plan.planPages,
    processingMs: Date.now() - startedAt,
  });
}

async function handleExportPage(request, env) {
  const config = getConfig(env);
  const body = await request.json();
  const departmentState = validateRequiredDepartments(body);
  if (!departmentState.ok) {
    return jsonResponse({ error: departmentState.error }, 400);
  }

  const dataset = resolveDataset(body.datasetId);
  if (!dataset) {
    return jsonResponse({ error: "Dataset no soportado en export-page." }, 400);
  }

  if (!body.where && body.where !== null) {
    return jsonResponse({ error: "where es requerido para export-page." }, 400);
  }

  const offset = Number(body.offset || 0);
  const limit = Math.min(Number(body.limit || config.exportPageSize), config.exportPageSize);
  const rows = await fetchPlanPage(
    config,
    dataset.id,
    body.where,
    dataset.dateColumn ? `${dataset.dateColumn} DESC` : ":id",
    offset,
    limit
  );
  const normalized = normalizeRows(rows, dataset.id, body.replacements || {}, dataset.dateColumn);

  return jsonResponse({
    datasetId: dataset.id,
    planIndex: Number(body.planIndex || 0),
    offset,
    returnedRows: normalized.length,
    rows: normalized,
  });
}

async function handleExport(request, env) {
  return jsonResponse({
    error: "La exportacion sincronica fue deshabilitada. Usa /api/jobs para exportaciones comprimidas, asincronas y con limpieza R2.",
  }, 410);
}

function sanitizeRequestedFormats(formats) {
  const requested = Array.isArray(formats) ? formats.filter(Boolean) : [];
  const normalized = Array.from(new Set(requested.map((value) => String(value).toLowerCase())));
  const effective = normalized.filter((value) => value === "csv" || value === "json" || value === "parquet");
  const warnings = [];

  if (!effective.length) {
    effective.push("csv");
    if (normalized.length) {
      warnings.push("Se agrego CSV como formato de respaldo para garantizar una descarga util.");
    }
  }

  return { requested: normalized, effective, warnings };
}

async function rowsToParquet(rows) {
  const columns = rows.length ? getRowColumns(rows) : ["sin_datos"];
  const schemaDefinition = {};

  columns.forEach((column) => {
    const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined);
    const isBoolean = values.length > 0 && values.every((value) => typeof value === "boolean");
    const isNumber = values.length > 0 && values.every((value) => typeof value === "number" && Number.isFinite(value));
    schemaDefinition[column] = {
      type: isBoolean ? "BOOLEAN" : isNumber ? "DOUBLE" : "UTF8",
      optional: true,
      compression: "UNCOMPRESSED",
    };
  });

  const chunks = [];
  const sink = {
    write(buffer, callback) {
      chunks.push(Buffer.from(buffer));
      if (callback) callback();
    },
    end(callback) {
      if (callback) callback();
    },
  };
  const schema = new ParquetSchema(schemaDefinition);
  const writer = await ParquetWriter.openStream(schema, sink, { rowGroupSize: 5000 });

  for (const row of rows) {
    const parquetRow = {};
    columns.forEach((column) => {
      const value = row[column];
      if (value === null || value === undefined) return;
      if (schemaDefinition[column].type === "UTF8" && typeof value !== "string") {
        parquetRow[column] = typeof value === "object" ? JSON.stringify(value) : String(value);
      } else {
        parquetRow[column] = value;
      }
    });
    await writer.appendRow(parquetRow);
  }

  await writer.close();
  return Buffer.concat(chunks);
}

function buildJobPartBaseName(fileStem, partIndex) {
  return `${fileStem}_part_${String(partIndex).padStart(4, "0")}`;
}

function createAccumulatorState() {
  return {
    stationCodes: [],
    municipalities: [],
    departments: [],
    zones: [],
    observedStart: null,
    observedEnd: null,
  };
}

function mergeAccumulatorState(state, rows, dateColumn) {
  const stationCodes = new Set(state.stationCodes || []);
  const municipalities = new Set(state.municipalities || []);
  const departments = new Set(state.departments || []);
  const zones = new Set(state.zones || []);
  let observedStart = state.observedStart || null;
  let observedEnd = state.observedEnd || null;

  rows.forEach((row) => {
    if (row.codigoestacion) stationCodes.add(String(row.codigoestacion));
    if (row.municipio) municipalities.add(String(row.municipio));
    if (row.departamento) departments.add(String(row.departamento));
    if (row.zonahidrografica) zones.add(String(row.zonahidrografica));
    if (dateColumn && row[dateColumn]) {
      const parsed = parseDate(row[dateColumn]);
      if (parsed) {
        const iso = parsed.toISOString();
        observedStart = observedStart ? (iso < observedStart ? iso : observedStart) : iso;
        observedEnd = observedEnd ? (iso > observedEnd ? iso : observedEnd) : iso;
      }
    }
  });

  return {
    stationCodes: Array.from(stationCodes),
    municipalities: Array.from(municipalities),
    departments: Array.from(departments),
    zones: Array.from(zones),
    observedStart,
    observedEnd,
  };
}

function finalizeAccumulatorState(state, rowCount) {
  return {
    rowCount,
    stationCount: (state.stationCodes || []).length,
    municipalityCount: (state.municipalities || []).length,
    departmentCount: (state.departments || []).length,
    zoneCount: (state.zones || []).length,
    observedStart: state.observedStart || "",
    observedEnd: state.observedEnd || "",
  };
}

async function createArchivePart(rows, formats, baseName, metadata) {
  const zip = new JSZip();
  const manifest = {
    ...metadata,
    generatedFormats: [],
    warnings: Array.from(new Set(metadata?.warnings || [])),
  };

  if (formats.includes("csv")) {
    zip.file(`${baseName}.csv`, rowsToCsv(rows));
    manifest.generatedFormats.push("csv");
  }

  if (formats.includes("json")) {
    zip.file(`${baseName}.json`, JSON.stringify(rows, null, 2));
    manifest.generatedFormats.push("json");
  }

  if (formats.includes("parquet")) {
    try {
      zip.file(`${baseName}.parquet`, await rowsToParquet(rows));
      manifest.generatedFormats.push("parquet");
    } catch (error) {
      manifest.warnings.push(`No fue posible generar Parquet en este lote: ${error?.message || "error desconocido"}.`);
      if (!formats.includes("csv")) {
        zip.file(`${baseName}.csv`, rowsToCsv(rows));
        manifest.generatedFormats.push("csv");
      }
    }
  }

  zip.file(`${baseName}_manifest.json`, JSON.stringify(manifest, null, 2));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function buildJobResponse(job) {
  return {
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    updatedAt: job.updatedAt,
    datasetId: job.datasetId,
    datasetName: job.datasetName,
    fileStem: job.fileStem,
    warnings: job.warnings || [],
    error: job.error || null,
    selectedFormats: job.selectedFormats || [],
    effectiveFormats: job.effectiveFormats || [],
    rowCount: job.plan?.rowCount || 0,
    totalPages: job.plan?.totalPages || 0,
    completedPages: job.completedPages || 0,
    processedRows: job.processedRows || 0,
    queryPlans: job.plan?.queryPlans || 0,
    stationPoolSize: job.plan?.stationPoolSize || 0,
    parts: job.parts || [],
    metrics: job.metrics || null,
  };
}

async function loadJobFromStorage(storage) {
  return (await storage.get("job")) || null;
}

async function saveJobToStorage(storage, job) {
  job.updatedAt = new Date().toISOString();
  await storage.put("job", job);
}

function getNextPageDescriptor(job) {
  const planPages = job.plan?.planPages || [];
  const planCursor = job.planCursor || { planIndex: 0, pageIndex: 0 };

  while (planCursor.planIndex < planPages.length) {
    const planPage = planPages[planCursor.planIndex];
    if (planCursor.pageIndex < planPage.pageCount) {
      return {
        planIndex: planCursor.planIndex,
        pageIndex: planCursor.pageIndex,
        offset: planCursor.pageIndex * job.plan.pageSize,
        where: planPage.where,
        rowCount: planPage.rowCount,
      };
    }
    planCursor.planIndex += 1;
    planCursor.pageIndex = 0;
  }

  return null;
}

function advanceJobCursor(job) {
  const planPages = job.plan?.planPages || [];
  job.planCursor = job.planCursor || { planIndex: 0, pageIndex: 0 };
  job.planCursor.pageIndex += 1;
  while (job.planCursor.planIndex < planPages.length && job.planCursor.pageIndex >= planPages[job.planCursor.planIndex].pageCount) {
    job.planCursor.planIndex += 1;
    job.planCursor.pageIndex = 0;
  }
}

async function planExportJob(env, job) {
  const config = getConfig(env);
  const dataset = resolveDataset(job.datasetId);
  if (!dataset) {
    throw new Error("Dataset no soportado para el job de exportacion.");
  }

  const plan = await buildExportPlan(config, job.payload, dataset);
  job.status = plan.rowCount ? "processing" : "completed";
  job.startedAt = job.startedAt || new Date().toISOString();
  job.datasetName = dataset.name;
  job.dateColumn = dataset.dateColumn || "fechaobservacion";
  job.fileStem = plan.fileStem;
  job.plan = plan;
  job.completedPages = 0;
  job.processedRows = 0;
  job.parts = [];
  job.summaryState = createAccumulatorState();
  job.planCursor = { planIndex: 0, pageIndex: 0 };

  if (!plan.rowCount) {
    if (!env.EXPORTS_BUCKET) {
      throw new Error("EXPORTS_BUCKET no esta configurado en Cloudflare. Configura el bucket R2 antes de usar exportaciones asincronas.");
    }

    const baseName = `${job.fileStem}_sin_datos`;
    const archiveBuffer = await createArchivePart([], job.effectiveFormats, baseName, {
      jobId: job.id,
      datasetId: dataset.id,
      datasetName: dataset.name,
      rowCount: 0,
      formats: job.effectiveFormats,
      requestedFormats: job.selectedFormats,
      warnings: job.warnings || [],
      message: "La consulta no encontro filas para los filtros seleccionados.",
    });
    const key = `exports/${job.id}/${baseName}.zip`;
    await env.EXPORTS_BUCKET.put(key, archiveBuffer, {
      httpMetadata: {
        contentType: "application/zip",
        cacheControl: "no-store",
        contentDisposition: `attachment; filename="${baseName}.zip"`,
      },
      customMetadata: {
        jobId: job.id,
        expiresAt: new Date(Date.now() + EXPORT_OBJECT_TTL_SECONDS * 1000).toISOString(),
      },
    });

    const summary = finalizeAccumulatorState(job.summaryState, 0);
    job.parts = [{
      index: 1,
      key,
      fileName: `${baseName}.zip`,
      rowCount: 0,
      sizeBytes: archiveBuffer.byteLength,
      formats: job.effectiveFormats,
      downloadPath: `/api/jobs/${job.id}/parts/1`,
    }];
    job.metrics = {
      fileName: `${baseName}.zip`,
      rowCount: 0,
      stationCount: summary.stationCount,
      municipalityCount: summary.municipalityCount,
      departmentCount: summary.departmentCount,
      zoneCount: summary.zoneCount,
      processingMs: 0,
      sizeBytes: archiveBuffer.byteLength,
      observedStart: summary.observedStart,
      observedEnd: summary.observedEnd,
      queryPlans: plan.queryPlans,
      stationPoolSize: plan.stationPoolSize,
      archivePartCount: 1,
      downloadedPages: 0,
    };
    job.finishedAt = new Date().toISOString();
  }
}

async function processExportJobBatch(env, job) {
  if (!env.EXPORTS_BUCKET) {
    throw new Error("EXPORTS_BUCKET no esta configurado en Cloudflare. Configura el bucket R2 antes de usar exportaciones asincronas.");
  }

  const config = getConfig(env);
  const dataset = resolveDataset(job.datasetId);
  if (!dataset) {
    throw new Error("Dataset no soportado para procesamiento asincrono.");
  }

  let processedAnyPage = false;

  for (let batchIndex = 0; batchIndex < ASYNC_EXPORT_PAGE_BATCH; batchIndex += 1) {
    const descriptor = getNextPageDescriptor(job);
    if (!descriptor) break;

    const rows = await fetchPlanPage(
      config,
      dataset.id,
      descriptor.where,
      dataset.dateColumn ? `${dataset.dateColumn} DESC` : ":id",
      descriptor.offset,
      job.plan.pageSize
    );
    const normalized = normalizeRows(rows, dataset.id, job.plan.replacements || {}, dataset.dateColumn);
    const partIndex = (job.parts || []).length + 1;
    const baseName = buildJobPartBaseName(job.fileStem, partIndex);
    const archiveBuffer = await createArchivePart(normalized, job.effectiveFormats, baseName, {
      jobId: job.id,
      datasetId: dataset.id,
      datasetName: dataset.name,
      partIndex,
      pageIndex: descriptor.pageIndex + 1,
      planIndex: descriptor.planIndex + 1,
      rowCount: normalized.length,
      formats: job.effectiveFormats,
      requestedFormats: job.selectedFormats,
      warnings: job.warnings || [],
    });
    const key = `exports/${job.id}/${baseName}.zip`;
    await env.EXPORTS_BUCKET.put(key, archiveBuffer, {
      httpMetadata: {
        contentType: "application/zip",
        cacheControl: "no-store",
        contentDisposition: `attachment; filename="${baseName}.zip"`,
      },
      customMetadata: {
        jobId: job.id,
        expiresAt: new Date(Date.now() + EXPORT_OBJECT_TTL_SECONDS * 1000).toISOString(),
      },
    });

    job.summaryState = mergeAccumulatorState(job.summaryState, normalized, dataset.dateColumn);
    job.processedRows += normalized.length;
    job.completedPages += 1;
    job.parts.push({
      index: partIndex,
      key,
      fileName: `${baseName}.zip`,
      rowCount: normalized.length,
      sizeBytes: archiveBuffer.byteLength,
      formats: job.effectiveFormats,
      downloadPath: `/api/jobs/${job.id}/parts/${partIndex}`,
    });

    advanceJobCursor(job);
    processedAnyPage = true;
  }

  if (!processedAnyPage || job.completedPages >= (job.plan?.totalPages || 0)) {
    const summary = finalizeAccumulatorState(job.summaryState, job.processedRows || 0);
    const startedAt = job.startedAt ? new Date(job.startedAt).valueOf() : Date.now();
    job.status = "completed";
    job.finishedAt = new Date().toISOString();
    job.metrics = {
      fileName: `${job.fileStem}_partes`,
      rowCount: summary.rowCount,
      stationCount: summary.stationCount,
      municipalityCount: summary.municipalityCount,
      departmentCount: summary.departmentCount,
      zoneCount: summary.zoneCount,
      processingMs: Math.max(0, new Date(job.finishedAt).valueOf() - startedAt),
      sizeBytes: (job.parts || []).reduce((sum, part) => sum + Number(part.sizeBytes || 0), 0),
      observedStart: summary.observedStart,
      observedEnd: summary.observedEnd,
      queryPlans: job.plan?.queryPlans || 0,
      stationPoolSize: job.plan?.stationPoolSize || 0,
      archivePartCount: (job.parts || []).length,
      downloadedPages: job.completedPages || 0,
    };
  }
}

function getClientIp(request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || "unknown";
}

class ExportRateLimitDurableObject {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/check" || request.method !== "POST") {
      return jsonResponse({ error: "Ruta interna de rate limit no encontrada." }, 404);
    }

    const now = Date.now();
    const record = (await this.state.storage.get("rate")) || {
      windowStart: now,
      count: 0,
    };
    const elapsed = now - Number(record.windowStart || 0);
    const current = elapsed >= EXPORT_RATE_WINDOW_MS
      ? { windowStart: now, count: 0 }
      : { windowStart: Number(record.windowStart || now), count: Number(record.count || 0) };

    if (current.count >= EXPORT_RATE_LIMIT) {
      const retryAfterSeconds = Math.max(1, Math.ceil((EXPORT_RATE_WINDOW_MS - (now - current.windowStart)) / 1000));
      return jsonResponse(
        {
          error: `Limite de exportaciones alcanzado. Intenta de nuevo en ${Math.ceil(retryAfterSeconds / 60)} minuto(s).`,
          limit: EXPORT_RATE_LIMIT,
          retryAfterSeconds,
        },
        429,
        { "retry-after": String(retryAfterSeconds) }
      );
    }

    current.count += 1;
    await this.state.storage.put("rate", current);

    return jsonResponse({
      ok: true,
      limit: EXPORT_RATE_LIMIT,
      remaining: Math.max(0, EXPORT_RATE_LIMIT - current.count),
      resetAt: new Date(current.windowStart + EXPORT_RATE_WINDOW_MS).toISOString(),
    });
  }
}

class ExportJobDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/create" && request.method === "POST") {
      const body = await request.json();
      const payload = body.payload || {};
      const dataset = resolveDataset(payload.datasetId);
      if (!dataset) {
        return jsonResponse({ error: "Dataset no soportado en la exportacion asincrona." }, 400);
      }
      const departmentState = validateRequiredDepartments(payload);
      if (!departmentState.ok) {
        return jsonResponse({ error: departmentState.error }, 400);
      }
      payload.departments = departmentState.departments;

      const formatState = sanitizeRequestedFormats(body.formats || payload.formats || []);
      const now = new Date().toISOString();
      const job = {
        id: body.jobId,
        status: "queued",
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        finishedAt: null,
        datasetId: dataset.id,
        datasetName: dataset.name,
        payload,
        selectedFormats: formatState.requested,
        effectiveFormats: formatState.effective,
        warnings: formatState.warnings,
        error: null,
        fileStem: null,
        plan: null,
        completedPages: 0,
        processedRows: 0,
        parts: [],
        summaryState: createAccumulatorState(),
        planCursor: { planIndex: 0, pageIndex: 0 },
        metrics: null,
      };
      await saveJobToStorage(this.state.storage, job);
      try {
        await runJobStep(this.env, job);
      } catch (error) {
        job.status = "failed";
        job.error = error?.message || "Fallo interno iniciando el job de exportacion.";
        job.finishedAt = new Date().toISOString();
      }
      await saveJobToStorage(this.state.storage, job);
      if (job.status !== "completed" && job.status !== "failed") {
        await this.state.storage.setAlarm(Date.now() + 50);
      }
      return jsonResponse(buildJobResponse(job), job.status === "completed" ? 200 : 202);
    }

    const job = await loadJobFromStorage(this.state.storage);
    if (!job) {
      return jsonResponse({ error: "Job no encontrado." }, 404);
    }

    if (url.pathname === "/status" && request.method === "GET") {
      return jsonResponse(buildJobResponse(job));
    }

    if (url.pathname === "/manifest" && request.method === "GET") {
      return jsonResponse({
        ...buildJobResponse(job),
        parts: (job.parts || []).map((part) => ({
          ...part,
          absoluteUrl: part.downloadPath,
        })),
      });
    }

    if (url.pathname.startsWith("/parts/") && (request.method === "GET" || request.method === "DELETE")) {
      const partIndex = Number(url.pathname.split("/").pop());
      const part = (job.parts || []).find((item) => item.index === partIndex);
      if (!part) {
        return jsonResponse({ error: "Parte de descarga no encontrada." }, 404);
      }

      if (request.method === "DELETE") {
        if (!part.deletedAt) {
          await this.env.EXPORTS_BUCKET.delete(part.key);
          part.deletedAt = new Date().toISOString();
          await saveJobToStorage(this.state.storage, job);
        }
        return jsonResponse({ ok: true, deleted: true, partIndex, deletedAt: part.deletedAt });
      }

      if (part.deletedAt) {
        return jsonResponse({ error: "Archivo ya eliminado despues de la descarga." }, 410);
      }

      const object = await this.env.EXPORTS_BUCKET.get(part.key);
      if (!object) {
        return jsonResponse({ error: "Archivo de salida no disponible en R2." }, 404);
      }
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType || "application/zip",
          "content-disposition": `attachment; filename="${part.fileName}"`,
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
      });
    }

    return jsonResponse({ error: "Ruta interna de job no encontrada." }, 404);
  }

  async alarm() {
    const job = await loadJobFromStorage(this.state.storage);
    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }

    try {
      await runJobStep(this.env, job);
    } catch (error) {
      job.status = "failed";
      job.error = error?.message || "Fallo interno procesando el job de exportacion.";
      job.finishedAt = new Date().toISOString();
    }

    await saveJobToStorage(this.state.storage, job);

    if (job.status !== "completed" && job.status !== "failed") {
      await this.state.storage.setAlarm(Date.now() + 250);
    }
  }
}

async function runJobStep(env, job) {
  if (!job.plan) {
    job.status = "planning";
    await planExportJob(env, job);
  }

  if (job.status !== "completed" && job.status !== "failed") {
    job.status = "processing";
    await processExportJobBatch(env, job);
  }
}

async function handleCreateJob(request, env) {
  if (!env.EXPORT_JOBS) {
    return jsonResponse({ error: "EXPORT_JOBS no esta configurado en Cloudflare." }, 500);
  }

  const body = await request.json();
  const departmentState = validateRequiredDepartments(body);
  if (!departmentState.ok) {
    return jsonResponse({ error: departmentState.error }, 400);
  }
  body.departments = departmentState.departments;

  const rateLimitResponse = await checkExportRateLimit(request, env);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const jobId = crypto.randomUUID();
  const stub = env.EXPORT_JOBS.get(env.EXPORT_JOBS.idFromName(jobId));
  return stub.fetch(
    new Request("https://export-job/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId, payload: body, formats: body.formats || [] }),
    })
  );
}

async function checkExportRateLimit(request, env) {
  if (!env.EXPORT_RATE_LIMITER) {
    return null;
  }

  const clientIp = getClientIp(request);
  const id = env.EXPORT_RATE_LIMITER.idFromName(`export:${clientIp}`);
  const stub = env.EXPORT_RATE_LIMITER.get(id);
  const response = await stub.fetch(
    new Request("https://export-rate-limit/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientIp }),
    })
  );

  return response.status === 429 ? response : null;
}

async function handleJobProxy(request, env, jobId, action, extra = null) {
  if (!env.EXPORT_JOBS) {
    return jsonResponse({ error: "EXPORT_JOBS no esta configurado en Cloudflare." }, 500);
  }

  const stub = env.EXPORT_JOBS.get(env.EXPORT_JOBS.idFromName(jobId));
  const suffix = action === "status" ? "/status" : action === "manifest" ? "/manifest" : `/parts/${extra}`;
  return stub.fetch(new Request(`https://export-job${suffix}`, { method: request.method }));
}

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "ideam-web-app" });
    }
    if (url.pathname === "/api/meta" && request.method === "GET") {
      return handleMeta(env);
    }
    if (url.pathname === "/api/date-range" && request.method === "GET") {
      return handleDateRange(request, env);
    }
    if (url.pathname === "/api/municipalities" && request.method === "GET") {
      return handleMunicipalities(request, env);
    }
    if (url.pathname === "/api/catalog-options" && request.method === "POST") {
      return handleCatalogOptions(request, env);
    }
    if (url.pathname === "/api/stations-helper" && request.method === "POST") {
      return handleStationHelper(request, env);
    }
    if (url.pathname === "/api/coverage" && request.method === "POST") {
      return handleCoverage(request, env);
    }
    if (url.pathname === "/api/preview" && request.method === "POST") {
      return handlePreview(request, env);
    }
    if (url.pathname === "/api/export-plan" && request.method === "POST") {
      return handleExportPlan(request, env);
    }
    if (url.pathname === "/api/export-page" && request.method === "POST") {
      return handleExportPage(request, env);
    }
    if (url.pathname === "/api/export" && request.method === "POST") {
      return handleExport(request, env);
    }
    if (url.pathname === "/api/jobs" && request.method === "POST") {
      return handleCreateJob(request, env, ctx);
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)(?:\/(manifest|parts)(?:\/([^/]+))?)?$/);
    if (jobMatch && (request.method === "GET" || request.method === "DELETE")) {
      const [, jobId, action, extra] = jobMatch;
      return handleJobProxy(request, env, jobId, action || "status", extra);
    }
    return jsonResponse({ error: "Ruta API no encontrada." }, 404);
  } catch (error) {
    return jsonResponse({ error: error.message || "Error interno del Worker." }, error.status || 500);
  }
}

export {
  buildDepartmentFilter,
  buildQueryPlans,
  classifyCoverageRows,
  departmentVariants,
  expandStationCodes,
  getConfig,
  handleExportPlan,
  normalizeLabel,
  rowsToCsv,
  sanitizeRequestedFormats,
  buildJobPartBaseName,
  createArchivePart,
  ExportJobDurableObject,
  ExportRateLimitDurableObject,
  validateRequiredDepartments,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
