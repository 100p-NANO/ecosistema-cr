import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { NuevosService } from './nuevos.service';
import { DbService } from '../db/db.service';
import { almacen } from '../contexto/contexto';
import type { RegistrarNuevo, RegistrarContacto, ConvertirMiembro } from './dto';

/**
 * Rutas del Módulo de Nuevos.
 * Son EXACTAMENTE las cinco que especificó el equipo 100p en su
 * documento M-Nuevos: el contrato es suyo porque construyen el frontend;
 * la garantía es nuestra porque vive en la base.
 */
@Controller('api/v1/nuevos')
export class NuevosController {
  constructor(private readonly nuevos: NuevosService, private readonly db: DbService) {}

  /** 1 · Público. Sin autenticación (el reCAPTCHA lo valida el borde). */
  @Post('registrar')
  registrar(@Body() datos: RegistrarNuevo, @Req() req: Request) {
    return this.nuevos.registrar(datos, ip(req));
  }

  /** 2 · Tablero del coordinador. */
  @Get('dashboard')
  dashboard(@Req() req: Request, @Query('estado') estado?: string, @Query('limite') limite?: string) {
    return this.conIdentidad(req, () => this.nuevos.dashboard(estado, Number(limite) || 50));
  }

  /** 3 · Registrar un contacto. */
  @Post(':id/registrar-contacto')
  contacto(@Req() req: Request, @Param('id') id: string, @Body() datos: RegistrarContacto) {
    return this.conIdentidad(req, () => this.nuevos.registrarContacto(id, datos));
  }

  /** 4 · Convertir en miembro. */
  @Post(':id/convertir-miembro')
  convertir(@Req() req: Request, @Param('id') id: string, @Body() datos: ConvertirMiembro) {
    return this.conIdentidad(req, () => this.nuevos.convertirMiembro(id, datos ?? {}));
  }

  /** 5 · Historial completo. */
  @Get(':id/historial')
  historial(@Req() req: Request, @Param('id') id: string) {
    return this.conIdentidad(req, () => this.nuevos.historial(id));
  }

  /**
   * Resuelve la identidad y deja el contexto disponible para el servicio.
   *
   * ⚠️ SUPLENTE DE DESARROLLO. Hoy la identidad llega en una cabecera; en
   * producción llega en el token de Keycloak. Lo único que cambia es esta
   * función: el resto del sistema ya trabaja contra el contexto, no contra
   * la cabecera. El punto de sustitución está aislado a propósito.
   *
   * Nótese que las sedes y el nivel NO vienen del cliente: se derivan de
   * las asignaciones vigentes en la base. Si vinieran de la petición,
   * cualquiera podría pedir ver otra sede.
   */
  private async conIdentidad<T>(req: Request, fn: () => Promise<T>): Promise<T> {
    const personaId = req.header('X-Persona-Id');
    if (!personaId) {
      throw new UnauthorizedException(
        'Falta la identidad de la sesión. En desarrollo va en X-Persona-Id; ' +
        'en producción, en el token de Keycloak.',
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
