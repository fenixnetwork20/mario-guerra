import 'server-only';
import { db, cfg, cfgNum } from './db';
import { ahoraVET, hoyVET, soloFecha, soloHora, sumarDias, sumarMinutos, fechaLarga, hora12, utcAVET } from './fechas';
import { enviarPlantilla, linkGestion } from './mensajeria';
import { notificar } from './notificaciones';
import { cancelarCita } from './citas';
import { cuotasVencidas } from './dinero';
import { sincronizarLeads, correrSeguimientos } from './leads';
import type { Cita } from './tipos';

type CitaConPaciente = Cita & { paciente_nombre: string; whatsapp: string };

/**
 * Momentos calculados para una cita, según la hora de corte (por defecto 11:00 VET).
 *  - Cita DESPUÉS del corte  → R2 a las 08:00 del día, auto-cancelación 3h después.
 *  - Cita al corte o ANTES   → R2 a las 18:00 del día anterior, auto-cancelación a las 21:00.
 */
export function momentos(fechaHora: string) {
  const fecha = soloFecha(fechaHora);
  const hora = soloHora(fechaHora);
  const diaAntes = sumarDias(fecha, -1);
  const corte = cfg('hora_corte', '11:00');

  const r1Desde = `${diaAntes} ${cfg('r1_hora_inicio', '08:00')}`;
  const r1Hasta = `${diaAntes} ${cfg('r1_hora_fin', '17:00')}`;

  if (hora > corte) {
    const r2 = `${fecha} ${cfg('r2_hora_dia', '08:00')}`;
    return { r1Desde, r1Hasta, r2, cancelar: sumarMinutos(r2, cfgNum('autocancel_offset_horas', 3) * 60) };
  }
  return {
    r1Desde, r1Hasta,
    r2: `${diaAntes} ${cfg('r2_hora_noche_anterior', '18:00')}`,
    cancelar: `${diaAntes} ${cfg('autocancel_hora_noche_anterior', '21:00')}`,
  };
}

/**
 * ¿Ya se le puede pedir al paciente que confirme? Solo desde el momento en que
 * pudo salir el primer recordatorio, el día anterior. Confirmar al reservar no
 * prueba nada: apagaría el R2 y la auto-cancelación dos semanas antes, que es
 * justo lo que sostiene la agenda. Una cita tomada para hoy o para mañana
 * temprano ya nace dentro de la ventana, así que nunca queda sin poder confirmar.
 */
export function confirmacionAbierta(fechaHora: string, ahora = ahoraVET()): boolean {
  return ahora >= momentos(fechaHora).r1Desde;
}

/**
 * Si ya le pedimos que confirme —el recordatorio automático o uno que la
 * asistente mandó a mano antes de tiempo—, puede confirmar aunque la ventana
 * por fecha no haya abierto. Pedirle algo y después no dejárselo hacer deja al
 * paciente sin salida y con la impresión de que el sistema está roto.
 */
export function confirmacionPedida(citaId: number): boolean {
  const fila = db.prepare(
    `SELECT 1 FROM mensajes_enviados
      WHERE cita_id = ? AND estado = 'enviado'
        AND plantilla IN ('recordatorio_1', 'recordatorio_2')
      LIMIT 1`
  ).get(citaId);
  return Boolean(fila);
}

/** La respuesta única a "¿este paciente puede confirmar ahora?". */
export function puedeConfirmarse(cita: { id: number; fecha_hora: string; estado: string }): boolean {
  return cita.estado === 'reservada'
    && (confirmacionAbierta(cita.fecha_hora) || confirmacionPedida(cita.id));
}

function vars(c: CitaConPaciente) {
  return {
    nombre: c.paciente_nombre,
    fecha: fechaLarga(soloFecha(c.fecha_hora)),
    hora: hora12(soloHora(c.fecha_hora)),
    link: linkGestion(c.token_gestion),
  };
}

/** El enlace de los recordatorios abre la confirmación de una vez: un toque y listo. */
function varsRecordatorio(c: CitaConPaciente) {
  return { ...vars(c), link: `${linkGestion(c.token_gestion)}?confirmar=1` };
}

/**
 * Se ejecuta cada 15 minutos desde el cron del VPS. Evalúa recordatorios,
 * auto-cancelaciones y avisos de cuotas vencidas. Es idempotente.
 */
export async function correrTick() {
  const ahora = ahoraVET();
  const reporte = { ahora, r1: 0, r2: 0, canceladas: 0, cuotas: 0, pagos: 0 };

  // Solo valoraciones vivas, desde hoy en adelante.
  const citas = db.prepare(
    `SELECT c.*, p.nombre AS paciente_nombre, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.tipo = 'valoracion'
        AND c.estado IN ('reservada','confirmada')
        AND c.fecha_hora >= ?
      ORDER BY c.fecha_hora`
  ).all(`${sumarDias(hoyVET(), -1)} 00:00`) as CitaConPaciente[];

  for (const c of citas) {
    const m = momentos(c.fecha_hora);

    // Recordatorio 1: siempre, una sola vez, dentro de la ventana del día anterior.
    if (!c.r1_enviado_at && ahora >= m.r1Desde && ahora <= m.r1Hasta) {
      await enviarPlantilla({
        clave: 'recordatorio_1', pacienteId: c.paciente_id, citaId: c.id,
        destino: c.whatsapp, variables: varsRecordatorio(c),
      });
      db.prepare('UPDATE citas SET r1_enviado_at = ? WHERE id = ?').run(ahora, c.id);
      reporte.r1++;
      continue; // nunca dos mensajes a la misma cita en el mismo tick
    }

    if (c.estado !== 'reservada') continue; // ya confirmó: no se le escribe más

    // Quien reserva ya metido en la ventana de confirmación nunca tuvo ocasión
    // de confirmar: su recordatorio y hasta el momento de cancelar ya habían
    // pasado cuando reservó. Una paciente de Panamá pagó su consulta y el
    // sistema se la canceló 42 segundos después. Reservar así ES confirmar.
    if (utcAVET(c.created_at) >= m.r1Desde) {
      db.prepare("UPDATE citas SET estado = 'confirmada' WHERE id = ?").run(c.id);
      continue;
    }

    // Auto-cancelación por no confirmar: libera el cupo y avisa con link de reagendar.
    if (ahora >= m.cancelar) {
      await cancelarCita(c.id, {
        motivo: 'No confirmó la asistencia',
        plantilla: 'cancelacion',
        tipoNotif: 'auto_cancelacion',
      });
      reporte.canceladas++;
      continue;
    }

    // Recordatorio 2: solo si sigue sin confirmar.
    if (!c.r2_enviado_at && ahora >= m.r2) {
      await enviarPlantilla({
        clave: 'recordatorio_2', pacienteId: c.paciente_id, citaId: c.id,
        destino: c.whatsapp, variables: varsRecordatorio(c),
      });
      db.prepare('UPDATE citas SET r2_enviado_at = ? WHERE id = ?').run(ahora, c.id);
      notificar(
        'sin_confirmar',
        `${c.paciente_nombre} no ha confirmado su cita del ${fechaLarga(soloFecha(c.fecha_hora))} ${hora12(soloHora(c.fecha_hora))}`,
        `/panel/agenda?fecha=${soloFecha(c.fecha_hora)}`
      );
      reporte.r2++;
    }
  }

  // Leads de WhatsApp: primero se relee el buzón (quién escribió, quién ya
  // agendó, dónde entró una persona) y después se manda lo que toque.
  try {
    await sincronizarLeads();
    const seg = await correrSeguimientos();
    Object.assign(reporte, { seg1: seg.seg1, seg2: seg.seg2, esperanPlantilla: seg.esperanPlantilla });
  } catch (e) {
    // Que falle odichat no puede tumbar los recordatorios de las citas.
    console.error('seguimiento de leads', e);
  }

  // Pagos sin verificar de citas que ya están encima. Se avisa una sola vez por
  // cita: el consultorio tiene que llegar a la consulta sabiendo si esa persona
  // pagó, si viene a pagar en efectivo, o si no dejó rastro de haber pagado.
  const porCobrar = db.prepare(
    `SELECT c.id, c.fecha_hora, c.pago_metodo, c.pago_archivo, c.paciente_id,
            p.nombre AS paciente
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.estado IN ('reservada','confirmada')
        AND c.pago_estado = 'pendiente'
        AND c.pago_aviso_at IS NULL
        AND c.fecha_hora >= ?
        AND c.fecha_hora <= ?`
  ).all(ahora, sumarDias(ahora, 1)) as Array<{
    id: number; fecha_hora: string; pago_metodo: string | null; pago_archivo: string | null;
    paciente_id: number; paciente: string;
  }>;

  for (const c of porCobrar) {
    const cuando = `${fechaLarga(soloFecha(c.fecha_hora))} ${hora12(soloHora(c.fecha_hora))}`;
    const que = c.pago_metodo === 'efectivo'
      ? `paga en efectivo al llegar: hay que cobrarle`
      : c.pago_archivo
        ? `mandó comprobante y nadie lo ha revisado`
        : `no dejó comprobante ni referencia`;
    notificar('pago_sin_verificar', `${c.paciente} — ${cuando}: ${que}.`, '/panel');
    db.prepare('UPDATE citas SET pago_aviso_at = ? WHERE id = ?').run(ahora, c.id);
    reporte.pagos++;
  }

  // Cuotas vencidas: una sola notificación por cuota.
  for (const cu of cuotasVencidas()) {
    if (cu.avisada) continue;
    notificar(
      'cuota_vencida',
      `Cuota ${cu.numero} vencida ($${cu.monto}) — ${cu.paciente}, ${cu.procedimiento} (venció ${cu.fecha_vencimiento})`,
      `/panel/pacientes/${cu.paciente_id}`
    );
    db.prepare('UPDATE cuotas SET avisada = 1 WHERE id = ?').run(cu.id);
    reporte.cuotas++;
  }

  return reporte;
}
