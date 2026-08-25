import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { NuevosService } from './nuevos.service';
import { DbService } from '../db/db.service';
import { almacen } from '../contexto/contexto';
import type { RegistroPublico, RegistroContacto, CambioEtapa } from './dto';

@Controller()
export class NuevosController {
  constructor(private readonly nuevos: NuevosService, private readonly db: DbService) {}

  /** 1 · Puerta pública. Sin identidad. */
  @Post('publico/registro')
  registro(@Body() datos: RegistroPublico, @Req() req: Request) {
    return this.nuevos.registrar(datos, ip(req));
  }

  /** 2 · Bandeja de nuevos de mi sede. */
  @Get('nuevos')
  async listar(@Req() req: Request, @Query('limite') limite?: string) {
    return this.conIdentidad(req, () => this.nuevos.listar(Number(limite) || 50));
  }

  /** 3 · Ficha 360. */
  @Get('nuevos/:id')
  async ficha(@Req() req: Request, @Param('id') id: string) {
    return this.conIdentidad(req, () => this.nuevos.ficha(id));
  }

  /** 4 · Registrar un contacto de seguimiento. */
  @Post('nuevos/:id/contacto')
  async contacto(@Req() req: Request, @Param('id') id: string, @Body() datos: RegistroContacto) {
    return this.conIdentidad(req, () => this.nuevos.registrarContacto(id, datos));
  }

  /** 5 · Avanzar en el recorrido 4C. */
  @Post('nuevos/:id/etapa')
  async etapa(@Req() req: Request, @Param('id') id: string, @Body() datos: CambioEtapa) {
    return this.conIdentidad(req, () => this.nuevos.cambiarEtapa(id, datos));
  }

  /**
   * Resuelve la identidad y deja el contexto disponible para el servicio.
   *
   * ⚠️ SUPLENTE DE DESARROLLO. Hoy la identidad llega en una cabecera.
   * En producción llega en el token de Keycloak, y lo único que cambia
   * es esta función: el resto del sistema ya trabaja contra el contexto,
   * no contra la cabecera. Es el punto de sustitución, y está aislado a
   * propósito para que se vea.
   */
  private async conIdentidad<T>(req: Request, fn: () => Promise<T>): Promise<T> {
    const personaId = req.header('X-Persona-Id');
    if (!personaId) {
      throw new UnauthorizedException(
        'Falta la identidad de la sesión. En desarrollo se envía en X-Persona-Id; ' +
        'en producción viene en el token de Keycloak.',
      );
    }
    const ctx = await this.db.contextoDe(personaId, ip(req));
    return almacen.run(ctx, fn);
  }
}

function ip(req: Request): string | null {
  const x = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return x || req.socket.remoteAddress || null;
}
