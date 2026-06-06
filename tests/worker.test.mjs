import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/worker/index.js';

const API_ORIGIN = 'https://ideam-api.sergiobc.com';

/**
 * Mockea el fetch global para capturar la request saliente que el Worker
 * construye hacia la API propia. Devuelve un helper para restaurarlo.
 */
function stubFetch() {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (request) => {
    // El Worker llama fetch(new Request(...)). Capturamos esa Request.
    calls.push(request);
    return new Response('upstream-ok', { status: 200 });
  };
  return {
    calls,
    restore() {
      global.fetch = original;
    },
  };
}

function createAssetsStub() {
  const calls = [];
  return {
    calls,
    fetch: async (request) => {
      calls.push(request);
      return new Response('asset-body', { status: 200 });
    },
  };
}

test('reenvia /api/* a env.API_ORIGIN conservando path y query, con secreto y cf-connecting-ip', async () => {
  const fetchStub = stubFetch();
  const assets = createAssetsStub();
  try {
    const env = {
      API_ORIGIN,
      IDEAM_PROXY_SECRET: 'super-secreto',
      ASSETS: assets,
    };
    const request = new Request('https://ideam.test/api/catalog-options?datasetId=s54a-sgyg&page=2', {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.7',
      },
    });

    const response = await worker.fetch(request, env);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'upstream-ok');

    // No debe tocar los assets para rutas /api.
    assert.equal(assets.calls.length, 0);

    assert.equal(fetchStub.calls.length, 1);
    const outgoing = fetchStub.calls[0];
    const outgoingUrl = new URL(outgoing.url);

    // Se reenvia al origen de la API conservando path + query.
    assert.equal(outgoingUrl.origin, API_ORIGIN);
    assert.equal(outgoingUrl.pathname, '/api/catalog-options');
    assert.equal(outgoingUrl.searchParams.get('datasetId'), 's54a-sgyg');
    assert.equal(outgoingUrl.searchParams.get('page'), '2');

    // Conserva el metodo.
    assert.equal(outgoing.method, 'GET');

    // Inyecta el secreto del proxy.
    assert.equal(outgoing.headers.get('x-ideam-proxy-secret'), 'super-secreto');

    // Propaga la IP real del cliente.
    assert.equal(outgoing.headers.get('cf-connecting-ip'), '203.0.113.7');

    // El host apunta al upstream, no al dominio publico.
    assert.equal(outgoing.headers.get('host'), new URL(API_ORIGIN).host);
  } finally {
    fetchStub.restore();
  }
});

test('reenvia la raiz exacta /api', async () => {
  const fetchStub = stubFetch();
  try {
    const env = { API_ORIGIN, ASSETS: createAssetsStub() };
    const response = await worker.fetch(new Request('https://ideam.test/api'), env);

    assert.equal(response.status, 200);
    assert.equal(fetchStub.calls.length, 1);
    assert.equal(new URL(fetchStub.calls[0].url).pathname, '/api');
  } finally {
    fetchStub.restore();
  }
});

test('sin IDEAM_PROXY_SECRET no inyecta el header del secreto', async () => {
  const fetchStub = stubFetch();
  try {
    const env = {
      API_ORIGIN,
      // IDEAM_PROXY_SECRET ausente a proposito.
      ASSETS: createAssetsStub(),
    };
    const request = new Request('https://ideam.test/api/health', {
      headers: { 'cf-connecting-ip': '198.51.100.4' },
    });

    const response = await worker.fetch(request, env);

    assert.equal(response.status, 200);
    assert.equal(fetchStub.calls.length, 1);
    const outgoing = fetchStub.calls[0];
    assert.equal(outgoing.headers.get('x-ideam-proxy-secret'), null);
    // La IP del cliente se sigue propagando aunque no haya secreto.
    assert.equal(outgoing.headers.get('cf-connecting-ip'), '198.51.100.4');
  } finally {
    fetchStub.restore();
  }
});

test('rutas no-/api se sirven desde env.ASSETS.fetch sin tocar el upstream', async () => {
  const fetchStub = stubFetch();
  const assets = createAssetsStub();
  try {
    const env = { API_ORIGIN, IDEAM_PROXY_SECRET: 'x', ASSETS: assets };
    const request = new Request('https://ideam.test/index.html');

    const response = await worker.fetch(request, env);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'asset-body');

    // Se delego a ASSETS y no se hizo proxy al upstream.
    assert.equal(assets.calls.length, 1);
    assert.equal(fetchStub.calls.length, 0);
    assert.equal(assets.calls[0].url, 'https://ideam.test/index.html');
  } finally {
    fetchStub.restore();
  }
});

test('una ruta que solo empieza con texto similar a api pero no /api va a ASSETS', async () => {
  const fetchStub = stubFetch();
  const assets = createAssetsStub();
  try {
    const env = { API_ORIGIN, ASSETS: assets };
    // "/apidocs" no debe tratarse como /api/*.
    const response = await worker.fetch(new Request('https://ideam.test/apidocs'), env);

    assert.equal(response.status, 200);
    assert.equal(assets.calls.length, 1);
    assert.equal(fetchStub.calls.length, 0);
  } finally {
    fetchStub.restore();
  }
});
