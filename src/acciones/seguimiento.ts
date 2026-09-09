'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { exigirPermiso } from '@/lib/permisos';
import { hoyVET } from '@/lib/fechas';
import { validarFecha } from '@/lib/validar';
import type { Respuesta } from '@/componentes/FormAccion';

export async function crearSeguimiento(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('seguimiento');
  const pacienteId = Number(datos.get('paciente_id'));
  const nota = String(datos.get('nota') ?? '').trim();
  const fecha = String(datos.get('fecha') || hoyVET());
  if (!pacienteId) return { ok: false, error: 'Falta el paciente.' };
  if (!nota) return { ok: false, error: 'Escribe la nota del re-contacto.' };
  const vf = validarFecha(fecha);
  if (!vf.ok) return { ok: false, error: vf.error };

  db.prepare("INSERT INTO seguimientos (paciente_id, tipo, nota, fecha) VALUES (?,'comercial',?,?)")
    .run(pacienteId, nota, fecha);
  revalidatePath('/panel/seguimiento');
  revalidatePath(`/panel/pacientes/${pacienteId}`);
  return { ok: true, aviso: 'Anotado en seguimiento.' };
}

export async function cambiarEstadoSeguimiento(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('seguimiento');
  const id = Number(datos.get('seguimiento_id'));
  const estado = String(datos.get('estado'));
  if (!['pendiente', 'hecho', 'descartado'].includes(estado)) return { ok: false, error: 'Estado inválido.' };

  db.prepare('UPDATE seguimientos SET estado = ? WHERE id = ?').run(estado, id);
  revalidatePath('/panel/seguimiento');
  return { ok: true };
}

export async function cambiarEstadoRevision(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('agenda');
  const id = Number(datos.get('revision_id'));
  const estado = String(datos.get('estado'));
  if (!['pendiente', 'agendada', 'completada', 'omitida'].includes(estado)) {
    return { ok: false, error: 'Estado inválido.' };
  }
  db.prepare('UPDATE revisiones_postop SET estado = ? WHERE id = ?').run(estado, id);
  revalidatePath('/panel/seguimiento');
  return { ok: true };
}
