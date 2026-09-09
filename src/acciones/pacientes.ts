'use server';

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { exigirPermiso } from '@/lib/permisos';
import { hoyVET } from '@/lib/fechas';
import {
  normalizarCedula, primerError, validarCedula, validarEdad, validarFecha, validarNombre, validarWhatsapp,
} from '@/lib/validar';
import type { Respuesta } from '@/componentes/FormAccion';

const CARPETA = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
const MAX_BYTES = 10 * 1024 * 1024;
const EXT_OK = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];

export async function guardarPaciente(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('pacientes_editar');
  const id = Number(datos.get('paciente_id') || 0);
  const nombre = String(datos.get('nombre') ?? '').trim();
  const cedula = normalizarCedula(String(datos.get('cedula') ?? ''));
  const whatsapp = String(datos.get('whatsapp') ?? '').trim();
  const edad = datos.get('edad') ? Number(datos.get('edad')) : null;
  const notas = String(datos.get('notas_medicas') ?? '');

  const e = primerError(validarNombre(nombre), validarCedula(cedula), validarWhatsapp(whatsapp), validarEdad(edad));
  if (e) return { ok: false, error: e };

  const otro = db.prepare('SELECT id FROM pacientes WHERE cedula = ? AND id <> ?')
    .get(cedula, id) as { id: number } | undefined;
  if (otro) return { ok: false, error: 'Ya hay otro paciente con esa cédula.' };

  if (id) {
    db.prepare('UPDATE pacientes SET nombre=?, cedula=?, whatsapp=?, edad=?, notas_medicas=? WHERE id=?')
      .run(nombre, cedula, whatsapp, edad, notas, id);
    revalidatePath(`/panel/pacientes/${id}`);
  } else {
    db.prepare('INSERT INTO pacientes (nombre, cedula, whatsapp, edad, notas_medicas) VALUES (?,?,?,?,?)')
      .run(nombre, cedula, whatsapp, edad, notas);
  }
  revalidatePath('/panel/pacientes');
  return { ok: true };
}

export async function subirDocumento(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  const usuario = await exigirPermiso('documentos_subir');
  const pacienteId = Number(datos.get('paciente_id'));
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: 'Elige un archivo.' };
  if (archivo.size > MAX_BYTES) return { ok: false, error: 'El archivo pasa de 10 MB.' };

  const ext = path.extname(archivo.name).toLowerCase();
  if (!EXT_OK.includes(ext)) {
    return { ok: false, error: `Formato no permitido. Usa: ${EXT_OK.join(', ')}` };
  }

  const fecha = String(datos.get('fecha') || hoyVET());
  const vf = validarFecha(fecha);
  if (!vf.ok) return { ok: false, error: vf.error };

  await fs.mkdir(CARPETA, { recursive: true });
  const nombreFisico = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(CARPETA, nombreFisico), Buffer.from(await archivo.arrayBuffer()));

  db.prepare(
    `INSERT INTO documentos (paciente_id, tipo, nombre, archivo, mime, tamano, fecha, subido_por)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    pacienteId,
    String(datos.get('tipo') || 'documento'),
    String(datos.get('nombre') || archivo.name),
    nombreFisico,
    archivo.type || null,
    archivo.size,
    fecha,
    usuario.id
  );
  revalidatePath(`/panel/pacientes/${pacienteId}`);
  return { ok: true, aviso: 'Archivo subido.' };
}

export async function eliminarDocumento(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('pacientes_editar');
  const id = Number(datos.get('documento_id'));
  const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id) as
    { id: number; paciente_id: number; archivo: string } | undefined;
  if (!doc) return { ok: false, error: 'Documento no encontrado.' };

  db.prepare('DELETE FROM documentos WHERE id = ?').run(id);
  await fs.unlink(path.join(CARPETA, doc.archivo)).catch(() => {});
  revalidatePath(`/panel/pacientes/${doc.paciente_id}`);
  return { ok: true, aviso: 'Documento eliminado.' };
}
