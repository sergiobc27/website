import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

const DATASET_ID = 's54a-sgyg';
const DEPARTMENT = 'ATLANTICO';

// Ventana de un día para el smoke de descarga. Fija (IDEAM_SMOKE_DATE) o, por
// defecto, "hace 30 días" respecto a hoy: suficientemente atrás para que el
// dato ya esté publicado en Socrata, y se recalcula solo en cada corrida en vez
// de envejecer como una fecha hardcodeada.
function fechaSmokeDefault(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}
const SMOKE_DATE = process.env.IDEAM_SMOKE_DATE || fechaSmokeDefault();

test('production IDEAM flow returns catalog, creates a job, and downloads a complete zip', async ({ request }) => {
  const root = await request.get('/');
  await expect(root).toBeOK();
  expect(root.headers()['content-type']).toContain('text/html');
  expect(await root.text()).toContain('<div id="root">');

  const health = await request.get('/api/health');
  await expect(health).toBeOK();
  // /api/health (proxeado a la API del box) devuelve { ok, time } — sin 'service'.
  const healthBody = await health.json();
  expect(healthBody).toMatchObject({ ok: true });
  expect(typeof healthBody.time).toBe('string');

  const meta = await request.get('/api/meta');
  await expect(meta).toBeOK();
  const metaBody = await meta.json();
  expect(metaBody.datasets.map((dataset: { id: string }) => dataset.id)).toContain(DATASET_ID);
  expect(metaBody.departments).toContain(DEPARTMENT);

  let catalogBody: { rows: Array<{ municipio?: string; codigoestacion?: string }> } = { rows: [] };
  for (let attempt = 0; attempt < 12 && catalogBody.rows.length === 0; attempt += 1) {
    const catalog = await request.post('/api/catalog-bundle', {
      data: { datasetId: DATASET_ID, departments: [DEPARTMENT] },
    });
    await expect(catalog).toBeOK();
    catalogBody = await catalog.json();
    if (catalogBody.rows.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
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
    startDate: SMOKE_DATE,
    endDate: SMOKE_DATE,
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
