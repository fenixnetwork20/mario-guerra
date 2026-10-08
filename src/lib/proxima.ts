import 'server-only';
import { db } from './db';
import { notificar } from './notificaciones';
import { ahoraVET, sumarMinutos, hora12, soloHora } from './fechas';

/**
 * La cita que viene. Antes nadie se enteraba de que alguien estaba por llegar
 * (o por conectarse) hasta que el paciente escribía preguntando: así pasó con
 * dos videollamadas el 7 y el 8 de octubre.
 */
type CitaPago = {
  tipo: string; pago_estado: string; pago_metodo: string | null;
  pago_archivo: string | null; pago_referencia: string | null;
};

/** Verde o rojo: lo único que hace falta saber de un vistazo antes de atender. */
export function pagoListo(c: CitaPago): { ok: boolean; texto: string } {
  if (c.tipo === 'revision' || c.pago_estado === 'no_aplica') return { ok: true, texto: 'Control · no paga' };
  if (c.pago_estado === 'verificado') return { ok: true, texto: 'Pagado' };
  if (c.pago_metodo === 'efectivo') return { ok: false, texto: 'Efectivo · cobrar al llegar' };
  if (c.pago_archivo || c.pago_referencia) return { ok: false, texto: 'Pagó · falta verificar el pago' };
  return { ok: false, texto: 'No ha pagado' };
}

export type Proxima = CitaPago & {
  id: number; fecha_hora: string; duracion: number; modalidad: string | null;
  estado: string; paciente_id: number; paciente_nombre: string;
};

/** Citas que empiezan en la próxima hora o que están en curso ahora mismo. */
export function citasProximas(ahora = ahoraVET()): Proxima[] {
  const filas = db.prepare(
    `SELECT c.id, c.fecha_hora, c.duracion, c.modalidad, c.estado, c.tipo, c.paciente_id,
            c.pago_estado, c.pago_metodo, c.pago_archivo, c.pago_referencia,
            p.nombre AS paciente_nombre
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.estado IN ('reservada', 'confirmada')
        AND c.fecha_hora <= ? AND c.fecha_hora >= ?
      ORDER BY c.fecha_hora`
  ).all(sumarMinutos(ahora, 60), sumarMinutos(ahora, -240)) as Proxima[];
  // En curso = empezó y no ha terminado según su duración.
  return filas.filter((c) => sumarMinutos(c.fecha_hora, c.duracion) > ahora);
}

/**
 * Aviso al panel y al teléfono unos 30 minutos antes. El tick corre cada 15
 * minutos, así que la ventana es de 40: el aviso cae entre 25 y 40 minutos antes.
 */
export function avisarCitasProximas(ahora = ahoraVET()) {
  const filas = db.prepare(
    `SELECT c.id, c.fecha_hora, c.duracion, c.modalidad, c.estado, c.tipo, c.paciente_id,
            c.pago_estado, c.pago_metodo, c.pago_archivo, c.pago_referencia,
            p.nombre AS paciente_nombre
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.estado IN ('reservada', 'confirmada')
        AND c.aviso_previo_at IS NULL
        AND c.fecha_hora > ? AND c.fecha_hora <= ?`
  ).all(ahora, sumarMinutos(ahora, 40)) as Proxima[];

  for (const c of filas) {
    const min = Math.max(1, Math.round(
      (Date.parse(c.fecha_hora.replace(' ', 'T') + 'Z') - Date.parse(ahora.replace(' ', 'T') + 'Z')) / 60000
    ));
    const como = c.tipo === 'revision' ? 'control' : c.modalidad === 'online' ? 'videollamada' : 'presencial';
    notificar(
      'cita_proxima',
      `En ${min} min: ${c.paciente_nombre} · ${hora12(soloHora(c.fecha_hora))} · ${como} · ${pagoListo(c).texto}`,
      '/panel'
    );
    db.prepare('UPDATE citas SET aviso_previo_at = ? WHERE id = ?').run(ahora, c.id);
  }
  return filas.length;
}
