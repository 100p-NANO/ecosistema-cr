import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IdentidadService } from './identidad.service';
import { DbService } from '../db/db.service';
import { conSesion } from '../comun/identidad.helper';

@Controller('api/v1/identidad')
export class IdentidadController {
  constructor(private readonly id: IdentidadService, private readonly db: DbService) {}

  @Get('roles')   roles(@Req() r: Request)   { return conSesion(this.db, r, c => this.id.roles(c)); }
  @Get('modulos') modulos(@Req() r: Request) { return conSesion(this.db, r, c => this.id.modulos(c)); }
  @Get('matriz')  matriz(@Req() r: Request)  { return conSesion(this.db, r, c => this.id.matriz(c)); }

  @Get('personas/:id/asignaciones')
  asignaciones(@Req() r: Request, @Param('id') id: string) {
    return conSesion(this.db, r, c => this.id.asignacionesDe(c, id));
  }

  /** Qué módulos alcanza de verdad esta persona hoy. */
  @Get('personas/:id/efectivo')
  efectivo(@Req() r: Request, @Param('id') id: string) {
    return conSesion(this.db, r, c => this.id.efectivo(c, id));
  }

  @Post('personas/:id/otorgar')
  otorgar(@Req() r: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, r, c => this.id.otorgar(c, id, d?.roles ?? d));
  }

  @Delete('asignaciones/:id')
  cerrar(@Req() r: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, r, c => this.id.cerrar(c, id, d?.hasta));
  }

  /* casillas */
  @Get('atributos')  atributos(@Req() r: Request) { return conSesion(this.db, r, c => this.id.atributos(c)); }
  @Post('atributos') crear(@Req() r: Request, @Body() d: any) {
    return conSesion(this.db, r, c => this.id.crearAtributo(c, d));
  }
}
