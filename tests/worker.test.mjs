import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

import worker, {
  buildDepartmentFilter,
  catalogBundleAllDepartmentsPayload,
  buildJobPartBaseName,
  buildQueryPlans,
  classifyCoverageRows,
  createArchivePart,
  departmentVariants,
  ExportJobDurableObject,
  ExportRateLimitDurableObject,
  expandStationCodes,
  getConfig,
  handleExportPlan,
  normalizeLabel,
  rowsToCsv,
  sanitizeRequestedFormats,
  warmCatalogCache,
  validateRequiredDepartments,
} from '../src/worker/index.js';

function createMemoryBucket() {
  const objects = new Map();
  return {
    objects,
    async get(key) {
      const record = objects.get(key);
      if (!record) return null;
      return {
        customMetadata: record.customMetadata || {},
        async json() {
          return JSON.parse(record.body);
        },
        async text() {
          return record.body;
        },
      };
    },
    async put(key, value, options = {}) {
      objects.set(key, {
        body: typeof value === 'string' ? value : await new Response(value).text(),
        customMetadata: options.customMetadata || {},
        httpMetadata: options.httpMetadata || {},
      });
    },
  };
}

function createWaitUntilContext() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) {
      promises.push(Promise.resolve(promise));
    },
  };
}

test('normalizeLabel removes accents and normalizes case', () => {
  assert.equal(normalizeLabel('Atl\u00e1ntico'), 'ATLANTICO');
  assert.equal(normalizeLabel(' Bogot\u00e1 D.C. '), 'BOGOTA D.C.');
});

test('departmentVariants keeps clean and accent variants for Atlantico', () => {
  const variants = departmentVariants('ATLANTICO');
  assert.ok(variants.includes('ATLANTICO'));
  assert.ok(variants.includes('ATL\u00c1NTICO'));
});

test('buildDepartmentFilter includes configured and normalized variants', () => {
  const filter = buildDepartmentFilter(['ATLANTICO']);
  assert.match(filter.filter, /ATLANTICO/);
  assert.match(filter.filter, /ATL\u00c1NTICO|ATL?/);
  assert.equal(filter.replacements.ATLANTICO, 'ATLANTICO');
});

test('validateRequiredDepartments blocks global and invalid export requests', () => {
  assert.equal(validateRequiredDepartments({ departments: [] }).ok, false);
  assert.equal(validateRequiredDepartments({ departments: ['NO EXISTE'] }).ok, false);

  const valid = validateRequiredDepartments({ departments: ['Atl\u00e1ntico'] });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.departments, ['ATLANTICO']);
});

test('expandStationCodes keeps both 8 and 10 digit variants', () => {
  const codes = expandStationCodes(['29045180']);
  assert.ok(codes.includes('29045180'));
  assert.ok(codes.includes('0029045180'));
});

test('rowsToCsv escapes commas, quotes and line breaks', () => {
  const csv = rowsToCsv([{ a: 'uno,dos', b: '"hola"', c: 'x\ny' }]);
  assert.match(csv, /^a,b,c/m);
  assert.match(csv, /"uno,dos"/);
  assert.match(csv, /"""hola"""/);
  assert.match(csv, /"x\ny"/);
});

test('getConfig keeps MAX_EXPORT_ROWS available but nullable by default', () => {
  const defaultConfig = getConfig({});
  const customConfig = getConfig({
    MAX_EXPORT_ROWS: '2500',
    EXPORT_PAGE_SIZE: '800',
    EXPORT_PAGE_CONCURRENCY: '4',
    SOCRATA_APP_TOKEN: 'token-123',
    SOCRATA_TIMEOUT_MS: '12000',
  });
  assert.equal(defaultConfig.maxExportRows, null);
  assert.equal(defaultConfig.socrataAppToken, '');
  assert.equal(defaultConfig.socrataTimeoutMs, 30000);
  assert.equal(customConfig.maxExportRows, 2500);
  assert.equal(customConfig.exportPageSize, 800);
  assert.equal(customConfig.exportPageConcurrency, 4);
  assert.equal(customConfig.socrataAppToken, 'token-123');
  assert.equal(customConfig.socrataTimeoutMs, 12000);
  assert.equal(getConfig({ EXPORT_PAGE_CONCURRENCY: '99' }).exportPageConcurrency, 5);
  assert.equal(getConfig({ SODA_APP_TOKEN: 'legacy-token' }).socrataAppToken, 'legacy-token');
});

test('catalog options are written to R2 and reused without hitting Socrata again', async () => {
  const originalFetch = global.fetch;
  const bucket = createMemoryBucket();
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify([
      { municipio: 'BARRANQUILLA', total: '12' },
      { municipio: 'SOLEDAD', total: '8' },
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const env = {
      EXPORTS_BUCKET: bucket,
      ASSETS: { fetch: async () => new Response('asset') },
    };
    const firstCtx = createWaitUntilContext();
    const first = await worker.fetch(new Request('https://ideam.test/api/catalog-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        catalogFilters: {},
        attributeKey: 'municipalities',
      }),
    }), env, firstCtx);
    await Promise.all(firstCtx.promises);

    assert.equal(first.status, 200);
    assert.equal(first.headers.get('x-ideam-cache'), 'MISS');
    assert.equal(fetchCalls, 1);

    global.fetch = async () => {
      throw new Error('Socrata should not be called when R2 cache is warm');
    };

    const second = await worker.fetch(new Request('https://ideam.test/api/catalog-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        catalogFilters: {},
        attributeKey: 'municipalities',
      }),
    }), env, createWaitUntilContext());
    const data = await second.json();

    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-ideam-cache'), 'R2-HIT');
    assert.deepEqual(data.options.map((option) => option.value), ['BARRANQUILLA', 'SOLEDAD']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('catalog bundle caches all advanced dimensions for instant dependent filtering', async () => {
  const originalFetch = global.fetch;
  const bucket = createMemoryBucket();
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify([
      {
        departamento: 'Atlantico',
        municipio: 'BARRANQUILLA',
        zona_hidrografica: 'CARIBE',
        codigo: '0029045180',
        nombre: 'AEROPUERTO [29045180]',
        total: '12',
      },
      {
        departamento: 'Atlantico',
        municipio: 'SOLEDAD',
        zona_hidrografica: 'CARIBE',
        codigo: '0029045190',
        nombre: 'SOLEDAD [29045190]',
        total: '8',
      },
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const env = {
      EXPORTS_BUCKET: bucket,
      ASSETS: { fetch: async () => new Response('asset') },
    };
    const firstCtx = createWaitUntilContext();
    const first = await worker.fetch(new Request('https://ideam.test/api/catalog-bundle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
      }),
    }), env, firstCtx);
    await Promise.all(firstCtx.promises);

    assert.equal(first.status, 202);
    assert.equal(first.headers.get('x-ideam-cache'), 'PENDING');
    assert.equal(fetchCalls, 1);

    global.fetch = async () => {
      throw new Error('Socrata should not be called when bundle cache is warm');
    };

    const second = await worker.fetch(new Request('https://ideam.test/api/catalog-bundle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
      }),
    }), env, createWaitUntilContext());
    const data = await second.json();

    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-ideam-cache'), 'R2-HIT');
    assert.equal(data.rows.length, 2);
    assert.ok(data.columns.includes('departamento'));
    assert.ok(data.columns.includes('municipio'));
    assert.ok(data.columns.includes('codigoestacion'));
    assert.equal(data.rows[0].codigoestacion, '0029045180');
    assert.equal(data.rows[0].nombreestacion, 'AEROPUERTO [29045180]');
  } finally {
    global.fetch = originalFetch;
  }
});

test('catalog bundle can answer department requests from a cached dataset-wide bundle', async () => {
  const originalFetch = global.fetch;
  const bucket = createMemoryBucket();
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify([
      {
        departamento: 'Atlantico',
        municipio: 'BARRANQUILLA',
        zona_hidrografica: 'CARIBE',
        codigo: '0029045180',
        nombre: 'AEROPUERTO [29045180]',
        total: '12',
      },
      {
        departamento: 'Bolivar',
        municipio: 'CARTAGENA',
        zona_hidrografica: 'CARIBE',
        codigo: '0029045200',
        nombre: 'CARTAGENA [29045200]',
        total: '7',
      },
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const env = {
      EXPORTS_BUCKET: bucket,
      ASSETS: { fetch: async () => new Response('asset') },
    };
    const globalPayload = catalogBundleAllDepartmentsPayload('s54a-sgyg');

    const warmCtx = createWaitUntilContext();
    const warmResponse = await worker.fetch(new Request('https://ideam.test/api/catalog-bundle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(globalPayload),
    }), env, warmCtx);
    await Promise.all(warmCtx.promises);
    assert.equal(warmResponse.status, 202);
    assert.equal(fetchCalls, 1);

    global.fetch = async () => {
      throw new Error('Socrata should not be called when dataset-wide bundle is warm');
    };

    const response = await worker.fetch(new Request('https://ideam.test/api/catalog-bundle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
      }),
    }), env, createWaitUntilContext());
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-ideam-cache'), 'R2-HIT-SUPERSET');
    assert.deepEqual(data.rows.map((row) => row.municipio), ['BARRANQUILLA']);
    assert.deepEqual(data.departments, ['ATLANTICO']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('api routes return JSON errors for malformed request bodies', async () => {
  const response = await worker.fetch(new Request('https://ideam.test/api/catalog-bundle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad-json',
  }), {
    ASSETS: { fetch: async () => new Response('asset') },
  }, createWaitUntilContext());
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(data.error, 'JSON invalido en la solicitud.');
});

test('catalog cache-only requests return quickly and warm R2 in the background', async () => {
  const originalFetch = global.fetch;
  const bucket = createMemoryBucket();
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify([{ municipio: 'BARRANQUILLA', total: '12' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const env = {
      EXPORTS_BUCKET: bucket,
      ASSETS: { fetch: async () => new Response('asset') },
    };
    const ctx = createWaitUntilContext();
    const response = await worker.fetch(new Request('https://ideam.test/api/catalog-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        catalogFilters: {},
        attributeKey: 'municipalities',
        cacheOnly: true,
      }),
    }), env, ctx);
    const data = await response.json();

    assert.equal(response.status, 202);
    assert.equal(response.headers.get('x-ideam-cache'), 'PENDING');
    assert.equal(data.cachePending, true);

    await Promise.all(ctx.promises);
    assert.equal(fetchCalls, 1);
    assert.ok(Array.from(bucket.objects.keys()).some((key) => key.startsWith('catalog-cache/options/')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('warmCatalogCache rotates catalog payloads and stores progress in R2', async () => {
  const originalFetch = global.fetch;
  const bucket = createMemoryBucket();
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify([{ municipio: 'BARRANQUILLA', total: '1' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const summary = await warmCatalogCache({
      EXPORTS_BUCKET: bucket,
      CATALOG_WARM_LIMIT: '3',
      CATALOG_CACHE_TTL_SECONDS: '86400',
    });

    assert.equal(summary.warmed, 3);
    assert.equal(summary.failed, 0);
    assert.ok(fetchCalls >= 3);
    assert.ok(bucket.objects.has('catalog-cache/_warm-state.json'));
    assert.ok(Array.from(bucket.objects.keys()).some((key) => key.startsWith('catalog-cache/bundles/')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('classifyCoverageRows separates configured and discovered variants', () => {
  const report = classifyCoverageRows('ATLANTICO', [
    { departamento: 'ATLANTICO', total: 10 },
    { departamento: 'ATL\u00c1NTICO', total: 12 },
    { departamento: 'ATLANTICO NORTE', total: 2 },
    { departamento: 'BOLIVAR', total: 8 },
  ]);

  assert.equal(report.matched_rows, 22);
  assert.equal(report.unmatched_rows, 2);
  assert.deepEqual(report.matched.map((item) => item.departamento), ['ATLANTICO', 'ATL\u00c1NTICO']);
  assert.deepEqual(report.unmatched_discovered.map((item) => item.departamento), ['ATLANTICO NORTE']);
});

test('buildQueryPlans chunks large station pools into multiple plans', async () => {
  const payload = {
    datasetId: 's54a-sgyg',
    departments: [],
    stationCodes: Array.from({ length: 401 }, (_, index) => `STA${String(index).padStart(4, '0')}`),
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  };
  const dataset = { id: 's54a-sgyg', dateColumn: 'fechaobservacion' };
  const config = getConfig({});
  const built = await buildQueryPlans(config, payload, dataset);

  assert.equal(built.plans.length, 2);
  assert.equal(built.stationPoolSize, 401);
  assert.match(built.plans[0].where, /codigoestacion IN/);
  assert.match(built.plans[1].where, /codigoestacion IN/);
});

test('handleExportPlan allows very large exports without 413 and computes pages correctly', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.includes('/hp9r-jxuu.json') && parsed.searchParams.get('$select') === 'codigo') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.searchParams.get('$select') === 'count(*) as total') {
      return new Response(JSON.stringify([{ total: '250000' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const request = new Request('https://example.com/api/export-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        stationCodes: ['0029045180'],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }),
    });

    const response = await handleExportPlan(request, { EXPORT_PAGE_SIZE: '50000', MAX_EXPORT_ROWS: '1000' });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.rowCount, 250000);
    assert.equal(data.totalPages, 5);
    assert.equal(data.pageSize, 50000);
  } finally {
    global.fetch = originalFetch;
  }
});

test('handleExportPlan retries transient Socrata 500 responses', async () => {
  const originalFetch = global.fetch;
  let countCalls = 0;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.includes('/hp9r-jxuu.json') && parsed.searchParams.get('$select') === 'codigo') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.searchParams.get('$select') === 'count(*) as total') {
      countCalls += 1;
      if (countCalls === 1) {
        return new Response(JSON.stringify({ error: 'temporary' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([{ total: '9' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const request = new Request('https://example.com/api/export-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        stationCodes: ['0029045180'],
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      }),
    });

    const response = await handleExportPlan(request, { EXPORT_PAGE_SIZE: '50000' });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.rowCount, 9);
    assert.equal(countCalls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('handleExportPlan sends Socrata app token header when configured', async () => {
  const originalFetch = global.fetch;
  const appTokens = [];

  global.fetch = async (_url, init = {}) => {
    const headers = new Headers(init.headers || {});
    appTokens.push(headers.get('X-App-Token'));
    return new Response(JSON.stringify([{ total: '1' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const request = new Request('https://example.com/api/export-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }),
    });

    const response = await handleExportPlan(request, {
      EXPORT_PAGE_SIZE: '50000',
      SOCRATA_APP_TOKEN: 'secret-token',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(appTokens, ['secret-token']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('handleExportPlan rejects global exports without department', async () => {
  const request = new Request('https://example.com/api/export-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      datasetId: 's54a-sgyg',
      departments: [],
      stationCodes: ['0029045180'],
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    }),
  });

  await assert.rejects(
    () => handleExportPlan(request, { EXPORT_PAGE_SIZE: '50000' }),
    /descargas globales no estan permitidas/
  );
});

test('handleExportPlan supports very small exports', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.includes('/hp9r-jxuu.json') && parsed.searchParams.get('$select') === 'codigo') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.searchParams.get('$select') === 'count(*) as total') {
      return new Response(JSON.stringify([{ total: '17' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const request = new Request('https://example.com/api/export-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        stationCodes: ['0029045180'],
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      }),
    });

    const response = await handleExportPlan(request, { EXPORT_PAGE_SIZE: '50000' });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.rowCount, 17);
    assert.equal(data.totalPages, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('handleExportPlan supports multi-plan exports from large station sets', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.includes('/hp9r-jxuu.json') && parsed.searchParams.get('$select') === 'codigo') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.searchParams.get('$select') === 'count(*) as total') {
      const where = parsed.searchParams.get('$where') || '';
      const total = where.includes('STA0400') ? '55' : '80000';
      return new Response(JSON.stringify([{ total }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const stationCodes = Array.from({ length: 401 }, (_, index) => `STA${String(index).padStart(4, '0')}`);
    const request = new Request('https://example.com/api/export-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        datasetId: 's54a-sgyg',
        departments: ['ATLANTICO'],
        stationCodes,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }),
    });

    const response = await handleExportPlan(request, { EXPORT_PAGE_SIZE: '50000' });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.queryPlans, 2);
    assert.equal(data.rowCount, 80055);
    assert.equal(data.totalPages, 3);
    assert.equal(data.planPages.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});



test('sanitizeRequestedFormats keeps parquet as an effective output', () => {
  const formatState = sanitizeRequestedFormats(['parquet']);
  assert.deepEqual(formatState.effective, ['parquet']);
  assert.deepEqual(formatState.warnings, []);
});

test('buildJobPartBaseName creates padded part names', () => {
  assert.equal(buildJobPartBaseName('precipitacion_atlantico', 7), 'precipitacion_atlantico_part_0007');
});

test('ExportRateLimitDurableObject enforces 30 export requests per hour per key', async () => {
  const storageMap = new Map();
  const state = {
    storage: {
      async get(key) {
        return storageMap.get(key);
      },
      async put(key, value) {
        storageMap.set(key, value);
      },
    },
  };

  const limiter = new ExportRateLimitDurableObject(state, {});
  let response;
  for (let index = 0; index < 30; index += 1) {
    response = await limiter.fetch(new Request('https://export-rate-limit/check', { method: 'POST' }));
    assert.equal(response.status, 200);
  }

  response = await limiter.fetch(new Request('https://export-rate-limit/check', { method: 'POST' }));
  const data = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after') !== null, true);
  assert.equal(data.limit, 30);
});

test('createArchivePart generates a zip payload', async () => {
  const buffer = await createArchivePart(
    [{ codigoestacion: '29045180', valorobservado: 12.5 }],
    ['csv', 'json'],
    'demo_part_0001',
    { rowCount: 1 }
  );
  assert.ok(buffer.byteLength > 0);
});

test('createArchivePart generates a parquet file inside the zip', async () => {
  const buffer = await createArchivePart(
    [{ codigoestacion: '29045180', valorobservado: 12.5, departamento: 'ATLANTICO' }],
    ['parquet'],
    'demo_part_0001',
    { rowCount: 1 }
  );
  const zip = await JSZip.loadAsync(buffer);
  const parquetFile = zip.file('demo_part_0001.parquet');
  assert.ok(parquetFile);
  const parquetBytes = await parquetFile.async('uint8array');
  assert.equal(Buffer.from(parquetBytes.slice(0, 4)).toString('utf8'), 'PAR1');
  assert.equal(Buffer.from(parquetBytes.slice(-4)).toString('utf8'), 'PAR1');
});

test('ExportJobDurableObject creates downloadable parts end to end', async () => {
  const storageMap = new Map();
  const state = {
    storage: {
      async get(key) {
        return storageMap.get(key);
      },
      async put(key, value) {
        storageMap.set(key, value);
      },
      async setAlarm(value) {
        storageMap.set('__alarm__', value);
      },
    },
  };

  const objects = new Map();
  const env = {
    EXPORTS_BUCKET: {
      async put(key, value, options = {}) {
        const storedValue = value?.getReader ? new Uint8Array(await new Response(value).arrayBuffer()) : value;
        objects.set(key, { value: storedValue, options });
      },
      async get(key) {
        const item = objects.get(key);
        if (!item) return null;
        return {
          body: new Blob([item.value]).stream(),
          httpMetadata: item.options.httpMetadata || {},
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    },
    EXPORT_PAGE_SIZE: '50000',
  };

  const originalFetch = global.fetch;
  const originalFixedLengthStream = globalThis.FixedLengthStream;
  const fixedLengths = [];
  globalThis.FixedLengthStream = class {
    constructor(length) {
      fixedLengths.push(Number(length));
      return new TransformStream();
    }
  };

  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    const select = parsed.searchParams.get('$select');
    if (parsed.pathname.includes('/hp9r-jxuu.json') && select === 'codigo') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (select === 'count(*) as total') {
      return new Response(JSON.stringify([{ total: '2' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (parsed.searchParams.get('$limit') === '50000' && parsed.searchParams.get('$offset') === '0') {
      return new Response(
        JSON.stringify([
          { codigoestacion: '29045180', municipio: 'BARRANQUILLA', departamento: 'ATLANTICO', valorobservado: '12.5', fechaobservacion: '2024-01-01T00:00:00.000' },
          { codigoestacion: '29045181', municipio: 'SOLEDAD', departamento: 'ATL?NTICO', valorobservado: '10.1', fechaobservacion: '2024-01-02T00:00:00.000' },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (parsed.searchParams.get('$limit') === '50000') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const durableObject = new ExportJobDurableObject(state, env);
    const createResponse = await durableObject.fetch(
      new Request('https://export-job/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-e2e',
          payload: {
            datasetId: 's54a-sgyg',
            departments: ['ATLANTICO'],
            stationCodes: ['STA0001'],
            startDate: '2024-01-01',
            endDate: '2024-01-02',
          },
          formats: ['csv', 'json'],
        }),
      })
    );
    assert.equal(createResponse.status, 202);
    const queuedData = await createResponse.json();
    assert.equal(queuedData.status, 'queued');
    assert.equal(storageMap.has('__alarm__'), true);

    await durableObject.alarm();
    await durableObject.alarm();

    const statusResponse = await durableObject.fetch(new Request('https://export-job/status'));
    const statusData = await statusResponse.json();
    assert.equal(statusData.status, 'completed');
    assert.equal(statusData.parts.length, 1);
    assert.equal(statusData.processedRows, 2);
    assert.match(statusData.parts[0].fileName, /^precipitacion_\d{8}\.zip$/);
    assert.equal(fixedLengths.length, 1);
    assert.equal(fixedLengths[0], statusData.parts[0].sizeBytes);

    const partResponse = await durableObject.fetch(new Request('https://export-job/parts/1'));
    assert.equal(partResponse.status, 200);
    assert.equal(partResponse.headers.get('content-type'), 'application/zip');
    assert.equal(partResponse.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    const zip = await JSZip.loadAsync(await partResponse.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    assert.equal(names.some((name) => name.includes('manifest')), false);
    assert.ok(names.some((name) => name.startsWith('precipitacion/atlantico/barranquilla/csv/') && name.endsWith('.csv')));
    assert.ok(names.some((name) => name.startsWith('precipitacion/atlantico/barranquilla/json/') && name.endsWith('.json')));
    assert.ok(names.some((name) => name.startsWith('precipitacion/atl_ntico/soledad/csv/') && name.endsWith('.csv')));
    assert.ok(names.some((name) => name.startsWith('precipitacion/atl_ntico/soledad/json/') && name.endsWith('.json')));

    const deleteResponse = await durableObject.fetch(new Request('https://export-job/parts/1', { method: 'DELETE' }));
    const deleteData = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteData.deleted, false);
    assert.equal(objects.size, 1);

    const secondPartResponse = await durableObject.fetch(new Request('https://export-job/parts/1'));
    assert.equal(secondPartResponse.status, 200);
  } finally {
    global.fetch = originalFetch;
    if (originalFixedLengthStream === undefined) {
      delete globalThis.FixedLengthStream;
    } else {
      globalThis.FixedLengthStream = originalFixedLengthStream;
    }
  }
});

test('ExportJobDurableObject processes multiple Socrata pages in one batch', async () => {
  const storageMap = new Map();
  const state = {
    storage: {
      async get(key) {
        return storageMap.get(key);
      },
      async put(key, value) {
        storageMap.set(key, value);
      },
      async setAlarm(value) {
        storageMap.set('__alarm__', value);
      },
    },
  };
  const objects = new Map();
  const env = {
    EXPORTS_BUCKET: {
      async put(key, value, options = {}) {
        const storedValue = value?.getReader ? new Uint8Array(await new Response(value).arrayBuffer()) : value;
        objects.set(key, { value: storedValue, options });
      },
      async get(key) {
        const item = objects.get(key);
        if (!item) return null;
        return {
          body: new Blob([item.value]).stream(),
          httpMetadata: item.options.httpMetadata || {},
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    },
    EXPORT_PAGE_SIZE: '2',
  };

  const originalFetch = global.fetch;
  const fetchedOffsets = [];
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    const select = parsed.searchParams.get('$select');
    if (parsed.pathname.includes('/hp9r-jxuu.json') && select === 'codigo') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (select === 'count(*) as total') {
      return new Response(JSON.stringify([{ total: '5' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (parsed.searchParams.get('$limit') === '2') {
      const offset = Number(parsed.searchParams.get('$offset') || '0');
      fetchedOffsets.push(offset);
      const rowsByOffset = {
        0: [
          { codigoestacion: '29045180', municipio: 'BARRANQUILLA', departamento: 'ATLANTICO', valorobservado: '12.5', fechaobservacion: '2024-01-01T00:00:00.000' },
          { codigoestacion: '29045181', municipio: 'BARRANQUILLA', departamento: 'ATLANTICO', valorobservado: '10.1', fechaobservacion: '2024-01-02T00:00:00.000' },
        ],
        2: [
          { codigoestacion: '29045182', municipio: 'SOLEDAD', departamento: 'ATLANTICO', valorobservado: '8.0', fechaobservacion: '2024-01-03T00:00:00.000' },
          { codigoestacion: '29045183', municipio: 'SOLEDAD', departamento: 'ATLANTICO', valorobservado: '6.2', fechaobservacion: '2024-01-04T00:00:00.000' },
        ],
        4: [
          { codigoestacion: '29045184', municipio: 'MALAMBO', departamento: 'ATLANTICO', valorobservado: '5.4', fechaobservacion: '2024-01-05T00:00:00.000' },
        ],
      };
      return new Response(JSON.stringify(rowsByOffset[offset] || []), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const durableObject = new ExportJobDurableObject(state, env);
    const createResponse = await durableObject.fetch(
      new Request('https://export-job/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-parallel-pages',
          payload: {
            datasetId: 's54a-sgyg',
            departments: ['ATLANTICO'],
            startDate: '2024-01-01',
            endDate: '2024-01-05',
          },
          formats: ['csv'],
        }),
      })
    );
    assert.equal(createResponse.status, 202);

    await durableObject.alarm();

    const statusResponse = await durableObject.fetch(new Request('https://export-job/status'));
    const statusData = await statusResponse.json();
    assert.equal(statusData.status, 'completed');
    assert.deepEqual(fetchedOffsets, [0, 2, 4]);
    assert.equal(statusData.completedPages, 3);
    assert.equal(statusData.processedRows, 5);
    assert.equal(statusData.parts.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('ExportJobDurableObject exposes client export plan telemetry before processing', async () => {
  const storageMap = new Map();
  const state = {
    storage: {
      async get(key) {
        return storageMap.get(key);
      },
      async put(key, value) {
        storageMap.set(key, value);
      },
      async setAlarm(value) {
        storageMap.set('__alarm__', value);
      },
    },
  };

  const durableObject = new ExportJobDurableObject(state, { EXPORTS_BUCKET: { async put() {} } });
  const createResponse = await durableObject.fetch(
    new Request('https://export-job/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jobId: 'job-telemetry',
        payload: {
          datasetId: 's54a-sgyg',
          departments: ['ATLANTICO'],
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        },
        formats: ['csv'],
        exportPlan: {
          datasetId: 's54a-sgyg',
          rowCount: 125000,
          totalPages: 3,
          pageSize: 50000,
          queryPlans: 1,
          stationPoolSize: 8,
          planPages: [{ planIndex: 0, rowCount: 125000, pageCount: 3 }],
        },
      }),
    })
  );
  const data = await createResponse.json();

  assert.equal(createResponse.status, 202);
  assert.equal(data.rowCount, 125000);
  assert.equal(data.totalPages, 3);
  assert.equal(data.pageSize, 50000);
  assert.equal(data.queryPlans, 1);
  assert.equal(data.stationPoolSize, 8);
  assert.equal(data.currentStage, 'En cola');
  assert.equal(data.progressPercent, 2);
});

test('ExportJobDurableObject retries transient archive failures before failing the job', async () => {
  const storageMap = new Map();
  const state = {
    storage: {
      async get(key) {
        return storageMap.get(key);
      },
      async put(key, value) {
        storageMap.set(key, value);
      },
      async setAlarm(value) {
        storageMap.set('__alarm__', value);
      },
    },
  };

  const objects = new Map();
  let entryPutAttempts = 0;
  const env = {
    EXPORTS_BUCKET: {
      async put(key, value, options = {}) {
        if (key.includes('/entries/') && entryPutAttempts === 0) {
          entryPutAttempts += 1;
          throw new Error('R2 transient upload failure');
        }
        if (key.includes('/entries/')) entryPutAttempts += 1;
        const storedValue = value?.getReader ? new Uint8Array(await new Response(value).arrayBuffer()) : value;
        objects.set(key, { value: storedValue, options });
      },
      async get(key) {
        const item = objects.get(key);
        if (!item) return null;
        return {
          body: new Blob([item.value]).stream(),
          httpMetadata: item.options.httpMetadata || {},
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    },
    EXPORT_PAGE_SIZE: '50000',
  };

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    const select = parsed.searchParams.get('$select');
    if (parsed.pathname.includes('/hp9r-jxuu.json') && select === 'codigo') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (select === 'count(*) as total') {
      return new Response(JSON.stringify([{ total: '1' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (parsed.searchParams.get('$limit') === '50000' && parsed.searchParams.get('$offset') === '0') {
      return new Response(
        JSON.stringify([
          { codigoestacion: '29045180', municipio: 'BARRANQUILLA', departamento: 'ATLANTICO', valorobservado: '12.5', fechaobservacion: '2024-01-01T00:00:00.000' },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (parsed.searchParams.get('$limit') === '50000') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const durableObject = new ExportJobDurableObject(state, env);
    const createResponse = await durableObject.fetch(
      new Request('https://export-job/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-retry',
          payload: {
            datasetId: 's54a-sgyg',
            departments: ['ATLANTICO'],
            stationCodes: ['STA0001'],
            startDate: '2024-01-01',
            endDate: '2024-01-02',
          },
          formats: ['csv'],
        }),
      })
    );
    assert.equal(createResponse.status, 202);

    await durableObject.alarm();
    let statusResponse = await durableObject.fetch(new Request('https://export-job/status'));
    let statusData = await statusResponse.json();
    assert.equal(statusData.status, 'retrying');
    assert.equal(statusData.retryCount, 1);
    assert.match(statusData.error, /R2 transient/);
    assert.equal(statusData.parts.length, 0);

    await durableObject.alarm();
    statusResponse = await durableObject.fetch(new Request('https://export-job/status'));
    statusData = await statusResponse.json();
    assert.equal(statusData.status, 'completed');
    assert.equal(statusData.retryCount, 0);
    assert.equal(statusData.error, null);
    assert.equal(statusData.parts.length, 1);
    assert.equal(entryPutAttempts, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('ExportJobDurableObject creates a no-data zip when filters return zero rows', async () => {
  const storageMap = new Map();
  const state = {
    storage: {
      async get(key) {
        return storageMap.get(key);
      },
      async put(key, value) {
        storageMap.set(key, value);
      },
      async setAlarm(value) {
        storageMap.set('__alarm__', value);
      },
    },
  };

  const objects = new Map();
  const env = {
    EXPORTS_BUCKET: {
      async put(key, value, options = {}) {
        const storedValue = value?.getReader ? new Uint8Array(await new Response(value).arrayBuffer()) : value;
        objects.set(key, { value: storedValue, options });
      },
      async get(key) {
        const item = objects.get(key);
        if (!item) return null;
        return {
          body: new Blob([item.value]).stream(),
          httpMetadata: item.options.httpMetadata || {},
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    },
    EXPORT_PAGE_SIZE: '50000',
  };

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    const select = parsed.searchParams.get('$select');
    if (parsed.pathname.includes('/hp9r-jxuu.json') && select === 'codigo') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (select === 'count(*) as total') {
      return new Response(JSON.stringify([{ total: '0' }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (parsed.searchParams.get('$limit') === '50000' && parsed.searchParams.get('$offset') === '0') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (parsed.searchParams.get('$limit') === '50000') {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch call: ${parsed.toString()}`);
  };

  try {
    const durableObject = new ExportJobDurableObject(state, env);
    const createResponse = await durableObject.fetch(
      new Request('https://export-job/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId: 'job-empty',
          payload: {
            datasetId: 's54a-sgyg',
            departments: ['ATLANTICO'],
            stationCodes: ['STA0001'],
            startDate: '1900-01-01',
            endDate: '1900-01-02',
          },
          formats: ['csv'],
        }),
      })
    );
    assert.equal(createResponse.status, 202);
    const queuedData = await createResponse.json();
    assert.equal(queuedData.status, 'queued');
    assert.equal(storageMap.has('__alarm__'), true);

    await durableObject.alarm();

    const statusResponse = await durableObject.fetch(new Request('https://export-job/status'));
    const statusData = await statusResponse.json();
    assert.equal(statusData.status, 'completed');
    assert.equal(statusData.rowCount, 0);
    assert.equal(statusData.parts.length, 1);
    assert.equal(statusData.metrics.archivePartCount, 1);
    assert.match(statusData.parts[0].fileName, /^precipitacion_\d{8}\.zip$/);

    const partResponse = await durableObject.fetch(new Request('https://export-job/parts/1'));
    assert.equal(partResponse.status, 200);
    assert.equal(partResponse.headers.get('content-type'), 'application/zip');
    const zip = await JSZip.loadAsync(await partResponse.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    assert.equal(names.some((name) => name.includes('manifest')), false);
    assert.ok(names.some((name) => name.startsWith('precipitacion/sin_datos/csv/') && name.endsWith('.csv')));
  } finally {
    global.fetch = originalFetch;
  }
});
