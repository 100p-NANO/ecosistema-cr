import { BadRequestException, Controller, Get, Module, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion } from '../comun/identidad.helper';

/**
 * El modelo del Drive «Sistema 100p», por HTTP y con SUS nombres.
 *
 * Jhon construye el frontend contra sus documentos (Usuarios v1.2, Roles,
 * Nuevos, Donaciones). Esta ruta le entrega esas mismas tablas leyendo la
 * base real: `GET /api/v1/modelo100p/personas`, `/donaciones`, `/usuario_roles`…
 *
 * ⛔ Solo lectura, y solo las 15 tablas de la lista: el nombre nunca se
 *    interpola sin pasar por ella. La sede y el nivel los pone la RLS,
 *    igual que en el resto de la API.
 */
const TABLAS = new Set([
  'personas', 'vinculos_personas', 'auditoria_personas', 'menores', 'minores',
  'roles', 'usuario_roles', 'permisos_por_rol', 'auditoria_roles',
  'nuevos_registros', 'contactos_nuevos', 'seguimiento_nuevos', 'integracion_personas',
  'donaciones', 'certificados', 'auditoria_donaciones',
]);

@Controller('api/v1/modelo100p')
export class Modelo100pController {
  constructor(private readonly db: DbService) {}

  @Get()
  tablas() {
    return { tablas: [...TABLAS], origen: 'Drive «Sistema 100p Casa Roca Global»', solo_lectura: true };
  }

  @Get(':tabla')
  leer(@Req() req: Request, @Param('tabla') tabla: string,
       @Query('limite') limite?: string, @Query('desde') desde?: string) {
    if (!TABLAS.has(tabla)) throw new BadRequestException(`«${tabla}» no es una tabla del modelo 100p.`);
    const lim = Math.min(Number(limite) || 100, 1000);
    const off = Math.max(Number(desde) || 0, 0);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM modelo100p.${tabla} LIMIT $1 OFFSET $2`, [lim, off]);
      return { tabla, desde: off, filas: rows.length, datos: rows };
    });
  }
}

@Module({ imports: [DbModule], controllers: [Modelo100pController] })
export class Modelo100pModule {}
