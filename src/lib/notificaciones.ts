import 'server-only';
import { db } from './db';
import { enviarPush } from './push';

export type TipoNotif =
  | 'reserva_nueva' | 'sin_confirmar' | 'auto_cancelacion' | 'bloqueo'
  | 'cancelo_paciente' | 'cuota_vencida' | 'reprogramacion' | 'atencion_humana'
  | 'correccion';

const TITULOS: Record<TipoNotif, string> = {
  reserva_nueva: 'Nueva reserva',
  sin_confirmar: 'Cita sin confirmar',
  auto_cancelacion: 'Cita cancelada automáticamente',
  bloqueo: 'Agenda bloqueada',
  cancelo_paciente: 'Un paciente canceló',
  cuota_vencida: 'Cuota vencida',
  reprogramacion: 'Cita reprogramada',
  atencion_humana: 'Un paciente necesita atención',
  correccion: 'Piden una corrección',
};

export function notificar(tipo: TipoNotif, mensaje: string, enlace?: string) {
  db.prepare('INSERT INTO notificaciones (tipo, mensaje, enlace) VALUES (?,?,?)')
    .run(tipo, mensaje, enlace ?? null);

  // El aviso al teléfono va aparte y sin esperarlo: si el push falla o tarda,
  // la reserva ya quedó guardada y la campanita del panel ya tiene la novedad.
  void enviarPush(TITULOS[tipo] ?? 'Consultorio', mensaje, enlace).catch(() => {});
}

/** Las notificaciones de cuota vencida llevan montos: se esconden a quien no ve cuentas. */
const FILTRO_DINERO = "tipo <> 'cuota_vencida'";

export function noLeidas(verDinero = true): number {
  const sql = `SELECT COUNT(*) c FROM notificaciones WHERE leida = 0${verDinero ? '' : ` AND ${FILTRO_DINERO}`}`;
  return (db.prepare(sql).get() as { c: number }).c;
}

export function ultimas(limite = 30, verDinero = true) {
  const sql = `SELECT * FROM notificaciones${verDinero ? '' : ` WHERE ${FILTRO_DINERO}`} ORDER BY id DESC LIMIT ?`;
  return db.prepare(sql).all(limite) as
    { id: number; tipo: string; mensaje: string; enlace: string | null; leida: number; fecha: string }[];
}

export function marcarTodasLeidas() {
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE leida = 0').run();
}
