import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AportesService } from './aportes.service';
import { DbService } from '../db/db.service';
import { conSesion, ipDe } from '../comun/identidad.helper';

@Controller('api/v1/aportes')
export class AportesController {
  constructor(private readonly aportes: AportesService, private readonly db: DbService) {}

  /** ⛔ Pública: la llama PayU, no una persona. La firma es la puerta. */
  @Post('pasarela/webhook')
  webhook(@Body() cuerpo: any, @Req() req: Request) {
    return this.aportes.webhook(cuerpo, ipDe(req));
  }

  @Get('pagos-sin-dueno')
  sinDueno(@Req() req: Request) {
    return conSesion(this.db, req, (c) => this.aportes.sinDueno(c));
  }

  @Post('pagos/:id/emparejar')
  emparejar(@Req() req: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.aportes.emparejar(c, id, d?.personaId));
  }
}
