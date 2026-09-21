import { BadRequestException, Body, Controller, Get, Header, Module, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { sesionDe, ipDe } from '../comun/identidad.helper';
import { limitarPorClave } from '../comun/limite';
import { htmlCertificado } from '../aportes/donaciones.service';
import { uuid, texto, textoOpcional, booleano, unoDe } from '../comun/validar';

const TIPOS_PETICION = ['consulta', 'reclamo', 'supresion', 'revocacion', 'actualizacion'] as const;

/**
 * El portal del congregante · `/api/v1/yo`.
 *
 * ⛔ La regla que lo hace seguro: ninguna ruta recibe el identificador de
 * una persona. Todo lo resuelve la base con la identidad de la sesión
 * (`portal.yo()`), así que no hay parámetro que cambiar para ver a otro.
 *
 * Y no pide sede: un miembro entra con alcance «persona propia», sin sede
 * asignada, y `conSesion` lo rechazaría. Aquí el contexto es la persona.
 */
function conmigo<T>(db: DbService, req: Request, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const s = sesionDe(req);
  return db.enTransaccion({ personaId: s.personaId, sedeIds: [], nivelMax: s.nivelMax,
                            alcanceGlobal: false, ip: ipDe(req), modulo: null }, fn);
}

/* Las fechas llegan de la base como texto «AAAA-MM-DD»; `new Date(texto)`
   las lee en UTC y en Bogotá caen el día anterior. Se arman en hora local. */
function fechaLocal(v: any): any {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const [a, m, d] = v.split('-').map(Number);
  return new Date(a, m - 1, d);
}

@Controller('api/v1/yo')
export class PortalController {
  constructor(private readonly db: DbService) {}

  @Get('resumen')
  resumen(@Req() req: Request) {
    return conmigo(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(`SELECT portal.mi_resumen() AS r`);
      return r.r;
    });
  }

  @Post('datos')
  datos(@Req() req: Request, @Body() b: any) {
    return conmigo(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(`SELECT portal.actualizar_mis_datos($1, $2, $3) AS r`,
        [textoOpcional(b?.email, 'email', { max: 160 }), textoOpcional(b?.telefono, 'telefono', { max: 20 }),
         textoOpcional(b?.direccion, 'direccion', { max: 200 })]);
      return { persona: r.r, mensaje: 'Sus datos quedaron actualizados.' };
    });
  }

  @Post('consentimientos')
  consentimiento(@Req() req: Request, @Body() b: any) {
    return conmigo(this.db, req, async (c) => {
      const otorgar = booleano(b?.otorgar, 'otorgar');
      await c.query(`SELECT portal.cambiar_mi_consentimiento($1, $2, $3)`,
        [unoDe(b?.canal, 'canal', ['email', 'whatsapp', 'sms', 'llamada'] as const),
         texto(b?.finalidad, 'finalidad', { min: 3, max: 40 }), otorgar]);
      return { otorgado: otorgar,
               mensaje: otorgar ? 'Listo: autorizó este tipo de mensaje por ese canal.'
                                : 'Listo: ya no le escribiremos por ese canal para eso. Queda registrado con la fecha de hoy.' };
    });
  }

  @Post('peticiones')
  peticion(@Req() req: Request, @Body() b: any) {
    limitarPorClave(`portal-peticion:${sesionDe(req).personaId}`, 5, 60 * 60_000,
      'Ya radicó varias peticiones en la última hora. Si es urgente, escríbale a su sede.');
    return conmigo(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(`SELECT portal.radicar_mi_peticion($1, $2) AS r`,
        [unoDe(b?.tipo, 'tipo', TIPOS_PETICION), texto(b?.detalle, 'detalle', { min: 15, max: 4000 })]);
      return { ...r.r, mensaje: `Su petición quedó radicada con el número ${r.r.radicado}. La ley nos da hasta el ${r.r.vence} para responderle.` };
    });
  }

  /** Todo lo que la iglesia tiene de usted (N1 y N2), en un archivo. */
  @Get('mis-datos')
  async misDatos(@Req() req: Request, @Res() res: Response) {
    const datos = await conmigo(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(`SELECT portal.mis_datos() AS r`);
      return r.r;
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-casaroca.json"');
    res.send(JSON.stringify(datos, null, 2));
  }

  @Get('certificados/:id/documento')
  @Header('Content-Type', 'text/html; charset=utf-8')
  certificado(@Req() req: Request, @Param('id') id: string) {
    return conmigo(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(`SELECT portal.mi_certificado($1) AS r`, [uuid(id, 'id')]);
      if (!r?.r) throw new NotFoundException('Ese certificado no existe o no es suyo.');
      const cert = Object.fromEntries(Object.entries(r.r.cert).map(([k, v]) => [k, fechaLocal(v)]));
      const detalle = (r.r.detalle ?? []).map((d: any) => ({ ...d, fecha_aporte: fechaLocal(d.fecha_aporte) }));
      return htmlCertificado(cert, r.r.persona, r.r.sede, detalle);
    });
  }
}

@Module({ imports: [DbModule], controllers: [PortalController] })
export class PortalModule {}
