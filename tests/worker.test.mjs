import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDepartmentFilter,
  buildJobPartBaseName,
  buildQueryPlans,
  classifyCoverageRows,
  createArchivePart,
  departmentVariants,
  ExportJobDurableObject,
  expandStationCodes,
  getConfig,
  handleExportPlan,
  normalizeLabel,
  rowsToCsv,
  sanitizeRequestedFormats,
} from '../src/worker/index.js';

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
  const customConfig = getConfig({ MAX_EXPORT_ROWS: '2500', EXPORT_PAGE_SIZE: '800' });
  assert.equal(defaultConfig.maxExportRows, null);
  assert.equal(customConfig.maxExportRows, 2500);
  assert.equal(customConfig.exportPageSize, 800);
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
        departments: [],
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

test('handleExportPlan supports very small exports', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
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
        departments: [],
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
        departments: [],
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



test('sanitizeRequestedFormats keeps stable fallback output', () => {
  const formatState = sanitizeRequestedFormats(['parquet']);
  assert.deepEqual(formatState.effective, ['csv']);
  assert.ok(formatState.warnings.length >= 1);
});

test('buildJobPartBaseName creates padded part names', () => {
  assert.equal(buildJobPartBaseName('precipitacion_atlantico', 7), 'precipitacion_atlantico_part_0007');
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
        objects.set(key, { value, options });
      },
      async get(key) {
        const item = objects.get(key);
        if (!item) return null;
        return {
          body: new Blob([item.value]).stream(),
          httpMetadata: item.options.httpMetadata || {},
        };
      },
    },
    EXPORT_PAGE_SIZE: '50000',
  };

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const parsed = new URL(String(url));
    const select = parsed.searchParams.get('$select');
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
            departments: [],
            stationCodes: ['STA0001'],
            startDate: '2024-01-01',
            endDate: '2024-01-02',
          },
          formats: ['csv', 'json'],
        }),
      })
    );
    assert.equal(createResponse.status, 202);

    await durableObject.alarm();
    await durableObject.alarm();

    const statusResponse = await durableObject.fetch(new Request('https://export-job/status'));
    const statusData = await statusResponse.json();
    assert.equal(statusData.status, 'completed');
    assert.equal(statusData.parts.length, 1);
    assert.equal(statusData.processedRows, 2);

    const partResponse = await durableObject.fetch(new Request('https://export-job/parts/1'));
    assert.equal(partResponse.status, 200);
    assert.equal(partResponse.headers.get('content-type'), 'application/zip');
  } finally {
    global.fetch = originalFetch;
  }
});
