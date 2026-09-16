import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AportesController } from './aportes.controller';
import { AportesService } from './aportes.service';

@Module({ imports: [DbModule], controllers: [AportesController], providers: [AportesService] })
export class AportesModule {}
