import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

const DATASET_ID = 's54a-sgyg';
const DEPARTMENT = 'ATLANTICO';

test('production IDEAM flow returns catalog, creates a job, and downloads a complete zip', async ({ request }) => {
  const root = await request.get('/');
  await expect(root).toBeOK();
  expect(root.headers()['content-type']).toContain('text/html');
  expect(await root.text()).toContain('<div id="root">');

  const health = await request.get('/api/health');
  await expect(health).toBeOK();
  await expect(await health.json()).toMatchObject({ ok: true, service: 'ideam-web-app' });

  const meta = await request.get('/api/meta');
  await expect(meta).toBeOK();
  const metaBody = await meta.json();
  expect(metaBody.datasets.map((dataset: { id: string }) => dataset.id)).toContain(DATASET_ID);
  expect(metaBody.departments).toContain(DEPARTMENT);

  const catalog = await request.post('/api/catalog-bundle', {
    data: { datasetId: DATASET_ID, departments: [DEPARTMENT] },
  });
  await expect(catalog).toBeOK();
  const catalogBody = await catalog.json();
  expect(catalogBody.rows.length).toBeGreaterThan(0);
  expect(catalogBody.rows.some((row: { municipio?: string }) => String(row.municipio).toUpperCase() === 'BARRANQUILLA')).toBe(true);

  const barranquillaRows = catalogBody.rows.filter((row: { municipio?: string; codigoestacion?: string }) =>
    String(row.municipio).toUpperCase() === 'BARRANQUILLA' && row.codigoestacion
  );
  const sampleStation = barranquillaRows.find((row: { codigoestacion?: string }) => row.codigoestacion === '0029004520') || barranquillaRows[0];
  expect(sampleStation).toBeTruthy();

  const payload = {
    datasetId: DATASET_ID,
    departments: [DEPARTMENT],
    catalogFilters: {
      municipalities: ['Barranquilla'],
      stations: [sampleStation.codigoestacion],
    },
    startDate: '2026-05-26',
    endDate: '2026-05-26',
    formats: ['csv', 'json', 'parquet'],
  };

  const plan = await request.post('/api/export-plan', { data: payload });
  await expect(plan).toBeOK();
  const planBody = await plan.json();
  expect(planBody.rowCount).toBeGreaterThan(0);
  expect(planBody.totalPages).toBeGreaterThan(0);

  const createdJob = await request.post('/api/jobs', { data: payload });
  expect(createdJob.status()).toBe(202);
  let job = await createdJob.json();

  for (let attempt = 0; attempt < 30 && job.status !== 'completed'; attempt += 1) {
    expect(job.status).not.toBe('failed');
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const status = await request.get(`/api/jobs/${job.jobId}`);
    await expect(status).toBeOK();
    job = await status.json();
  }

  expect(job.status).toBe('completed');
  expect(job.rowCount).toBeGreaterThan(0);
  expect(job.parts).toHaveLength(1);
  expect(job.parts[0].fileName).toMatch(/^precipitacion_\d{8}\.zip$/);

  const zipResponse = await request.get(job.parts[0].downloadPath);
  await expect(zipResponse).toBeOK();
  expect(zipResponse.headers()['content-type']).toContain('application/zip');

  const zip = await JSZip.loadAsync(await zipResponse.body());
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
  expect(names.some((name) => name.endsWith('.csv'))).toBe(true);
  expect(names.some((name) => name.endsWith('.json'))).toBe(true);
  expect(names.some((name) => name.endsWith('.parquet'))).toBe(true);
  expect(names.some((name) => name.includes('manifest'))).toBe(false);
  expect(names.every((name) => name.startsWith('precipitacion/atlantico/barranquilla/'))).toBe(true);
  expect(names.some((name) => name.startsWith('precipitacion/atlantico/barranquilla/csv/') && name.endsWith('.csv'))).toBe(true);
  expect(names.some((name) => name.startsWith('precipitacion/atlantico/barranquilla/json/') && name.endsWith('.json'))).toBe(true);
  expect(names.some((name) => name.startsWith('precipitacion/atlantico/barranquilla/parquet/') && name.endsWith('.parquet'))).toBe(true);
});
