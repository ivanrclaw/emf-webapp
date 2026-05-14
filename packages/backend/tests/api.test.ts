/**
 * @emf-webapp/backend — E2E Tests (cobertura completa de API)
 *
 * Usa SQLite en memoria (:memory:) para tests aislados.
 * Cubre CRUD de Projects, Metamodels, exportación y casos borde.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from '../src/modules/project/project.module.js';
import { MetamodelModule } from '../src/modules/metamodel/metamodel.module.js';
import { Project } from '../src/modules/project/project.entity.js';
import { Metamodel } from '../src/modules/metamodel/metamodel.entity.js';
import request from 'supertest';

let app: INestApplication;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [Project, Metamodel],
        synchronize: true,
      }),
      ProjectModule,
      MetamodelModule,
    ],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
}, 20000);

afterAll(async () => {
  await app?.close();
});

// ══════════════════════════════════════════════════
//  PROJECTS CRUD
// ══════════════════════════════════════════════════

describe('Projects API', () => {
  let projectId: string;

  it('GET /api/projects — lista vacía al inicio', async () => {
    const res = await request(app.getHttpServer()).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('POST /api/projects — crear proyecto', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .send({ name: 'Test Project', description: 'A test project' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Project');
    expect(res.body.description).toBe('A test project');
    projectId = res.body.id;
  });

  it('POST /api/projects — crear sin descripción', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .send({ name: 'Minimal' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Minimal');
  });

  it('POST /api/projects — falla sin nombre (empty object)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .send({});
    // Sin ValidationPipe con DTO, NestJS lo acepta pero 'name' será undefined
    // TypeORM lanzará error por NOT NULL
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET /api/projects — lista contiene proyecto creado', async () => {
    const res = await request(app.getHttpServer()).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((p: any) => p.name === 'Test Project')).toBe(true);
  });

  it('GET /api/projects/:id — obtener por ID', async () => {
    const res = await request(app.getHttpServer()).get(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Project');
  });

  it('GET /api/projects/:id — 404 para ID inexistente', async () => {
    const res = await request(app.getHttpServer()).get('/api/projects/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('PUT /api/projects/:id — actualizar nombre y descripción', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}`)
      .send({ name: 'Updated', description: 'New desc' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.description).toBe('New desc');
  });

  it('PUT /api/projects/:id — actualización parcial solo nombre', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}`)
      .send({ name: 'Partial Update' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Partial Update');
  });

  // ══════════════════════════════════════════════
  //  METAMODELS (anidados)
  // ══════════════════════════════════════════════

  describe('Metamodelos anidados bajo un proyecto', () => {
    let mmId: string;

    it('GET /api/projects/:pid/metamodels — lista vacía', async () => {
      const res = await request(app.getHttpServer()).get(`/api/projects/${projectId}/metamodels`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('POST /api/projects/:pid/metamodels — crear mínimo (solo name)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/metamodels`)
        .send({ name: 'MyModel' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('MyModel');
      // Debe auto-generar ns_uri y ns_prefix si no se proveen
      expect(res.body.ns_uri).toBe('http://mymodel.emf-webapp/1.0');
      expect(res.body.ns_prefix).toBe('mymodel');
      expect(res.body.content).toEqual({});
      mmId = res.body.id;
    });

    it('POST /api/projects/:pid/metamodels — crear con ns_uri/ns_prefix propios', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/metamodels`)
        .send({ name: 'Custom', nsURI: 'http://custom.com/2.0', nsPrefix: 'cust' });
      expect(res.status).toBe(201);
      expect(res.body.ns_uri).toBe('http://custom.com/2.0');
      expect(res.body.ns_prefix).toBe('cust');
    });

    it('POST /api/projects/:pid/metamodels — crear con contenido', async () => {
      const content = {
        eClassifiers: [
          { name: 'Person', eStructuralFeatures: [{ name: 'name', eType: 'EString' }] },
        ],
      };
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/metamodels`)
        .send({ name: 'WithContent', content });
      expect(res.status).toBe(201);
      expect(res.body.content).toEqual(content);
    });

    it('GET /api/projects/:pid/metamodels — lista con metamodelos', async () => {
      const res = await request(app.getHttpServer()).get(`/api/projects/${projectId}/metamodels`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      // Todos deben pertenecer al proyecto
      for (const mm of res.body) {
        expect(mm.project_id).toBe(projectId);
      }
    });

    it('GET /api/projects/:pid/metamodels/:mmid — obtener por ID', async () => {
      const res = await request(app.getHttpServer()).get(`/api/projects/${projectId}/metamodels/${mmId}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('MyModel');
    });

    it('GET /api/projects/:pid/metamodels/:mmid — 404 para ID inexistente', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/projects/${projectId}/metamodels/00000000-0000-0000-0000-000000000000`,
      );
      expect(res.status).toBe(404);
    });

    it('POST /api/projects/:pid/metamodels/:mmid/export — exportar a JSON', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/metamodels/${mmId}/export`)
        .send({ format: 'json' });
      expect(res.status).toBe(201);
      expect(res.body.format).toBe('json');
      expect(typeof res.body.content).toBe('string');
    });

    it('POST /api/projects/:pid/metamodels/:mmid/export — exportar a XMI', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/metamodels/${mmId}/export`)
        .send({ format: 'xmi' });
      expect(res.status).toBe(201);
      expect(res.body.format).toBe('xmi');
      expect(typeof res.body.content).toBe('string');
    });

    it('DELETE /api/projects/:pid/metamodels/:mmid — eliminar metamodelo', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/api/projects/${projectId}/metamodels/${mmId}`,
      );
      expect(res.status).toBe(200);

      const check = await request(app.getHttpServer()).get(
        `/api/projects/${projectId}/metamodels/${mmId}`,
      );
      expect(check.status).toBe(404);
    });
  });

  it('DELETE /api/projects/:id — eliminar proyecto', async () => {
    const res = await request(app.getHttpServer()).delete(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);

    const check = await request(app.getHttpServer()).get(`/api/projects/${projectId}`);
    expect(check.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════
//  EDGE CASES Y ESTRÉS
// ══════════════════════════════════════════════════

describe('Edge cases', () => {
  let pid: string;

  beforeAll(async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .send({ name: 'Edge Case Project' });
    pid = res.body.id;
  });

  it('crear metamodelo con caracteres especiales en nombre', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${pid}/metamodels`)
      .send({ name: 'My Cool Model!' });
    expect(res.status).toBe(201);
    expect(res.body.ns_prefix).toBe('my cool model!');
    expect(res.body.ns_uri).toContain('my-cool-model');
  });

  it('crear 3 metamodelos y luego eliminar todos', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${pid}/metamodels`)
        .send({ name: `Bulk${i}` });
      expect(res.status).toBe(201);
      ids.push(res.body.id);
    }

    // Verificar que están todos
    const listRes = await request(app.getHttpServer()).get(`/api/projects/${pid}/metamodels`);
    expect(listRes.body.length).toBeGreaterThanOrEqual(3);

    // Eliminar uno por uno
    for (const id of ids) {
      await request(app.getHttpServer()).delete(`/api/projects/${pid}/metamodels/${id}`);
    }

    // Verificar que ya no están
    const final = await request(app.getHttpServer()).get(`/api/projects/${pid}/metamodels`);
    const remaining = final.body.filter((m: any) => ids.includes(m.id));
    expect(remaining.length).toBe(0);
  });

  it('la entidad Project basic se serializa correctamente', async () => {
    const res = await request(app.getHttpServer()).get(`/api/projects/${pid}`);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('created_at');
    expect(res.body).toHaveProperty('updated_at');
    expect(typeof res.body.created_at).toBe('string');
  });

  it('la entidad Metamodel basic se serializa correctamente', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${pid}/metamodels`)
      .send({ name: 'SerializeCheck' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('ns_uri');
    expect(res.body).toHaveProperty('ns_prefix');
    expect(res.body).toHaveProperty('content');
    expect(res.body).toHaveProperty('project_id');
  });
});
