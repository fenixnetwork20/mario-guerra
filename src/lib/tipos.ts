export type Rol = 'recepcion' | 'doctor';

export type Usuario = {
  id: number; email: string; nombre: string; rol: Rol; activo: number;
};

export type EstadoCita =
  | 'reservada' | 'confirmada' | 'cancelada' | 'reprogramada' | 'completada' | 'no_asistio';

export type Cita = {
  id: number;
  paciente_id: number;
  tipo: 'valoracion' | 'cirugia' | 'revision';
  modalidad: 'presencial' | 'online' | null;
  fecha_hora: string;
  duracion: number;
  estado: EstadoCita;
  origen: 'link' | 'manual';
  token_gestion: string;
  motivo_cancelacion: string | null;
  procedimiento_interes: string | null;
  notas: string | null;
  cirugia_id: number | null;
  revision_id: number | null;
  r1_enviado_at: string | null;
  r2_enviado_at: string | null;
  /** El cobro de la consulta. El cupo no depende de esto: la cita ya está
   *  apartada aunque el pago siga por verificar. */
  pago_estado: 'pendiente' | 'verificado' | 'rechazado' | 'por_devolver' | 'devuelto';
  pago_monto_usd: number | null;
  pago_monto_bs: number | null;
  pago_tasa: number | null;
  pago_referencia: string | null;
  pago_archivo: string | null;
  pago_verificado_at: string | null;
  created_at: string;
};

export type Paciente = {
  id: number; nombre: string; cedula: string; whatsapp: string;
  edad: number | null; notas_medicas: string | null; created_at: string;
};

export type Cirugia = {
  id: number; paciente_id: number; procedimiento: string; fecha: string | null;
  precio_acordado: number; estado: 'programada' | 'realizada' | 'cancelada'; notas: string | null;
};

export type MetodoPago = 'zelle' | 'efectivo' | 'binance';

/** Estados que ocupan un cupo en la agenda. */
export const ESTADOS_ACTIVOS = ['reservada', 'confirmada', 'completada', 'no_asistio'] as const;
