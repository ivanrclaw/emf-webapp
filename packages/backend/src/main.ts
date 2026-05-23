/**
 * @emf-webapp/backend — Entrypoint
 * Bootstrap de NestJS con puerto 3000 y prefijo global /api.
 * Sirve el frontend compilado como archivos estáticos.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Prefijo /api para todas las rutas REST
  app.setGlobalPrefix('api');

  // Servir frontend estático si existe
  const possiblePaths = [
    join(__dirname, '../../frontend/dist'),    // monorepo layout
    join(__dirname, '../frontend'),            // flat layout
    '/app/frontend',                           // docker flat layout
    join(__dirname, '../../../packages/frontend/dist'), // another monorepo layout
  ];
  const frontendDist = possiblePaths.find(p => existsSync(p));
  if (frontendDist) {
    app.use(express.static(frontendDist));
    // SPA fallback: cualquier ruta que no sea /api sirve index.html
    app.use((req: any, res: any, next: any) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(join(frontendDist, 'index.html'));
      } else {
        next();
      }
    });
    console.log(`Serving frontend from ${frontendDist}`);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on http://0.0.0.0:${port}/api`);

  // Attach Yjs WebSocket server to the HTTP server
  const { YjsCollaborationService } = await import('./modules/collaboration/yjs-collaboration.service.js');
  const yjsService = app.get(YjsCollaborationService);
  const httpServer = app.getHttpServer();
  yjsService.attachToServer(httpServer);
}
bootstrap();
