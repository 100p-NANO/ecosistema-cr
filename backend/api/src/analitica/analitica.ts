import { Controller, Get, Module, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { exigir } from '../comun/permiso';
import { uuidOpcional, entero } from '../comun/validar';

/**
 * Analítica · N2 · el tablero de la sede y de la red.
 *
 * ⛔ Las cifras por debajo de 5 salen como «<5»: un conteo de tres
 * personas identifica a las tres. Las funciones corren con el RLS de quien
 * pregunta, así que un pastor ve el tablero de su sede y la dirección el
 * de la red, sin que esta capa decida nada.
 */
@Controller('api/v1/analitica')
export class AnaliticaController {
  constructor(private readonly db: DbService) {}

  @Get('tablero')
  tablero(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver el tablero');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'analitica', 'ver');
      const { rows: [r] } = await c.query(`SELECT plataforma.tablero($1) AS t`, [uuidOpcional(q?.sede_id, 'sede_id')]);
      return r.t;
    });
  }
}

/**
 * «¿Quién se nos está perdiendo?» · la pregunta con la que empieza la
 * ficha de arquitectura. Vino al menos tres veces entre la semana 5 y la
 * 12 hacia atrás, y ninguna en las últimas cuatro. Es una lista de
 * PERSONAS para llamarlas, por eso vive en el CRM y no en la analítica.
 */
@Controller('api/v1/crm')
export class SePerdieronController {
  constructor(private readonly db: DbService) {}

  @Get('se-estan-perdiendo')
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver quién se está perdiendo');
    return conSesion(this.db, req, async (c) => {
      await exigir(c, 'crm', 'ver');
      const limite = q?.limite === undefined ? 100 : entero(q.limite, 'limite', { min: 1, max: 500 });
      const { rows } = await c.query(
        `SELECT persona_id, nombre, sede, veces_antes::int, to_char(ultima_vez,'YYYY-MM-DD') AS ultima_vez,
                CURRENT_DATE - ultima_vez AS dias_sin_venir, telefono
           FROM crm.se_estan_perdiendo($1, $2)`, [uuidOpcional(q?.sede_id, 'sede_id'), limite]);
      return {
        total_filas: rows.length, personas: rows,
        criterio: 'Vino al menos 3 veces entre hace 12 y hace 5 semanas, y ninguna en las últimas 4.',
        aviso: rows.length ? `${rows.length} persona(s) dejaron de venir. Una llamada esta semana cambia la historia.` : null,
      };
    });
  }
}

@Module({ imports: [DbModule], controllers: [AnaliticaController, SePerdieronController] })
export class AnaliticaModule {}
