import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { NuevosModule } from './nuevos/nuevos.module';
import { SesionModule } from './sesion/sesion.module';
import { OrganizacionModule } from './organizacion/organizacion.module';
import { PersonasModule } from './personas/personas.module';
import { IdentidadModule } from './identidad/identidad.module';
import { AportesModule } from './aportes/aportes.module';

/**
 * ⭐ De UN módulo a SEIS. Hasta el 15 de septiembre de 2026 la API cubría
 * solo Nuevos, así que el Control Tower no tenía con qué hablar y vivía
 * en localStorage. Estos son los módulos del núcleo: sesión, organización,
 * personas (con su ficha 360), identidad y aportes.
 */
@Module({
  imports: [DbModule, SesionModule, OrganizacionModule, PersonasModule,
            IdentidadModule, AportesModule, NuevosModule],
})
export class AppModule {}
