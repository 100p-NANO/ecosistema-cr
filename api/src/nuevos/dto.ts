/** Lo que llega del formulario público de casaroca.org. */
export interface RegistroPublico {
  sede_codigo: string;
  primer_nombre: string;
  primer_apellido: string;
  segundo_nombre?: string;
  segundo_apellido?: string;
  email?: string;
  telefono?: string;
  fecha_nacimiento?: string;
  puerta_entrada?: string;
  /** Autorizaciones marcadas en el formulario, por canal. */
  autoriza?: Array<'email' | 'sms' | 'whatsapp' | 'llamada'>;
}

export interface RegistroContacto {
  tipo: 'LLAMADA' | 'VISITA_PASTORAL' | 'PRIMERA_VISITA';
  resumen: string;
  ocurrido_en?: string;
}

export interface CambioEtapa {
  etapa: 'conoce' | 'conectate' | 'crece' | 'sirve';
  nota?: string;
}
