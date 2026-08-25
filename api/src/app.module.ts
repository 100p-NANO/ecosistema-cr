import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { NuevosModule } from './nuevos/nuevos.module';

@Module({ imports: [DbModule, NuevosModule] })
export class AppModule {}
