/**
 * @emf-webapp/backend — E2E Tests (comprehensive API coverage)
 *
 * Se ejecuta sobre el código COMPILADO (dist/).
 * CORRECCIÓN: antes de este test, ejecutar: pnpm build
 * Luego: node tests/run-api-tests.js
 *
 * Tests: Projects CRUD + Metamodels CRUD + Export + Edge Cases
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:3001/api';

let serverProcess;
let baseUrl = BASE;

/** Helper HTTP */
async function request(method, path, body) {
  const url = `${baseUrl}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, body: data };
}

function get(path) { return request('GET', path); }
function post(path, body) { return request('POST', path, body); }
function put(path, body) { return request('PUT', path, body); }
function del(path) { return request('DELETE', path); }

// ── Setup: compile + start server ────────────────────────────────

before(async () => {
  // Start the compiled server on port 3001
  serverProcess = fork(
    new URL('../dist/main.js', import.meta.url),
    [],
    {
      env: { ...process.env, PORT: '3001' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      execArgv: [],
    },
  );

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    try {
      await sleep(500);
      const res = await fetch('http://localhost:3001/api/projects', { method: 'GET' });
      if (res.ok || res.status === 200) return;
    } catch {
      // Server not ready yet
    }
  }
  throw new Error('Server did not start in time');
});

after(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

// ══════════════════════════════════════════════════
//  PROJECTS CRUD
// ══════════════════════════════════════════════════

describe('Projects API', () => {
  let projectId;

  it('GET /api/projects — lista vacía al inicio', async () => {
    const { status, body } = await get('/projects');
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.items, []);
    assert.strictEqual(body.total, 0);
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.limit, 20);
  });

  it('POST /api/projects — crear proyecto', async () => {
    const { status, body } = await post('/projects', {
      name: 'Test Project',
      description: 'A test project',
    });
    assert.strictEqual(status, 201);
    assert.ok(body.id);
    assert.strictEqual(body.name, 'Test Project');
    assert.strictEqual(body.description, 'A test project');
    projectId = body.id;
  });

  it('POST /api/projects — crear sin descripción', async () => {
    const { status, body } = await post('/projects', { name: 'Minimal' });
    assert.strictEqual(status, 201);
    assert.strictEqual(body.name, 'Minimal');
  });

  it('POST /api/projects — falla sin nombre', async () => {
    const { status } = await post('/projects', {});
    assert.ok(status >= 400);
  });

  it('GET /api/projects — lista contiene proyecto', async () => {
    const { status, body } = await get('/projects');
    assert.strictEqual(status, 200);
    assert.ok(body.total >= 1);
    assert.ok(body.items.some(p => p.name === 'Test Project'));
  });

  it('GET /api/projects/:id — obtener por ID', async () => {
    const { status, body } = await get(`/projects/${projectId}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(body.name, 'Test Project');
  });

  it('GET /api/projects/:id — 404 para ID inexistente', async () => {
    const { status } = await get('/projects/00000000-0000-0000-0000-000000000000');
    assert.strictEqual(status, 404);
  });

  it('PUT /api/projects/:id — actualizar', async () => {
    const { status, body } = await put(`/projects/${projectId}`, {
      name: 'Updated',
      description: 'New desc',
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.name, 'Updated');
    assert.strictEqual(body.description, 'New desc');
  });

  // ══════════════════════════════════════════════
  //  METAMODELS
  // ══════════════════════════════════════════════

  describe('Metamodelos anidados', () => {
    let mmId;

    it('GET /api/projects/:pid/metamodels — lista vacía', async () => {
      const { status, body } = await get(`/projects/${projectId}/metamodels`);
      assert.strictEqual(status, 200);
      assert.deepStrictEqual(body, []);
    });

    it('POST /api/projects/:pid/metamodels — crear mínimo (solo name)', async () => {
      const { status, body } = await post(`/projects/${projectId}/metamodels`, {
        name: 'MyModel',
      });
      assert.strictEqual(status, 201);
      assert.ok(body.id);
      assert.strictEqual(body.name, 'MyModel');
      // Debe auto-generar ns_uri y ns_prefix
      assert.strictEqual(body.ns_uri, 'http://mymodel.emf-webapp/1.0');
      assert.strictEqual(body.ns_prefix, 'mymodel');
      assert.deepStrictEqual(body.content, {});
      mmId = body.id;
    });

    it('POST /api/projects/:pid/metamodels — crear con ns_uri/ns_prefix propios', async () => {
      const { status, body } = await post(`/projects/${projectId}/metamodels`, {
        name: 'Custom',
        nsURI: 'http://custom.com/2.0',
        nsPrefix: 'cust',
      });
      assert.strictEqual(status, 201);
      assert.strictEqual(body.ns_uri, 'http://custom.com/2.0');
      assert.strictEqual(body.ns_prefix, 'cust');
    });

    it('GET /api/projects/:pid/metamodels — lista contiene metamodelos', async () => {
      const { status, body } = await get(`/projects/${projectId}/metamodels`);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(body));
      assert.ok(body.length >= 1);
      assert.strictEqual(body[0].project_id, projectId);
    });

    it('GET /api/projects/:pid/metamodels/:mmid — obtener por ID', async () => {
      const { status, body } = await get(`/projects/${projectId}/metamodels/${mmId}`);
      assert.strictEqual(status, 200);
      assert.strictEqual(body.name, 'MyModel');
    });

    it('GET /api/projects/:pid/metamodels/:mmid — 404 para ID inexistente', async () => {
      const { status } = await get(
        `/projects/${projectId}/metamodels/00000000-0000-0000-0000-000000000000`,
      );
      assert.strictEqual(status, 404);
    });

    it('POST /api/projects/:pid/metamodels/:mmid/export — exportar a JSON', async () => {
      const { status, body } = await post(
        `/projects/${projectId}/metamodels/${mmId}/export`,
        { format: 'json' },
      );
      assert.strictEqual(status, 201);
      assert.strictEqual(body.format, 'json');
      assert.strictEqual(typeof body.content, 'string');
    });

    it('POST /api/projects/:pid/metamodels/:mmid/export — exportar a XMI', async () => {
      const { status, body } = await post(
        `/projects/${projectId}/metamodels/${mmId}/export`,
        { format: 'xmi' },
      );
      assert.strictEqual(status, 201);
      assert.strictEqual(body.format, 'xmi');
      assert.strictEqual(typeof body.content, 'string');
    });

    it('DELETE /api/projects/:pid/metamodels/:mmid — eliminar metamodelo', async () => {
      const { status } = await del(`/projects/${projectId}/metamodels/${mmId}`);
      assert.strictEqual(status, 200);

      const { status: check } = await get(`/projects/${projectId}/metamodels/${mmId}`);
      assert.strictEqual(check, 404);
    });
  });

  it('DELETE /api/projects/:id — eliminar proyecto', async () => {
    const { status } = await del(`/projects/${projectId}`);
    assert.strictEqual(status, 200);

    const { status: check } = await get(`/projects/${projectId}`);
    assert.strictEqual(check, 404);
  });
});

// ══════════════════════════════════════════════════
//  EDGE CASES
// ══════════════════════════════════════════════════

describe('Edge cases', () => {
  let pid;

  before(async () => {
    const { body } = await post('/projects', { name: 'Edge Case Project' });
    pid = body.id;
  });

  it('crear metamodelo con caracteres especiales', async () => {
    const { status, body } = await post(`/projects/${pid}/metamodels`, {
      name: 'My Cool Model!',
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(body.ns_prefix, 'my cool model!');
    assert.ok(body.ns_uri.includes('my-cool-model'));
  });

  it('crear 3 metamodelos y eliminarlos todos', async () => {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const { status, body } = await post(`/projects/${pid}/metamodels`, {
        name: `Bulk${i}`,
      });
      assert.strictEqual(status, 201);
      ids.push(body.id);
    }

    const { body: list } = await get(`/projects/${pid}/metamodels`);
    assert.ok(list.length >= 3);

    for (const id of ids) {
      await del(`/projects/${pid}/metamodels/${id}`);
    }

    const { body: final } = await get(`/projects/${pid}/metamodels`);
    const remaining = final.filter(m => ids.includes(m.id));
    assert.strictEqual(remaining.length, 0);
  });

  it('entidad Project se serializa correctamente', async () => {
    const { status, body } = await get(`/projects/${pid}`);
    assert.strictEqual(status, 200);
    assert.ok(body.id);
    assert.ok(body.name);
    assert.ok(body.created_at);
    assert.ok(body.updated_at);
  });

  it('crear metamodelo y verificarlo completo', async () => {
    const { status, body } = await post(`/projects/${pid}/metamodels`, {
      name: 'SerializeCheck',
    });
    assert.strictEqual(status, 201);
    assert.ok(body.id);
    assert.strictEqual(body.name, 'SerializeCheck');
    assert.ok(body.ns_uri);
    assert.ok(body.ns_prefix);
    assert.ok(body.project_id);
  });
});
