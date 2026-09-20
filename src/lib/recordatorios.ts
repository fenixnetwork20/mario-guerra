import 'server-only';
import { db, cfg, cfgNum } from './db';
import { ahoraVET, hoyVET, soloFecha, soloHora, sumarDias, sumarMinutos, fechaLarga, hora12 } from './fechas';
import { enviarPlantilla, linkGestion } from './mensajeria';
import { notificar } from './notificaciones';
import { cancelarCita } from './citas';
import { cuotasVencidas } from './dinero';
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
  const reporte = { ahora, r1: 0, r2: 0, canceladas: 0, cuotas: 0 };

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
