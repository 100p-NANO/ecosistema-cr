import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { NuevosModule } from './nuevos/nuevos.module';
import { SesionModule } from './sesion/sesion.module';
import { OrganizacionModule } from './organizacion/organizacion.module';
import { PersonasModule } from './personas/personas.module';
import { IdentidadModule } from './identidad/identidad.module';
import { AportesModule } from './aportes/aportes.module';
import { NotificacionesModule } from './notificaciones/notificaciones';
import { Modelo100pModule } from './modelo100p/modelo100p';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { SaludModule } from './salud/salud.module';
import { trazaYRegistro, cabecerasDeSeguridad } from './comun/peticion';

/**
 * ⭐ 19 sep 2026 · Entran AUTENTICACIÓN y SALUD, y toda petición pasa por
 * traza, cabeceras de seguridad y resolución de sesión. Hasta hoy la API
 * tenía nueve módulos de negocio y ninguna puerta.
 */
@Module({
  imports: [DbModule, AuthModule, SaludModule,
            SesionModule, OrganizacionModule, PersonasModule,
            IdentidadModule, AportesModule, NuevosModule,
            NotificacionesModule, Modelo100pModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cabecerasDeSeguridad, trazaYRegistro, AuthMiddleware).forRoutes('*');
  }
}
