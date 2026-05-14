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
  const frontendDist = join(__dirname, '../../frontend/dist');
  if (existsSync(frontendDist)) {
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
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api`);
}
bootstrap();
