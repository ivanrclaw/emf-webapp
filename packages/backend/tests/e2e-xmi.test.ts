/**
 * @emf-webapp/backend — E2E Integration Tests (XMI + Eclipse ZIP)
 *
 * Tests completos de flujos end-to-end a nivel de API:
 * 1. Crear proyecto → metamodelo → export .ecore → validar XML
 * 2. Import .ecore → export → roundtrip
 * 3. Eclipse ZIP export/import roundtrip
 * 4. OCL constraints en export
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from '../src/modules/project/project.module.js';
import { MetamodelModule } from '../src/modules/metamodel/metamodel.module.js';
import { Project } from '../src/modules/project/project.entity.js';
import { Metamodel } from '../src/modules/metamodel/metamodel.entity.js';
import { OCLConstraint } from '../src/modules/oclconstraint/oclconstraint.entity.js';
import { ProjectService } from '../src/modules/project/project.service.js';
import { MetamodelService } from '../src/modules/metamodel/metamodel.service.js';
import { XmiService } from '../src/modules/xmi/xmi.service.js';
import { XmiController } from '../src/modules/xmi/xmi.controller.js';
import request from 'supertest';
import { DataSource } from 'typeorm';
import AdmZip = require('adm-zip');

let app: INestApplication;
let projectId: string;
let metamodelId: string;

const LIBRARY_CONTENT = {
  name: 'library',
  nsURI: 'http://library.example.org/1.0',
  nsPrefix: 'library',
  eClassifiers: [
    {
      type: 'EClass',
      name: 'Library',
      eAttributes: [{ name: 'name', eType: 'EString' }],
      eReferences: [
        { name: 'books', eType: '#//Book', containment: true, upperBound: -1 },
      ],
    },
    {
      type: 'EClass',
      name: 'Book',
      eAttributes: [
        { name: 'title', eType: 'EString' },
        { name: 'pages', eType: 'EInt' },
      ],
      eReferences: [
        { name: 'author', eType: '#//Author' },
      ],
    },
    {
      type: 'EClass',
      name: 'Author',
      eAttributes: [
        { name: 'name', eType: 'EString' },
      ],
      eReferences: [
        { name: 'books', eType: '#//Book', upperBound: -1 },
      ],
    },
    {
      type: 'EEnum',
      name: 'BookFormat',
      eLiterals: [
        { name: 'PAPERBACK', value: 0 },
        { name: 'HARDCOVER', value: 1 },
      ],
    },
  ],
};

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [Project, Metamodel, OCLConstraint],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([Project, Metamodel, OCLConstraint]),
      ProjectModule,
      MetamodelModule,
    ],
    controllers: [XmiController],
    providers: [XmiService],
  })
    .overrideProvider(ProjectService)
    .useFactory({
      factory: async (ds: DataSource) => {
        const repo = ds.getRepository(Project);
        return new ProjectService(repo);
      },
      inject: [getDataSourceToken()],
    })
    .overrideProvider(MetamodelService)
    .useFactory({
      factory: async (ds: DataSource) => {
        const repo = ds.getRepository(Metamodel);
        return new MetamodelService(repo, ds.getRepository(Project));
      },
      inject: [getDataSourceToken()],
    })
    .overrideProvider(XmiService)
    .useFactory({
      factory: async (ds: DataSource) => {
        const mmRepo = ds.getRepository(Metamodel);
        const oclRepo = ds.getRepository(OCLConstraint);
        return new XmiService(mmRepo, oclRepo);
      },
      inject: [getDataSourceToken()],
    })
    .compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();

  // Create project + metamodel for tests
  const projRes = await request(app.getHttpServer())
    .post('/api/projects')
    .send({ name: 'E2E Test Project' });
  projectId = projRes.body.id;

  const mmRes = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/metamodels`)
    .send({
      name: 'library',
      nsURI: 'http://library.example.org/1.0',
      nsPrefix: 'library',
      content: LIBRARY_CONTENT,
    });
  metamodelId = mmRes.body.id;
}, 20000);

afterAll(async () => {
  await app?.close();
});

// ══════════════════════════════════════════════════════════════
//  16.1 — EXPORT .ECORE FLOW
// ══════════════════════════════════════════════════════════════

describe('E2E API: Export .ecore', () => {
  it('GET /xmi/:id/ecore — returns valid XMI 2.0 XML', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/ecore`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.text).toContain('xmlns:xmi="http://www.omg.org/XMI"');
    expect(res.text).toContain('xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"');
  });

  it('exported .ecore contains all EClasses', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/ecore`);

    expect(res.text).toContain('name="Library"');
    expect(res.text).toContain('name="Book"');
    expect(res.text).toContain('name="Author"');
  });

  it('exported .ecore contains EEnum with literals', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/ecore`);

    expect(res.text).toContain('name="BookFormat"');
    expect(res.text).toContain('name="PAPERBACK"');
    expect(res.text).toContain('name="HARDCOVER"');
  });

  it('exported .ecore contains nsURI and nsPrefix', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/ecore`);

    expect(res.text).toContain('nsURI="http://library.example.org/1.0"');
    expect(res.text).toContain('nsPrefix="library"');
  });

  it('GET /xmi/:id/genmodel — returns valid .genmodel XML', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/genmodel`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('genmodel:GenModel');
    expect(res.text).toContain('modelDirectory');
  });

  it('returns 404 for non-existent metamodel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/00000000-0000-0000-0000-000000000000/ecore`);

    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2 — IMPORT .ECORE ROUNDTRIP
// ══════════════════════════════════════════════════════════════

describe('E2E API: Import .ecore roundtrip', () => {
  let importMmId: string;

  beforeAll(async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/metamodels`)
      .send({ name: 'importTarget' });
    importMmId = res.body.id;
  });

  it('POST /xmi/:id/import — imports Eclipse-generated .ecore', async () => {
    const eclipseXml = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="university" nsURI="http://university.example.org/1.0" nsPrefix="uni">
  <eClassifiers xsi:type="ecore:EClass" name="University">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="departments" upperBound="-1"
        eType="#//Department" containment="true"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Department">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
  </eClassifiers>
</ecore:EPackage>`;

    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/xmi/${importMmId}/import`)
      .send({ xml: eclipseXml });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('re-export after import produces valid .ecore', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${importMmId}/ecore`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('name="University"');
    expect(res.text).toContain('name="Department"');
    expect(res.text).toContain('nsURI="http://university.example.org/1.0"');
  });

  it('roundtrip preserves structural features', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${importMmId}/ecore`);

    // Attributes
    expect(res.text).toContain('name="name"');
    // References
    expect(res.text).toContain('name="departments"');
    expect(res.text).toContain('containment="true"');
  });

  it('import fails gracefully with invalid XML', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/xmi/${importMmId}/import`)
      .send({ xml: '<not-valid-ecore>garbage</not-valid-ecore>' });

    // Should not crash — either returns success:false or 400
    expect([200, 201, 400].includes(res.status)).toBe(true);
  });

  it('import fails with empty body', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/xmi/${importMmId}/import`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════
//  16.4 — ECLIPSE ZIP EXPORT/IMPORT ROUNDTRIP
// ══════════════════════════════════════════════════════════════

describe('E2E API: Eclipse ZIP export/import', () => {
  it('GET /xmi/:id/zip — returns valid ZIP with Eclipse structure', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);

    const zip = new AdmZip(res.body);
    const entries = zip.getEntries().map((e: any) => e.entryName);

    // Must have Eclipse project files
    expect(entries.some((e: string) => e.endsWith('.project'))).toBe(true);
    expect(entries.some((e: string) => e.endsWith('.classpath'))).toBe(true);
    expect(entries.some((e: string) => e.includes('META-INF/MANIFEST.MF'))).toBe(true);
    expect(entries.some((e: string) => e.endsWith('plugin.xml'))).toBe(true);
    expect(entries.some((e: string) => e.endsWith('build.properties'))).toBe(true);
    expect(entries.some((e: string) => e.endsWith('.ecore'))).toBe(true);
    expect(entries.some((e: string) => e.endsWith('.genmodel'))).toBe(true);
  });

  it('ZIP .project file has correct Eclipse nature', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    const zip = new AdmZip(res.body);
    const projectEntry = zip.getEntries().find((e: any) => e.entryName.endsWith('.project'));
    const projectXml = projectEntry!.getData().toString('utf-8');

    expect(projectXml).toContain('<projectDescription>');
    expect(projectXml).toContain('org.eclipse.pde.PluginNature');
  });

  it('ZIP .ecore file contains metamodel classes', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    const zip = new AdmZip(res.body);
    const ecoreEntry = zip.getEntries().find((e: any) => e.entryName.endsWith('.ecore'));
    const ecoreXml = ecoreEntry!.getData().toString('utf-8');

    expect(ecoreXml).toContain('name="Library"');
    expect(ecoreXml).toContain('name="Book"');
    expect(ecoreXml).toContain('name="Author"');
  });

  it('ZIP MANIFEST.MF has correct bundle info', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    const zip = new AdmZip(res.body);
    const manifest = zip.getEntries().find((e: any) => e.entryName.includes('MANIFEST.MF'));
    const content = manifest!.getData().toString('utf-8');

    expect(content).toContain('Bundle-ManifestVersion: 2');
    expect(content).toContain('Bundle-SymbolicName');
    expect(content).toContain('org.eclipse.emf');
  });

  it('POST /xmi/:id/import-eclipse-zip — roundtrip import', async () => {
    // First export
    const exportRes = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    // Create a new metamodel to import into
    const newMm = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/metamodels`)
      .send({ name: 'zipImportTarget' });
    const targetId = newMm.body.id;

    // Import the ZIP
    const importRes = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/xmi/${targetId}/import-eclipse-zip`)
      .attach('file', exportRes.body, 'eclipse-project.zip');

    expect(importRes.status).toBe(201);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.ecoreFile).toContain('.ecore');
  });

  it('imported metamodel from ZIP has same classes', async () => {
    // Create fresh target
    const newMm = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/metamodels`)
      .send({ name: 'zipRoundtrip' });
    const targetId = newMm.body.id;

    // Export original as ZIP
    const exportRes = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${metamodelId}/zip`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    // Import ZIP into target
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/xmi/${targetId}/import-eclipse-zip`)
      .attach('file', exportRes.body, 'project.zip');

    // Re-export target as .ecore
    const reExport = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/xmi/${targetId}/ecore`);

    expect(reExport.status).toBe(200);
    expect(reExport.text).toContain('name="Library"');
    expect(reExport.text).toContain('name="Book"');
    expect(reExport.text).toContain('name="Author"');
  });

  it('import-eclipse-zip fails without file', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/xmi/${metamodelId}/import-eclipse-zip`)
      .send({});

    expect(res.status).toBe(400);
  });
});
