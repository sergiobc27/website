const DEFAULT_CONFIG = {
  socrataDomain: "https://www.datos.gov.co",
  catalogDatasetId: "hp9r-jxuu",
  pageLimit: 50000,
  previewLimit: 200,
  exportPageSize: 50000,
  maxCatalogStations: null,
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
  { key: "hydrologicZones", label: "Zona Hidrografica", column: "zona_hidrografica" },
  { key: "categories", label: "Categoria", column: "categoria" },
  { key: "technologies", label: "Tecnologia", column: "tecnologia" },
  { key: "states", label: "Estado", column: "estado" },
  { key: "currents", label: "Corriente", column: "corriente" },
  { key: "entities", label: "Entidad", column: "entidad" },
  { key: "municipalities", label: "Municipio", column: "municipio" },
];

function getConfig(env) {
  return {
    socrataDomain: env?.SOCRATA_DOMAIN || DEFAULT_CONFIG.socrataDomain,
    catalogDatasetId: env?.CATALOG_DATASET_ID || DEFAULT_CONFIG.catalogDatasetId,
    pageLimit: Number(env?.PAGE_LIMIT || DEFAULT_CONFIG.pageLimit),
    previewLimit: Number(env?.PREVIEW_LIMIT || DEFAULT_CONFIG.previewLimit),
    exportPageSize: Number(env?.EXPORT_PAGE_SIZE || DEFAULT_CONFIG.exportPageSize),
    maxCatalogStations: env?.MAX_CATALOG_STATIONS ? Number(env.MAX_CATALOG_STATIONS) : DEFAULT_CONFIG.maxCatalogStations,
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

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function uniqueSorted(values, locale = "es") {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), locale));
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

function buildCatalogWhere(payload, excludeKey = null) {
  const filters = [];
  const departments = asArray(payload.departments ?? payload.department);

  if (departments.length) {
    const department = buildDepartmentFilter(departments, "departamento");
    if (department.filter) filters.push(department.filter);
  }

  const catalogFilters = payload.catalogFilters || {};
  CATALOG_FILTERS.forEach((definition) => {
    if (definition.key === excludeKey) return;
    const values = asArray(catalogFilters[definition.key]);
    if (values.length) {
      filters.push(buildUpperInFilter(values, definition.column));
    }
  });

  return filters.filter(Boolean).join(" AND ") || null;
}

async function resolveStationPool(config, payload) {
  const manualCodes = expandStationCodes(payload.stationCodes || payload.stationCode);
  const catalogWhere = buildCatalogWhere(payload);
  if (!catalogWhere) {
    return manualCodes.length ? uniqueSorted(manualCodes) : null;
  }
  const catalogRows = await fetchAllRows(
    config,
    config.catalogDatasetId,
    catalogWhere,
    "codigo",
    config.maxCatalogStations ?? Number.POSITIVE_INFINITY,
    { "$select": "codigo" }
  );
  const combined = new Set(manualCodes);
  catalogRows.forEach((row) => {
    expandStationCodes(row.codigo).forEach((code) => combined.add(code));
  });
  return uniqueSorted(Array.from(combined));
}

async function buildQueryPlans(config, payload, dataset) {
  const filters = [];
  const replacements = {};
  const departments = asArray(payload.departments ?? payload.department);

  if (departments.length) {
    const department = buildDepartmentFilter(departments, "departamento");
    if (department.filter) filters.push(department.filter);
    Object.assign(replacements, department.replacements);
  }

  const outputMunicipalities = asArray(payload.outputMunicipalities ?? payload.municipality);
  if (outputMunicipalities.length) {
    filters.push(buildUpperInFilter(outputMunicipalities, "municipio"));
  }

  buildDateFilters(dataset, payload.startDate, payload.endDate).forEach((filter) => filters.push(filter));

  const stationPool = await resolveStationPool(config, payload);
  if (stationPool === null) {
    return {
      plans: [{ where: filters.filter(Boolean).join(" AND ") || null }],
      replacements,
      stationPoolSize: 0,
    };
  }

  if (!stationPool.length) {
    return {
      plans: [],
      replacements,
      stationPoolSize: 0,
    };
  }

  return {
    plans: chunkArray(stationPool, 400).map((chunk) => ({
      where: filters.concat([buildExactInFilter(chunk, "codigoestacion")]).filter(Boolean).join(" AND "),
    })),
    replacements,
    stationPoolSize: stationPool.length,
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
  const definition = resolveCatalogFilter(payload.attributeKey);
  if (!definition) {
    return jsonResponse({ error: "Filtro de catalogo no soportado." }, 400);
  }

  const where = buildCatalogWhere(payload, definition.key);
  const rows = await socrataGet(config, config.catalogDatasetId, {
    "$select": `${definition.column}, count(*) as total`,
    "$where": where,
    "$group": definition.column,
    "$order": definition.column,
    "$limit": 5000,
  });

  return jsonResponse({
    attributeKey: definition.key,
    options: rows
      .map((row) => ({ value: row[definition.column], total: Number(row.total || 0) }))
      .filter((row) => row.value),
  });
}

async function handleStationHelper(request, env) {
  const config = getConfig(env);
  const payload = await request.json();
  const where = buildCatalogWhere(payload);
  const rows = await socrataGet(config, config.catalogDatasetId, {
    "$select": "codigo, nombre, departamento, municipio, zona_hidrografica, entidad",
    "$where": where,
    "$order": "nombre",
    "$limit": 500,
  });

  return jsonResponse({
    stations: rows.map((row) => ({
      code: row.codigo || "",
      name: row.nombre || "",
      department: row.departamento || "",
      municipality: row.municipio || "",
      zone: row.zona_hidrografica || "",
      entity: row.entidad || "",
    })),
  });
}

async function handleCoverage(request, env) {
  const config = getConfig(env);
  const payload = await request.json();
  const datasetId = payload.datasetId;
  const departments = asArray(payload.departments ?? payload.department);

  if (!datasetId || !departments.length) {
    return jsonResponse({ error: "datasetId y departments son requeridos." }, 400);
  }

  const reports = [];

  for (const department of departments) {
    const variants = departmentVariants(department);
    const configured = variants.map((value) => normalizeLabel(value));
    const matched = Array.from(new Set(variants)).map((variant) => ({
      departamento: variant,
      normalized: normalizeLabel(variant),
      total: 1,
    }));

    reports.push({
      department,
      configured_variants: Array.from(new Set(configured)).sort(),
      matched,
      unmatched_discovered: [],
      matched_rows: matched.reduce((sum, row) => sum + row.total, 0),
      unmatched_rows: 0,
    });
  }

  return jsonResponse({
    datasetId,
    reports,
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
  const config = getConfig(env);
  const { payload, dataset } = await parsePayload(request);
  const plan = await buildExportPlan(config, payload, dataset);

  if (!plan.rowCount) {
    return jsonResponse({ error: "La consulta no contiene datos para descargar." }, 404);
  }

  const rows = [];
  for (const entry of plan.planPages) {
    const pageRows = await fetchAllRows(
      config,
      dataset.id,
      entry.where,
      dataset.dateColumn ? `${dataset.dateColumn} DESC` : ":id"
    );
    rows.push(...pageRows);
  }

  const normalized = normalizeRows(rows, dataset.id, plan.replacements, dataset.dateColumn);
  const summary = summarizeRows(normalized, dataset);
  const format = (payload.format || "csv").toLowerCase();
  const body = format === "json" ? JSON.stringify(normalized, null, 2) : rowsToCsv(normalized);
  const mimeType = format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8";
  const extension = format === "json" ? "json" : "csv";
  const fileName = `${plan.fileStem}.${extension}`;
  const byteSize = new TextEncoder().encode(body).length;

  return new Response(body, {
    headers: {
      "content-type": mimeType,
      "content-disposition": `attachment; filename="${fileName}"`,
      "x-export-name": fileName,
      "x-row-count": String(summary.rowCount),
      "x-station-count": String(summary.stationCount),
      "x-municipality-count": String(summary.municipalityCount),
      "x-department-count": String(summary.departmentCount),
      "x-zone-count": String(summary.zoneCount),
      "x-observed-start": summary.observedStart || "",
      "x-observed-end": summary.observedEnd || "",
      "x-size-bytes": String(byteSize),
      "x-station-pool-size": String(plan.stationPoolSize),
      "x-query-plans": String(plan.queryPlans),
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
