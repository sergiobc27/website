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
const SOCRATA_TIMEOUT_MS = 30000;
const CATALOG_CACHE_TTL_SECONDS = 24 * 60 * 60;
const CATALOG_WARM_LIMIT = 500;
const CATALOG_CACHE_VERSION = "v2";
const CATALOG_CACHE_PREFIX = "catalog-cache/options";
const CATALOG_BUNDLE_PREFIX = "catalog-cache/bundles";
const CATALOG_WARM_STATE_KEY = "catalog-cache/_warm-state.json";

const DEFAULT_CONFIG = {
  socrataDomain: "https://www.datos.gov.co",
  catalogDatasetId: "hp9r-jxuu",
  pageLimit: 50000,
  previewLimit: 200,
  exportPageSize: 50000,
  maxExportRows: null,
  maxCatalogStations: null,
  catalogCacheTtlSeconds: CATALOG_CACHE_TTL_SECONDS,
  catalogWarmLimit: CATALOG_WARM_LIMIT,
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
    socrataAppToken: env?.SOCRATA_APP_TOKEN || env?.SODA_APP_TOKEN || "",
    socrataTimeoutMs: positiveNumber(env?.SOCRATA_TIMEOUT_MS, SOCRATA_TIMEOUT_MS),
    catalogCacheTtlSeconds: positiveNumber(env?.CATALOG_CACHE_TTL_SECONDS, DEFAULT_CONFIG.catalogCacheTtlSeconds),
    catalogWarmLimit: positiveNumber(env?.CATALOG_WARM_LIMIT, DEFAULT_CONFIG.catalogWarmLimit),
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

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encodeUtf8(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedCatalogCachePayload(payload) {
  const catalogFilters = {};
  Object.entries(payload.catalogFilters || {}).forEach(([key, values]) => {
    if (key === payload.attributeKey) return;
    const normalized = uniqueSorted(asArray(values).map((value) => String(value)));
    if (normalized.length) catalogFilters[key] = normalized;
  });

  return {
    version: CATALOG_CACHE_VERSION,
    datasetId: payload.datasetId || "",
    attributeKey: payload.attributeKey || "",
    departments: uniqueSorted(asArray(payload.departments ?? payload.department).map((value) => String(value))),
    startDate: payload.startDate || "",
    endDate: payload.endDate || "",
    catalogFilters,
  };
}

function normalizedCatalogBundlePayload(payload) {
  return {
    version: CATALOG_CACHE_VERSION,
    datasetId: payload.datasetId || "",
    departments: uniqueSorted(asArray(payload.departments ?? payload.department).map((value) => String(value))),
  };
}

async function catalogCacheHash(payload) {
  return sha256Hex(canonicalJson(normalizedCatalogCachePayload(payload)));
}

async function catalogBundleHash(payload) {
  return sha256Hex(canonicalJson(normalizedCatalogBundlePayload(payload)));
}

async function catalogCacheRequest(payload) {
  const key = await catalogCacheHash(payload);
  return new Request(`https://ideam.local/cache/catalog-options/${key}`, { method: "GET" });
}

async function catalogCacheObjectKey(payload) {
  const normalized = normalizedCatalogCachePayload(payload);
  const key = await catalogCacheHash(normalized);
  const datasetPart = fileSafePart(normalized.datasetId, "dataset");
  const attributePart = fileSafePart(normalized.attributeKey, "filter");
  return `${CATALOG_CACHE_PREFIX}/${datasetPart}/${attributePart}/${key}.json`;
}

async function catalogBundleObjectKey(payload) {
  const normalized = normalizedCatalogBundlePayload(payload);
  const key = await catalogBundleHash(normalized);
  const datasetPart = fileSafePart(normalized.datasetId, "dataset");
  return `${CATALOG_BUNDLE_PREFIX}/${datasetPart}/${key}.json`;
}

async function fromCatalogCache(payload) {
  if (typeof caches === "undefined" || !caches.default) return null;
  const cacheRequest = await catalogCacheRequest(payload);
  const cached = await caches.default.match(cacheRequest);
  if (!cached) return null;
  const headers = new Headers(cached.headers);
  headers.set("x-ideam-cache", "HIT");
  return new Response(cached.body, { status: cached.status, headers });
}

async function fromCatalogObjectCache(env, payload, ttlSeconds) {
  if (!env?.EXPORTS_BUCKET || ttlSeconds <= 0) return null;
  const objectKey = await catalogCacheObjectKey(payload);
  const object = await env.EXPORTS_BUCKET.get(objectKey);
  if (!object) return null;
  const expiresAt = object.customMetadata?.expiresAt;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return null;

  const data = await object.json();
  return jsonResponse({ ...data, cacheTtlSeconds: ttlSeconds }, 200, {
    "cache-control": `public, max-age=${ttlSeconds}`,
    "x-ideam-cache": "R2-HIT",
  });
}

async function fromCatalogBundleCache(env, payload, ttlSeconds) {
  const data = await readCatalogBundleCacheData(env, payload, ttlSeconds);
  if (!data) return null;
  return jsonResponse({ ...data, cacheTtlSeconds: ttlSeconds }, 200, {
    "cache-control": `public, max-age=${ttlSeconds}`,
    "x-ideam-cache": "R2-HIT",
  });
}

async function readCatalogBundleCacheData(env, payload, ttlSeconds) {
  if (!env?.EXPORTS_BUCKET || ttlSeconds <= 0) return null;
  const objectKey = await catalogBundleObjectKey(payload);
  const object = await env.EXPORTS_BUCKET.get(objectKey);
  if (!object) return null;
  const expiresAt = object.customMetadata?.expiresAt;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return null;

  return object.json();
}

async function storeCatalogCache(payload, response, ttlSeconds, ctx) {
  if (typeof caches === "undefined" || !caches.default || !response.ok || ttlSeconds <= 0) return;
  const cacheRequest = await catalogCacheRequest(payload);
  const write = caches.default.put(cacheRequest, response.clone()).catch(() => null);
  if (ctx?.waitUntil) {
    ctx.waitUntil(write);
  } else {
    await write;
  }
}

async function storeCatalogObjectCache(env, payload, data, ttlSeconds, ctx) {
  if (!env?.EXPORTS_BUCKET || ttlSeconds <= 0) return;
  const objectKey = await catalogCacheObjectKey(payload);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const body = JSON.stringify({ ...data, cacheTtlSeconds: ttlSeconds });
  const write = env.EXPORTS_BUCKET.put(objectKey, body, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: `public, max-age=${ttlSeconds}`,
    },
    customMetadata: {
      cacheVersion: CATALOG_CACHE_VERSION,
      datasetId: String(payload.datasetId || ""),
      attributeKey: String(payload.attributeKey || ""),
      expiresAt,
    },
  }).catch(() => null);

  if (ctx?.waitUntil) {
    ctx.waitUntil(write);
  } else {
    await write;
  }
}

async function storeCatalogBundleCache(env, payload, data, ttlSeconds, ctx) {
  if (!env?.EXPORTS_BUCKET || ttlSeconds <= 0) return;
  const objectKey = await catalogBundleObjectKey(payload);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const body = JSON.stringify({ ...data, cacheTtlSeconds: ttlSeconds });
  const write = env.EXPORTS_BUCKET.put(objectKey, body, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: `public, max-age=${ttlSeconds}`,
    },
    customMetadata: {
      cacheVersion: CATALOG_CACHE_VERSION,
      datasetId: String(payload.datasetId || ""),
      expiresAt,
    },
  }).catch(() => null);

  if (ctx?.waitUntil) {
    ctx.waitUntil(write);
  } else {
    await write;
  }
}

async function refreshCatalogObjectCache(env, payload, dataset, definition, config, ctx) {
  const refresh = buildCatalogOptionsData(config, payload, dataset, definition)
    .then((data) => storeCatalogObjectCache(env, payload, data, config.catalogCacheTtlSeconds))
    .catch(() => null);
  if (ctx?.waitUntil) {
    ctx.waitUntil(refresh);
  } else {
    await refresh;
  }
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

function dateStamp(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}${month}${date.getFullYear()}`;
}

function buildFileStem(payload, dataset) {
  return [
    fileSafePart(dataset.name, "variable").toLowerCase(),
    fileSafePart(asArray(payload.departments ?? payload.department).join("-") || "todos", "todos").toLowerCase(),
    fileSafePart(asArray(payload.outputMunicipalities ?? payload.municipality).join("-") || "todos", "todos").toLowerCase(),
    timestampStamp(),
  ].join("_");
}

function buildJobZipFileName(dataset, date = new Date()) {
  return `${fileSafePart(dataset.name, "variable").toLowerCase()}_${dateStamp(date)}.zip`;
}

function hierarchyPart(value, fallback) {
  return fileSafePart(value || fallback || "sin_dato", fallback || "sin_dato").toLowerCase();
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(`Socrata timeout after ${config.socrataTimeoutMs}ms`), config.socrataTimeoutMs);
    try {
      const headers = { accept: "application/json" };
      if (config.socrataAppToken) {
        headers["X-App-Token"] = config.socrataAppToken;
      }
      const response = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
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

async function buildCatalogOptionsData(config, payload, dataset, definition) {
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

  return {
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
    cachedAt: new Date().toISOString(),
    cacheTtlSeconds: config.catalogCacheTtlSeconds,
  };
}

function catalogBundleColumns() {
  const columns = ["departamento"];
  CATALOG_FILTERS.forEach((definition) => {
    columns.push(definition.column);
    if (definition.labelColumn) columns.push(definition.labelColumn);
  });
  return Array.from(new Set(columns));
}

function catalogBundleAllDepartmentsPayload(datasetId) {
  return {
    datasetId,
    departments: Object.keys(DEPARTMENT_MAP).sort(),
  };
}

function filterCatalogBundleDataByDepartments(data, departments, ttlSeconds) {
  const selected = new Set(
    asArray(departments)
      .map((department) => canonicalDepartment(department) || String(department).trim().toUpperCase())
      .filter(Boolean)
  );
  if (!selected.size) return { ...data, cacheTtlSeconds: ttlSeconds };

  return {
    ...data,
    departments: Array.from(selected).sort(),
    rows: asArray(data.rows).filter((row) => {
      const rowDepartment = canonicalDepartment(row.departamento) || String(row.departamento || "").trim().toUpperCase();
      return selected.has(rowDepartment);
    }),
    cacheTtlSeconds: ttlSeconds,
  };
}

async function buildCatalogBundleData(config, payload, dataset) {
  const departments = asArray(payload.departments ?? payload.department);
  const where = buildDepartmentFilter(departments, "departamento").filter;
  const columns = catalogBundleColumns();
  const rows = await socrataGet(config, config.catalogDatasetId, {
    "$select": "departamento, municipio, zona_hidrografica, codigo, nombre, count(*) as total",
    "$where": where,
    "$group": "departamento, municipio, zona_hidrografica, codigo, nombre",
    "$order": "municipio, codigo",
    "$limit": 5000,
  });

  return {
    datasetId: dataset.id,
    departments: uniqueSorted(departments.map((department) => canonicalDepartment(department) || department)),
    columns,
    rows: rows.map((row) => {
      const department = canonicalDepartment(row.departamento) || normalizeLabel(row.departamento);
      return {
        departamento: department || "",
        municipio: row.municipio || "",
        zonahidrografica: row.zona_hidrografica || "",
        codigoestacion: row.codigo || "",
        nombreestacion: row.nombre || "",
        total: Number(row.total || 1),
      };
    }),
    cachedAt: new Date().toISOString(),
    cacheTtlSeconds: config.catalogCacheTtlSeconds,
  };
}

function buildCatalogWarmPayloads() {
  return DATASETS.flatMap((dataset) =>
    Object.keys(DEPARTMENT_MAP).sort().map((department) => ({
      datasetId: dataset.id,
      departments: [department],
    }))
  );
}

async function readCatalogWarmState(env) {
  if (!env?.EXPORTS_BUCKET) return { cursor: 0 };
  const object = await env.EXPORTS_BUCKET.get(CATALOG_WARM_STATE_KEY);
  if (!object) return { cursor: 0 };
  try {
    const state = await object.json();
    return { cursor: Number.isFinite(Number(state.cursor)) ? Number(state.cursor) : 0 };
  } catch {
    return { cursor: 0 };
  }
}

async function writeCatalogWarmState(env, state) {
  if (!env?.EXPORTS_BUCKET) return;
  await env.EXPORTS_BUCKET.put(CATALOG_WARM_STATE_KEY, JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString(),
  }), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function warmCatalogCache(env) {
  const config = getConfig(env);
  if (!env?.EXPORTS_BUCKET || config.catalogWarmLimit <= 0 || config.catalogCacheTtlSeconds <= 0) {
    return { warmed: 0, failed: 0, skipped: true };
  }

  const payloads = buildCatalogWarmPayloads();
  const state = await readCatalogWarmState(env);
  const start = Math.max(0, Math.min(state.cursor, Math.max(payloads.length - 1, 0)));
  const limit = Math.min(config.catalogWarmLimit, payloads.length);
  let warmed = 0;
  let failed = 0;

  for (let index = 0; index < limit; index += 1) {
    const payload = payloads[(start + index) % payloads.length];
    const dataset = resolveDataset(payload.datasetId);
    if (!dataset) continue;
    try {
      const cached = await fromCatalogBundleCache(env, payload, config.catalogCacheTtlSeconds);
      if (cached) continue;
      const data = await buildCatalogBundleData(config, payload, dataset);
      await storeCatalogBundleCache(env, payload, data, config.catalogCacheTtlSeconds);
      warmed += 1;
    } catch {
      failed += 1;
    }
  }

  const nextCursor = payloads.length ? (start + limit) % payloads.length : 0;
  await writeCatalogWarmState(env, {
    cursor: nextCursor,
    warmed,
    failed,
    totalPayloads: payloads.length,
  });
  return { warmed, failed, nextCursor, totalPayloads: payloads.length };
}

async function handleCatalogBundle(request, env, ctx) {
  const config = getConfig(env);
  const payload = await request.json();
  const dataset = resolveDataset(payload.datasetId);
  if (!dataset) {
    return jsonResponse({ error: "Dataset no soportado para catalogo." }, 400);
  }
  const departmentState = validateRequiredDepartments(payload);
  if (!departmentState.ok) {
    return jsonResponse({ error: departmentState.error }, 400);
  }
  payload.departments = departmentState.departments;

  const cached = await fromCatalogBundleCache(env, payload, config.catalogCacheTtlSeconds);
  if (cached) return cached;

  const globalPayload = catalogBundleAllDepartmentsPayload(payload.datasetId);
  const globalData = await readCatalogBundleCacheData(env, globalPayload, config.catalogCacheTtlSeconds);
  if (globalData) {
    return jsonResponse(filterCatalogBundleDataByDepartments(globalData, payload.departments, config.catalogCacheTtlSeconds), 200, {
      "cache-control": `public, max-age=${config.catalogCacheTtlSeconds}`,
      "x-ideam-cache": "R2-HIT-SUPERSET",
    });
  }

  const data = await buildCatalogBundleData(config, payload, dataset);
  const response = jsonResponse(data, 200, {
    "cache-control": `public, max-age=${config.catalogCacheTtlSeconds}`,
    "x-ideam-cache": "MISS",
  });
  await storeCatalogBundleCache(env, payload, data, config.catalogCacheTtlSeconds, ctx);
  return response;
}

async function handleCatalogOptions(request, env, ctx) {
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
  const cacheOnly = payload.cacheOnly === true;

  const cached = await fromCatalogCache(payload);
  if (cached) return cached;

  const objectCached = await fromCatalogObjectCache(env, payload, config.catalogCacheTtlSeconds);
  if (objectCached) {
    await storeCatalogCache(payload, objectCached, config.catalogCacheTtlSeconds, ctx);
    return objectCached;
  }

  if (cacheOnly) {
    await refreshCatalogObjectCache(env, payload, dataset, definition, config, ctx);
    return jsonResponse({
      attributeKey: definition.key,
      options: [],
      cachePending: true,
      cachedAt: null,
      cacheTtlSeconds: config.catalogCacheTtlSeconds,
    }, 202, {
      "cache-control": "no-store",
      "x-ideam-cache": "PENDING",
    });
  }

  const data = await buildCatalogOptionsData(config, payload, dataset, definition);
  const response = jsonResponse(data, 200, {
    "cache-control": `public, max-age=${config.catalogCacheTtlSeconds}`,
    "x-ideam-cache": "MISS",
  });
  await storeCatalogObjectCache(env, payload, data, config.catalogCacheTtlSeconds, ctx);
  await storeCatalogCache(payload, response, config.catalogCacheTtlSeconds, ctx);
  return response;
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

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value) {
  return new TextEncoder().encode(value);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function zipLocalHeader(entry, encodedName, modifiedAt) {
  const { dosTime, dosDate } = dosDateTime(modifiedAt);
  const buffer = new Uint8Array(30 + encodedName.length);
  const view = new DataView(buffer.buffer);
  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, dosTime);
  writeUint16(view, 12, dosDate);
  writeUint32(view, 14, entry.crc32);
  writeUint32(view, 18, entry.size);
  writeUint32(view, 22, entry.size);
  writeUint16(view, 26, encodedName.length);
  writeUint16(view, 28, 0);
  buffer.set(encodedName, 30);
  return buffer;
}

function zipCentralHeader(entry, encodedName, offset, modifiedAt) {
  const { dosTime, dosDate } = dosDateTime(modifiedAt);
  const buffer = new Uint8Array(46 + encodedName.length);
  const view = new DataView(buffer.buffer);
  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, dosTime);
  writeUint16(view, 14, dosDate);
  writeUint32(view, 16, entry.crc32);
  writeUint32(view, 20, entry.size);
  writeUint32(view, 24, entry.size);
  writeUint16(view, 28, encodedName.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, offset);
  buffer.set(encodedName, 46);
  return buffer;
}

function zipEndRecord(entryCount, centralSize, centralOffset) {
  const buffer = new Uint8Array(22);
  const view = new DataView(buffer.buffer);
  writeUint32(view, 0, 0x06054b50);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, centralSize);
  writeUint32(view, 16, centralOffset);
  writeUint16(view, 20, 0);
  return buffer;
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

async function createArchivePart(rows, formats, baseName) {
  const zip = new JSZip();

  if (formats.includes("csv")) {
    zip.file(`${baseName}.csv`, rowsToCsv(rows));
  }

  if (formats.includes("json")) {
    zip.file(`${baseName}.json`, JSON.stringify(rows, null, 2));
  }

  if (formats.includes("parquet")) {
    try {
      zip.file(`${baseName}.parquet`, await rowsToParquet(rows));
    } catch (error) {
      if (!formats.includes("csv")) {
        zip.file(`${baseName}.csv`, rowsToCsv(rows));
      }
    }
  }

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function groupRowsForArchive(rows, payload) {
  const groups = new Map();
  const fallbackDepartment = asArray(payload.departments ?? payload.department)[0] || "todos";
  const fallbackMunicipality = asArray(payload.catalogFilters?.municipalities ?? payload.outputMunicipalities ?? payload.municipality)[0] || "todos";

  rows.forEach((row) => {
    const department = row.departamento || fallbackDepartment;
    const municipality = row.municipio || fallbackMunicipality;
    const key = `${department}\u0000${municipality}`;
    if (!groups.has(key)) {
      groups.set(key, { department, municipality, rows: [] });
    }
    groups.get(key).rows.push(row);
  });

  return Array.from(groups.values());
}

async function buildArchiveEntryFiles(rows, formats, basePath) {
  const files = [];

  if (formats.includes("csv")) {
    files.push({ path: `${basePath}.csv`, bytes: encodeUtf8(rowsToCsv(rows)) });
  }

  if (formats.includes("json")) {
    files.push({ path: `${basePath}.json`, bytes: encodeUtf8(JSON.stringify(rows, null, 2)) });
  }

  if (formats.includes("parquet")) {
    try {
      files.push({ path: `${basePath}.parquet`, bytes: await rowsToParquet(rows) });
    } catch (error) {
      if (!formats.includes("csv")) {
        files.push({ path: `${basePath}.csv`, bytes: encodeUtf8(rowsToCsv(rows)) });
      }
    }
  }

  return files;
}

async function storeArchiveEntry(env, job, file) {
  const key = `exports/${job.id}/entries/${crypto.randomUUID()}`;
  const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
  await env.EXPORTS_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: "application/octet-stream", cacheControl: "no-store" },
    customMetadata: {
      jobId: job.id,
      temporary: "true",
      expiresAt: new Date(Date.now() + EXPORT_OBJECT_TTL_SECONDS * 1000).toISOString(),
    },
  });
  return {
    path: file.path.replace(/^\/+/, ""),
    key,
    size: bytes.byteLength,
    crc32: crc32(bytes),
  };
}

async function storeJobArchiveEntries(env, job, dataset, rows, partIndex) {
  const groups = groupRowsForArchive(rows, job.payload);
  const stored = [];

  for (const group of groups) {
    const variable = hierarchyPart(dataset.name, "variable");
    const department = hierarchyPart(group.department, "departamento");
    const municipality = hierarchyPart(group.municipality, "municipio");
    const suffix = String(partIndex).padStart(4, "0");
    const baseName = `${variable}_${department}_${municipality}_${suffix}`;
    const basePath = `${variable}/${department}/${municipality}/${baseName}`;
    const files = await buildArchiveEntryFiles(group.rows, job.effectiveFormats, basePath);

    for (const file of files) {
      stored.push(await storeArchiveEntry(env, job, file));
    }
  }

  job.archiveEntries = (job.archiveEntries || []).concat(stored);
}

function buildZipAssembly(entries, modifiedAt = new Date()) {
  const prepared = entries.map((entry) => ({
    ...entry,
    encodedName: encodeUtf8(entry.path),
  }));
  const centralRecords = [];
  let offset = 0;
  prepared.forEach((entry) => {
    entry.offset = offset;
    offset += 30 + entry.encodedName.length + entry.size;
  });
  const centralOffset = offset;
  prepared.forEach((entry) => {
    const record = zipCentralHeader(entry, entry.encodedName, entry.offset, modifiedAt);
    centralRecords.push(record);
    offset += record.byteLength;
  });
  const centralSize = offset - centralOffset;
  const endRecord = zipEndRecord(prepared.length, centralSize, centralOffset);
  const sizeBytes = offset + endRecord.byteLength;
  return { entries: prepared, centralRecords, centralOffset, centralSize, endRecord, sizeBytes };
}

function createZipReadableStream(env, assembly, modifiedAt = new Date()) {
  return new ReadableStream({
    async start(controller) {
      try {
        for (const entry of assembly.entries) {
          controller.enqueue(zipLocalHeader(entry, entry.encodedName, modifiedAt));
          if (entry.bytes) {
            controller.enqueue(entry.bytes);
            continue;
          }
          const object = await env.EXPORTS_BUCKET.get(entry.key);
          if (!object) {
            throw new Error(`Archivo temporal no disponible para ${entry.path}.`);
          }
          const reader = object.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        assembly.centralRecords.forEach((record) => controller.enqueue(record));
        controller.enqueue(assembly.endRecord);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function createFixedLengthZipReadableStream(env, assembly, modifiedAt = new Date()) {
  if (typeof FixedLengthStream !== "function") {
    return createZipReadableStream(env, assembly, modifiedAt);
  }

  const { readable, writable } = new FixedLengthStream(assembly.sizeBytes);
  createZipReadableStream(env, assembly, modifiedAt).pipeTo(writable).catch(() => null);
  return readable;
}

async function createFinalJobArchive(env, job, dataset, summary) {
  const fileName = buildJobZipFileName(dataset, job.finishedAt ? new Date(job.finishedAt) : new Date());
  const key = `exports/${job.id}/${fileName}`;
  const archiveEntries = job.archiveEntries || [];
  const modifiedAt = new Date();
  const assembly = buildZipAssembly(archiveEntries, modifiedAt);
  const expiresAt = new Date(Date.now() + EXPORT_OBJECT_TTL_SECONDS * 1000).toISOString();
  await env.EXPORTS_BUCKET.put(key, createFixedLengthZipReadableStream(env, assembly, modifiedAt), {
    httpMetadata: {
      contentType: "application/zip",
      cacheControl: "no-store",
      contentDisposition: `attachment; filename="${fileName}"`,
    },
    customMetadata: {
      jobId: job.id,
      expiresAt,
    },
  });

  await Promise.all((job.archiveEntries || []).map((entry) => env.EXPORTS_BUCKET.delete(entry.key).catch(() => null)));
  job.archiveEntries = [];
  job.parts = [{
    index: 1,
    key,
    fileName,
    rowCount: summary.rowCount,
    sizeBytes: assembly.sizeBytes,
    formats: job.effectiveFormats,
    downloadPath: `/api/jobs/${job.id}/parts/1`,
    expiresAt,
  }];
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
    rowCount: Number.isFinite(job.plan?.rowCount) ? job.plan.rowCount : (job.metrics?.rowCount ?? job.processedRows ?? 0),
    totalPages: Number.isFinite(job.plan?.totalPages)
      ? job.plan.totalPages
      : job.status === "completed"
        ? (job.completedPages || 0)
        : Math.max((job.completedPages || 0) + 1, 1),
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
    const pageCount = Number.isFinite(planPage.pageCount) ? planPage.pageCount : Infinity;
    if (planCursor.pageIndex < pageCount) {
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

function advanceJobCursor(job, planFinished = false) {
  const planPages = job.plan?.planPages || [];
  job.planCursor = job.planCursor || { planIndex: 0, pageIndex: 0 };

  const currentPlan = planPages[job.planCursor.planIndex];
  if (planFinished || !currentPlan) {
    job.planCursor.planIndex += 1;
    job.planCursor.pageIndex = 0;
    return;
  }

  job.planCursor.pageIndex += 1;
  while (
    job.planCursor.planIndex < planPages.length &&
    Number.isFinite(planPages[job.planCursor.planIndex].pageCount) &&
    job.planCursor.pageIndex >= planPages[job.planCursor.planIndex].pageCount
  ) {
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

  const built = await buildQueryPlans(config, job.payload, dataset);
  const plan = {
    dataset,
    replacements: built.replacements,
    stationPoolSize: built.stationPoolSize,
    queryPlans: built.plans.length,
    rowCount: null,
    pageSize: config.exportPageSize,
    totalPages: null,
    fileStem: buildFileStem(job.payload, dataset),
    planPages: built.plans.map((planPage, index) => ({
      planIndex: index,
      where: planPage.where,
      rowCount: null,
      pageCount: null,
    })),
  };
  job.status = "processing";
  job.startedAt = job.startedAt || new Date().toISOString();
  job.datasetName = dataset.name;
  job.dateColumn = dataset.dateColumn || "fechaobservacion";
  job.fileStem = plan.fileStem;
  job.plan = plan;
  job.completedPages = 0;
  job.processedRows = 0;
  job.parts = [];
  job.archiveEntries = [];
  job.summaryState = createAccumulatorState();
  job.planCursor = { planIndex: 0, pageIndex: 0 };
}

async function createNoDataJobArchive(env, job, dataset) {
  job.status = "completed";
  job.finishedAt = new Date().toISOString();
  const summary = finalizeAccumulatorState(job.summaryState, 0);
  const variable = hierarchyPart(dataset.name, "variable");
  const basePath = `${variable}/sin_datos/${variable}_sin_datos`;
  const files = await buildArchiveEntryFiles([], job.effectiveFormats, basePath);

  job.archiveEntries = [];
  for (const file of files) {
    job.archiveEntries.push(await storeArchiveEntry(env, job, file));
  }
  await createFinalJobArchive(env, job, dataset, summary);
  job.metrics = {
    fileName: job.parts[0]?.fileName || buildJobZipFileName(dataset),
    rowCount: 0,
    stationCount: summary.stationCount,
    municipalityCount: summary.municipalityCount,
    departmentCount: summary.departmentCount,
    zoneCount: summary.zoneCount,
    processingMs: 0,
    sizeBytes: job.parts[0]?.sizeBytes || 0,
    observedStart: summary.observedStart,
    observedEnd: summary.observedEnd,
    queryPlans: job.plan?.queryPlans || 0,
    stationPoolSize: job.plan?.stationPoolSize || 0,
    archivePartCount: 1,
    downloadedPages: 0,
  };
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
    const planFinished = rows.length < job.plan.pageSize;
    if (!normalized.length) {
      advanceJobCursor(job, true);
      processedAnyPage = true;
      continue;
    }

    const partIndex = job.completedPages + 1;
    await storeJobArchiveEntries(env, job, dataset, normalized, partIndex);

    job.summaryState = mergeAccumulatorState(job.summaryState, normalized, dataset.dateColumn);
    job.processedRows += normalized.length;
    job.completedPages += 1;

    advanceJobCursor(job, planFinished);
    processedAnyPage = true;
  }

  if (!processedAnyPage || !getNextPageDescriptor(job)) {
    if (!(job.archiveEntries || []).length) {
      await createNoDataJobArchive(env, job, dataset);
      return;
    }

    const summary = finalizeAccumulatorState(job.summaryState, job.processedRows || 0);
    const startedAt = job.startedAt ? new Date(job.startedAt).valueOf() : Date.now();
    job.status = "completed";
    job.finishedAt = new Date().toISOString();
    await createFinalJobArchive(env, job, dataset, summary);
    job.metrics = {
      fileName: job.parts[0]?.fileName || buildJobZipFileName(dataset),
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
        archiveEntries: [],
        summaryState: createAccumulatorState(),
        planCursor: { planIndex: 0, pageIndex: 0 },
        metrics: null,
      };
      await saveJobToStorage(this.state.storage, job);
      await this.state.storage.setAlarm(Date.now() + 50);
      return jsonResponse(buildJobResponse(job), 202);
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
        return jsonResponse({
          ok: true,
          deleted: false,
          partIndex,
          expiresAt: part.expiresAt || null,
          message: "El archivo permanece disponible hasta que expire la ventana temporal de R2.",
        });
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
      if (!job.plan) {
        job.status = "planning";
        await saveJobToStorage(this.state.storage, job);
      }
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
      return await handleDateRange(request, env);
    }
    if (url.pathname === "/api/municipalities" && request.method === "GET") {
      return await handleMunicipalities(request, env);
    }
    if (url.pathname === "/api/catalog-options" && request.method === "POST") {
      return await handleCatalogOptions(request, env, ctx);
    }
    if (url.pathname === "/api/catalog-bundle" && request.method === "POST") {
      return await handleCatalogBundle(request, env, ctx);
    }
    if (url.pathname === "/api/stations-helper" && request.method === "POST") {
      return await handleStationHelper(request, env);
    }
    if (url.pathname === "/api/coverage" && request.method === "POST") {
      return await handleCoverage(request, env);
    }
    if (url.pathname === "/api/preview" && request.method === "POST") {
      return await handlePreview(request, env);
    }
    if (url.pathname === "/api/export-plan" && request.method === "POST") {
      return await handleExportPlan(request, env);
    }
    if (url.pathname === "/api/export-page" && request.method === "POST") {
      return await handleExportPage(request, env);
    }
    if (url.pathname === "/api/export" && request.method === "POST") {
      return await handleExport(request, env);
    }
    if (url.pathname === "/api/jobs" && request.method === "POST") {
      return await handleCreateJob(request, env, ctx);
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)(?:\/(manifest|parts)(?:\/([^/]+))?)?$/);
    if (jobMatch && (request.method === "GET" || request.method === "DELETE")) {
      const [, jobId, action, extra] = jobMatch;
      return await handleJobProxy(request, env, jobId, action || "status", extra);
    }
    return jsonResponse({ error: "Ruta API no encontrada." }, 404);
  } catch (error) {
    const invalidJson = error instanceof SyntaxError && /JSON|Unexpected token|Unexpected end/i.test(error.message || "");
    return jsonResponse({
      error: invalidJson ? "JSON invalido en la solicitud." : error.message || "Error interno del Worker.",
    }, invalidJson ? 400 : error.status || 500);
  }
}

export {
  buildDepartmentFilter,
  catalogBundleAllDepartmentsPayload,
  buildQueryPlans,
  classifyCoverageRows,
  departmentVariants,
  expandStationCodes,
  getConfig,
  handleExportPlan,
  normalizeLabel,
  rowsToCsv,
  sanitizeRequestedFormats,
  warmCatalogCache,
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
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(warmCatalogCache(env).catch(() => null));
  },
};
