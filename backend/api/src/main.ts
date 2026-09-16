import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function arrancar() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();

  /* ⛔ CORS, y con lista blanca, no con asterisco.
     El Control Tower se sirve desde otro puerto (5199 en local, Netlify
     en línea), así que el navegador bloquea la llamada sin esto. Pero un
     `origin: '*'` en una API que mueve datos N3 y N4 significa que
     CUALQUIER página abierta en el navegador de un pastor podría
     llamarla con su sesión. Los orígenes se declaran. */
  const permitidos = (process.env.CORS_ORIGENES ??
    'http://127.0.0.1:5199,http://localhost:5199,https://casaroca-system.netlify.app')
    .split(',').map(x => x.trim()).filter(Boolean);
  app.enableCors({
    origin: permitidos,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Persona-Id'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });
  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  new Logger('CasaRoca').log(
    `API escuchando en :${puerto} · base ${process.env.PGDATABASE ?? 'casaroca_dev'} ` +
    `como ${process.env.PGUSER ?? 'casaroca_app'}`,
  );
}
arrancar();
