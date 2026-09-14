'use server';

import fs from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { usuarioActual } from '@/lib/auth';
import { notificar } from '@/lib/notificaciones';
import type { Respuesta } from '@/componentes/FormAccion';

const CARPETA = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');

/**
 * Lo que el doctor o la asistente ven mal y quieren que se arregle. Entra desde
 * cualquier pantalla del panel, con foto opcional: señalar es más fácil que
 * describir "el botón ese de arriba se ve raro".
 */
export async function enviarCorreccion(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false, error: 'Sesión vencida. Entra de nuevo.' };

  const texto = String(datos.get('texto') || '').trim();
  if (texto.length < 5) return { ok: false, error: 'Cuéntanos qué hay que corregir.' };
  if (texto.length > 2000) return { ok: false, error: 'Es demasiado largo; resúmelo un poco.' };

  let archivo: string | null = null;
  const foto = datos.get('foto');
  if (foto instanceof File && foto.size) {
    if (!/^image\/(png|jpe?g|webp)$/.test(foto.type)) {
      return { ok: false, error: 'La foto tiene que ser PNG, JPG o WEBP.' };
    }
    if (foto.size > 8 * 1024 * 1024) return { ok: false, error: 'La foto no puede pasar de 8 MB.' };
    await fs.mkdir(CARPETA, { recursive: true });
    const ext = foto.type.split('/')[1].replace('jpeg', 'jpg');
    archivo = `correccion-${Date.now()}.${ext}`;
    await fs.writeFile(path.join(CARPETA, archivo), Buffer.from(await foto.arrayBuffer()));
  }

  const id = db
    .prepare('INSERT INTO correcciones (texto, archivo, pantalla, autor_id) VALUES (?,?,?,?)')
    .run(texto, archivo, String(datos.get('pantalla') || '').slice(0, 120) || null, usuario.id)
    .lastInsertRowid;

  notificar(
    'correccion',
    `${usuario.nombre} pide una corrección: ${texto.slice(0, 120)}${texto.length > 120 ? '…' : ''}`,
    `/panel/correcciones#c${id}`
  );
  revalidatePath('/panel/correcciones');
  return { ok: true, aviso: 'Anotado. Gracias, lo revisamos.' };
}

export async function resolverCorreccion(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  if (!(await usuarioActual())) return { ok: false, error: 'Sesión vencida.' };
  const id = Number(datos.get('correccion_id'));
  const abrir = datos.get('abrir') === '1';
  db.prepare(
    abrir
      ? "UPDATE correcciones SET estado = 'abierta', resuelta_at = NULL WHERE id = ?"
      : "UPDATE correcciones SET estado = 'resuelta', resuelta_at = datetime('now') WHERE id = ?"
  ).run(id);
  revalidatePath('/panel/correcciones');
  return { ok: true, aviso: abrir ? 'Reabierta.' : 'Marcada como resuelta.' };
}
