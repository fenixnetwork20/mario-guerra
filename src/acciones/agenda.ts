'use server';

import { revalidatePath } from 'next/cache';
import { db, cfgNum } from '@/lib/db';
import { exigirPermiso } from '@/lib/permisos';
import {
  bloquearAgenda, cancelarCita, citaPorId, crearCita, buscarOCrearPaciente,
  marcarCompletada, reprogramarCita,
} from '@/lib/citas';
import { conflictos } from '@/lib/agenda';
import { soloFecha } from '@/lib/fechas';
import { primerError, validarCedula, validarMomento, validarNombre, validarWhatsapp } from '@/lib/validar';

export type Respuesta = { ok: boolean; error?: string; aviso?: string };

const refrescar = (fecha?: string) => {
  revalidatePath('/panel');
  revalidatePath('/panel/agenda');
  if (fecha) revalidatePath(`/panel/agenda?fecha=${fecha}`);
};

/** Agendado manual: valoraciones, cirugías y revisiones. No pasa por los cupos públicos. */
export async function agendarManual(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('agenda');

  const tipo = String(datos.get('tipo') ?? 'valoracion') as 'valoracion' | 'cirugia' | 'revision';
  const fecha = String(datos.get('fecha') ?? '');
  const hora = String(datos.get('hora') ?? '');
  const inicio = `${fecha} ${hora}`;
  const duracion = Number(datos.get('duracion') || cfgNum('duracion_cita', 60));
  const forzar = datos.get('forzar') === '1';

  const err = validarMomento(inicio);
  if (!err.ok) return { ok: false, error: err.error };

  let pacienteId = Number(datos.get('paciente_id') || 0);
  if (!pacienteId) {
    const nombre = String(datos.get('nombre') ?? '');
    const cedula = String(datos.get('cedula') ?? '');
    const whatsapp = String(datos.get('whatsapp') ?? '');
    const e = primerError(validarNombre(nombre), validarCedula(cedula), validarWhatsapp(whatsapp));
    if (e) return { ok: false, error: e };
    pacienteId = buscarOCrearPaciente({ nombre, cedula, whatsapp }).id;
  }

  const choques = conflictos(inicio, duracion);
  if (choques.length && !forzar) {
    return { ok: false, error: `Ese horario choca con: ${choques.join(', ')}. Marca "agendar igual" si quieres solaparlo.` };
  }

  crearCita({
    pacienteId,
    tipo,
    modalidad: tipo === 'valoracion'
      ? ((String(datos.get('modalidad') || 'presencial')) as 'presencial' | 'online')
      : null,
    fechaHora: inicio,
    duracion,
    origen: 'manual',
    procedimientoInteres: (datos.get('procedimiento') as string) || null,
    notas: (datos.get('notas') as string) || null,
    cirugiaId: Number(datos.get('cirugia_id') || 0) || null,
    revisionId: Number(datos.get('revision_id') || 0) || null,
  });

  const revisionId = Number(datos.get('revision_id') || 0);
  if (revisionId) {
    db.prepare("UPDATE revisiones_postop SET estado = 'agendada' WHERE id = ?").run(revisionId);
  }

  refrescar(fecha);
  return { ok: true, aviso: choques.length ? 'Agendada sobre otro compromiso.' : undefined };
}

export async function cancelarDesdePanel(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('agenda');
  const id = Number(datos.get('cita_id'));
  const motivo = String(datos.get('motivo') || 'Cancelada desde el panel');
  const avisar = datos.get('avisar') === '1';

  const cita = citaPorId(id);
  if (!cita) return { ok: false, error: 'Cita no encontrada.' };

  await cancelarCita(id, {
    motivo,
    plantilla: avisar ? 'cancelacion' : null,
    tipoNotif: 'auto_cancelacion',
  });
  refrescar(soloFecha(cita.fecha_hora));
  return { ok: true, aviso: avisar ? 'Cancelada y avisada por WhatsApp.' : 'Cancelada sin enviar mensaje.' };
}

export async function reprogramarDesdePanel(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('agenda');
  const id = Number(datos.get('cita_id'));
  const inicio = `${datos.get('fecha')} ${datos.get('hora')}`;
  const v = validarMomento(inicio);
  if (!v.ok) return { ok: false, error: v.error };

  const nueva = reprogramarCita(id, inicio);
  if (!nueva) return { ok: false, error: 'Ese horario no está disponible.' };
  refrescar(soloFecha(inicio));
  return { ok: true };
}

export async function cambiarEstadoCita(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('agenda');
  const id = Number(datos.get('cita_id'));
  const estado = String(datos.get('estado'));
  const cita = citaPorId(id);
  if (!cita) return { ok: false, error: 'Cita no encontrada.' };

  if (estado === 'completada') {
    marcarCompletada(id);
  } else if (['confirmada', 'no_asistio', 'reservada'].includes(estado)) {
    db.prepare('UPDATE citas SET estado = ? WHERE id = ?').run(estado, id);
  } else {
    return { ok: false, error: 'Estado inválido.' };
  }
  refrescar(soloFecha(cita.fecha_hora));
  return { ok: true };
}

/** Bloqueo por emergencia: el rango queda ocupado y se avisa a los afectados. */
export async function crearBloqueo(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  const usuario = await exigirPermiso('agenda');
  const inicio = `${datos.get('fecha')} ${datos.get('hora_inicio')}`;
  const fin = `${datos.get('fecha')} ${datos.get('hora_fin')}`;
  const e = primerError(validarMomento(inicio), validarMomento(fin));
  if (e) return { ok: false, error: e };
  if (fin <= inicio) return { ok: false, error: 'La hora final debe ser posterior a la inicial.' };

  const r = await bloquearAgenda(inicio, fin, String(datos.get('motivo') || ''), usuario.id);
  refrescar(String(datos.get('fecha')));
  return {
    ok: true,
    aviso: r.afectadas
      ? `Bloqueo creado. Se cancelaron y avisaron ${r.afectadas} cita(s).`
      : 'Bloqueo creado. No había citas en ese rango.',
  };
}

export async function eliminarBloqueo(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('agenda');
  const id = Number(datos.get('bloqueo_id'));
  const b = db.prepare('SELECT inicio FROM bloqueos WHERE id = ?').get(id) as { inicio: string } | undefined;
  db.prepare('DELETE FROM bloqueos WHERE id = ?').run(id);
  refrescar(b ? soloFecha(b.inicio) : undefined);
  return { ok: true, aviso: 'Bloqueo eliminado. Las citas canceladas no se restauran solas.' };
}
