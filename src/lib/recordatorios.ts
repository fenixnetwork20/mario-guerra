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

function vars(c: CitaConPaciente) {
  return {
    nombre: c.paciente_nombre,
    fecha: fechaLarga(soloFecha(c.fecha_hora)),
    hora: hora12(soloHora(c.fecha_hora)),
    link: linkGestion(c.token_gestion),
  };
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
        destino: c.whatsapp, variables: vars(c),
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
        destino: c.whatsapp, variables: vars(c),
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
