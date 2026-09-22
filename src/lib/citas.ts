import 'server-only';
import { db, cfgNum } from './db';
import { tokenNuevo, cupoDisponible } from './agenda';
import { enviarPlantilla, linkGestion } from './mensajeria';
import { notificar } from './notificaciones';
import { ahoraVET, fechaLarga, hora12, soloFecha, soloHora, sumarMinutos } from './fechas';
import type { Cita, Paciente } from './tipos';

export type DatosPaciente = {
  nombre: string; cedula: string; whatsapp: string; edad?: number | null;
};

/** Match por cédula: si ya existe se actualizan sus datos de contacto. */
export function buscarOCrearPaciente(d: DatosPaciente): Paciente {
  const cedula = d.cedula.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const ya = db.prepare('SELECT * FROM pacientes WHERE cedula = ?').get(cedula) as Paciente | undefined;
  if (ya) {
    db.prepare('UPDATE pacientes SET nombre = ?, whatsapp = ?, edad = COALESCE(?, edad) WHERE id = ?')
      .run(d.nombre.trim(), d.whatsapp.trim(), d.edad ?? null, ya.id);
    return db.prepare('SELECT * FROM pacientes WHERE id = ?').get(ya.id) as Paciente;
  }
  const id = Number(
    db.prepare('INSERT INTO pacientes (nombre, cedula, whatsapp, edad) VALUES (?,?,?,?)')
      .run(d.nombre.trim(), cedula, d.whatsapp.trim(), d.edad ?? null).lastInsertRowid
  );
  return db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id) as Paciente;
}

export type NuevaCita = {
  pacienteId: number;
  tipo: 'valoracion' | 'cirugia' | 'revision';
  modalidad?: 'presencial' | 'online' | null;
  fechaHora: string;
  duracion?: number;
  origen?: 'link' | 'manual';
  procedimientoInteres?: string | null;
  notas?: string | null;
  cirugiaId?: number | null;
  revisionId?: number | null;
};

export function crearCita(n: NuevaCita): Cita {
  const duracion = n.duracion ?? cfgNum('duracion_cita', 60);
  const token = tokenNuevo();
  const id = Number(
    db.prepare(
      `INSERT INTO citas
         (paciente_id, tipo, modalidad, fecha_hora, duracion, estado, origen,
          token_gestion, procedimiento_interes, notas, cirugia_id, revision_id)
       VALUES (?,?,?,?,?,'reservada',?,?,?,?,?,?)`
    ).run(
      n.pacienteId, n.tipo, n.modalidad ?? null, n.fechaHora, duracion,
      n.origen ?? 'manual', token, n.procedimientoInteres ?? null, n.notas ?? null,
      n.cirugiaId ?? null, n.revisionId ?? null
    ).lastInsertRowid
  );
  return db.prepare('SELECT * FROM citas WHERE id = ?').get(id) as Cita;
}

export function citaPorToken(token: string) {
  return db.prepare(
    `SELECT c.*, p.nombre AS paciente_nombre, p.cedula, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.token_gestion = ?`
  ).get(token) as (Cita & { paciente_nombre: string; cedula: string; whatsapp: string }) | undefined;
}

export function citaPorId(id: number) {
  return db.prepare(
    `SELECT c.*, p.nombre AS paciente_nombre, p.cedula, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.id = ?`
  ).get(id) as (Cita & { paciente_nombre: string; cedula: string; whatsapp: string }) | undefined;
}

export function confirmarCita(id: number): boolean {
  const r = db.prepare("UPDATE citas SET estado = 'confirmada' WHERE id = ? AND estado = 'reservada'").run(id);
  return r.changes > 0;
}

type OpcionesCancelar = {
  motivo: string;
  /** Plantilla de WhatsApp a disparar; null = no avisar (ej. el paciente canceló solo). */
  plantilla?: 'cancelacion' | 'bloqueo' | null;
  notificarInterno?: boolean;
  tipoNotif?: Parameters<typeof notificar>[0];
};

/**
 * Cancela una cita. El cupo se libera solo por dejar de estar en un estado activo;
 * en el bloqueo por emergencia el rango queda ocupado por el propio bloqueo.
 */
export async function cancelarCita(id: number, op: OpcionesCancelar): Promise<boolean> {
  const cita = citaPorId(id);
  if (!cita || cita.estado === 'cancelada') return false;

  db.prepare("UPDATE citas SET estado = 'cancelada', motivo_cancelacion = ? WHERE id = ?").run(op.motivo, id);

  if (op.plantilla) {
    await enviarPlantilla({
      clave: op.plantilla,
      pacienteId: cita.paciente_id,
      citaId: cita.id,
      destino: cita.whatsapp,
      variables: {
        nombre: cita.paciente_nombre,
        fecha: fechaLarga(soloFecha(cita.fecha_hora)),
        hora: hora12(soloHora(cita.fecha_hora)),
        link: linkGestion(cita.token_gestion),
      },
    });
  }
  if (op.notificarInterno !== false) {
    // La plata no se queda en el limbo: la cita cancelada queda marcada por
    // devolver y no se pierde de vista hasta que alguien la devuelva de verdad.
    if (cita.pago_monto_usd != null && !['devuelto', 'por_devolver'].includes(cita.pago_estado)) {
      db.prepare("UPDATE citas SET pago_estado = 'por_devolver' WHERE id = ?").run(id);
    }

    const traiaPago = cita.pago_monto_usd != null
      ? ` — hay que devolverle ${cita.pago_monto_usd} $${cita.pago_estado === 'verificado' ? '' : ' (el pago no estaba verificado: confirma que entró antes de devolver)'}`
      : '';
    notificar(
      op.tipoNotif ?? 'auto_cancelacion',
      `Cita cancelada — ${cita.paciente_nombre}, ${fechaLarga(soloFecha(cita.fecha_hora))} ${hora12(soloHora(cita.fecha_hora))} (${op.motivo})${traiaPago}`,
      `/panel/pacientes/${cita.paciente_id}`
    );
  }
  return true;
}

/**
 * Citas cuya hora ya pasó y que nadie cerró. Importan por plata: el cargo de la
 * consulta solo nace al marcarla completada, así que una cita que se queda
 * abierta es un ingreso que nunca entra en la contabilidad.
 */
export function citasPorCerrar(limite = 30) {
  return db.prepare(
    `SELECT c.*, p.nombre AS paciente_nombre, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.estado IN ('reservada', 'confirmada') AND c.fecha_hora < ?
      ORDER BY c.fecha_hora DESC
      LIMIT ?`
  ).all(ahoraVET(), limite) as Array<Cita & { paciente_nombre: string; whatsapp: string }>;
}

/** Marca la vieja como reprogramada y crea la nueva conservando los datos. */
export function reprogramarCita(citaId: number, nuevaFechaHora: string): Cita | null {
  const vieja = citaPorId(citaId);
  if (!vieja) return null;
  if (!cupoDisponible(nuevaFechaHora, vieja.duracion, citaId)) return null;

  return db.transaction(() => {
    db.prepare("UPDATE citas SET estado = 'reprogramada' WHERE id = ?").run(citaId);
    const nueva = crearCita({
      pacienteId: vieja.paciente_id,
      tipo: vieja.tipo,
      modalidad: vieja.modalidad,
      fechaHora: nuevaFechaHora,
      duracion: vieja.duracion,
      origen: vieja.origen,
      procedimientoInteres: vieja.procedimiento_interes,
      notas: vieja.notas,
      cirugiaId: vieja.cirugia_id,
      revisionId: vieja.revision_id,
    });
    // El pago viaja con el paciente. Sin esto la cita nueva nacía en cero y al
    // que ya había pagado su consulta se le cobraba otra vez por mover la fecha.
    if (nueva && vieja.pago_monto_usd != null) {
      db.prepare(
        `UPDATE citas SET pago_estado = ?, pago_monto_usd = ?, pago_monto_bs = ?, pago_tasa = ?,
                          pago_referencia = ?, pago_archivo = ?, pago_verificado_at = ?
          WHERE id = ?`
      ).run(
        vieja.pago_estado, vieja.pago_monto_usd, vieja.pago_monto_bs, vieja.pago_tasa,
        vieja.pago_referencia, vieja.pago_archivo, vieja.pago_verificado_at, nueva.id
      );
      // Y se suelta de la vieja, que ya no lo sostiene: si no, el mismo dinero
      // aparecía dos veces en la agenda.
      db.prepare(
        `UPDATE citas SET pago_estado = 'pendiente', pago_monto_usd = NULL, pago_monto_bs = NULL,
                          pago_tasa = NULL, pago_referencia = NULL, pago_archivo = NULL,
                          pago_verificado_at = NULL,
                          notas = TRIM(COALESCE(notas, '') || ?)
          WHERE id = ?`
      ).run(`\nPago trasladado a la cita del ${nuevaFechaHora}.`, citaId);
    }

    notificar(
      'reprogramacion',
      `Cita reprogramada — ${vieja.paciente_nombre}: ${vieja.fecha_hora} → ${nuevaFechaHora}`
        + (vieja.pago_monto_usd != null ? ` (el pago de ${vieja.pago_monto_usd} $ se movió con ella)` : ''),
      `/panel/agenda?fecha=${soloFecha(nuevaFechaHora)}`
    );
    return nueva;
  })();
}

/** Cierra la valoración y deja el cargo de la consulta (una sola vez por cita). */
export function marcarCompletada(citaId: number) {
  const cita = citaPorId(citaId);
  if (!cita) return;
  db.prepare("UPDATE citas SET estado = 'completada' WHERE id = ?").run(citaId);
  if (cita.tipo !== 'valoracion') return;

  const ya = db.prepare('SELECT id FROM cargos WHERE cita_id = ?').get(citaId);
  if (ya) return;
  const precio = cfgNum(
    cita.modalidad === 'online' ? 'precio_consulta_online' : 'precio_consulta_presencial',
    cita.modalidad === 'online' ? 30 : 50
  );
  if (precio > 0) {
    db.prepare('INSERT INTO cargos (paciente_id, cita_id, concepto, monto, fecha) VALUES (?,?,?,?,?)')
      .run(cita.paciente_id, citaId,
           `Consulta de valoración (${cita.modalidad ?? 'presencial'})`, precio, soloFecha(cita.fecha_hora));
  }
}

/**
 * Bloqueo por emergencia: el rango queda ocupado (el cupo NO se libera) y a cada
 * paciente afectado se le manda cancelación + link para reagendar.
 */
export async function bloquearAgenda(inicio: string, fin: string, motivo: string, usuarioId: number) {
  const { citasEnRango } = await import('./agenda');
  const afectadas = citasEnRango(inicio, fin);

  const bloqueoId = Number(
    db.prepare('INSERT INTO bloqueos (inicio, fin, motivo, created_by) VALUES (?,?,?,?)')
      .run(inicio, fin, motivo || 'Emergencia', usuarioId).lastInsertRowid
  );

  for (const c of afectadas) {
    await cancelarCita(c.id, {
      motivo: `Bloqueo de agenda: ${motivo || 'emergencia'}`,
      plantilla: 'bloqueo',
      tipoNotif: 'bloqueo',
    });
  }
  notificar(
    'bloqueo',
    `Agenda bloqueada ${inicio} → ${fin}${motivo ? ` (${motivo})` : ''}. ${afectadas.length} cita(s) cancelada(s).`,
    `/panel/agenda?fecha=${soloFecha(inicio)}`
  );
  return { bloqueoId, afectadas: afectadas.length };
}

export function citasDelDia(fecha: string) {
  return db.prepare(
    `SELECT c.*, p.nombre AS paciente_nombre, p.cedula, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE substr(c.fecha_hora,1,10) = ?
      ORDER BY c.fecha_hora`
  ).all(fecha) as Array<Cita & { paciente_nombre: string; cedula: string; whatsapp: string }>;
}

export function citasEntre(desde: string, hasta: string) {
  return db.prepare(
    `SELECT c.*, p.nombre AS paciente_nombre, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE substr(c.fecha_hora,1,10) BETWEEN ? AND ?
      ORDER BY c.fecha_hora`
  ).all(desde, hasta) as Array<Cita & { paciente_nombre: string; whatsapp: string }>;
}

export function bloqueosEntre(desde: string, hasta: string) {
  return db.prepare(
    'SELECT * FROM bloqueos WHERE substr(inicio,1,10) <= ? AND substr(fin,1,10) >= ? ORDER BY inicio'
  ).all(hasta, desde) as { id: number; inicio: string; fin: string; motivo: string | null }[];
}

export const finDe = (c: { fecha_hora: string; duracion: number }) =>
  sumarMinutos(c.fecha_hora, c.duracion || 60);
