import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function arrancar() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();
  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  new Logger('CasaRoca').log(
    `API escuchando en :${puerto} · base ${process.env.PGDATABASE ?? 'casaroca_dev'} ` +
    `como ${process.env.PGUSER ?? 'casaroca_app'}`,
  );
}
arrancar();
