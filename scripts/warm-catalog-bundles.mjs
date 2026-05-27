const DEFAULT_BASE_URL = 'https://ideam.sergiobc.com';
const BASE_URL = (process.env.IDEAM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.CATALOG_WARM_CONCURRENCY || 2));

async function apiJson(path, init, fallbackMessage) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMessage}: non-JSON response ${text.slice(0, 180)}`);
  }
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return { data, cache: response.headers.get('x-ideam-cache') || 'UNKNOWN' };
}

async function worker(items, handler) {
  const failures = [];
  let index = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      try {
        await handler(current);
      } catch (error) {
        failures.push({ item: current, message: error instanceof Error ? error.message : String(error) });
      }
    }
  });
  await Promise.all(runners);
  return failures;
}

const startedAt = Date.now();
console.log(`Warming IDEAM catalog bundles from ${BASE_URL} with concurrency=${CONCURRENCY}`);

const { data: meta } = await apiJson('/api/meta', undefined, 'No fue posible cargar metadata');
const datasets = meta.datasets || [];
const departments = meta.departments || [];
const tasks = datasets.map((dataset) => ({ datasetId: dataset.id }));

let warmed = 0;
let cacheHits = 0;
const failures = await worker(tasks, async ({ datasetId }) => {
  const { data, cache } = await apiJson('/api/catalog-bundle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ datasetId, departments }),
  }, `No fue posible calentar ${datasetId}`);
  warmed += 1;
  if (cache.includes('HIT')) cacheHits += 1;
  console.log(`[${warmed}/${tasks.length}] ${datasetId}: ${data.rows?.length || 0} filas de catalogo (${cache})`);
});

const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
console.log(`Catalog warm finished: warmed=${warmed}, cacheHits=${cacheHits}, failed=${failures.length}, seconds=${elapsedSeconds}`);

if (failures.length) {
  failures.slice(0, 20).forEach((failure) => {
    console.error(`FAILED ${failure.item.datasetId}: ${failure.message}`);
  });
  process.exit(1);
}
