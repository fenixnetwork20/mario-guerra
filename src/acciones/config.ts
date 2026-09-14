'use server';

import { revalidatePath } from 'next/cache';
import { db, guardarConfig } from '@/lib/db';
import { exigirPermiso } from '@/lib/permisos';
import { hashClave } from '@/lib/auth';
import type { Respuesta } from '@/componentes/FormAccion';

const HORA = /^\d{2}:\d{2}$/;

/** Ajustes sueltos de la tabla config (horas, precios, datos del consultorio). */
export async function guardarAjustes(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');

  const horas = [
    'r1_hora_inicio', 'r1_hora_fin', 'hora_corte', 'r2_hora_dia',
    'r2_hora_noche_anterior', 'autocancel_hora_noche_anterior',
  ];
  for (const h of horas) {
    const v = String(datos.get(h) ?? '');
    if (v && !HORA.test(v)) return { ok: false, error: `Hora inválida en ${h}.` };
  }

  const numeros = [
    'duracion_cita', 'precio_consulta_presencial', 'precio_consulta_online',
    'pm_banco', 'pm_telefono', 'pm_cedula', 'pm_titular', 'tasa_manual',
    'binance_usuario', 'zelle_correo', 'zelle_titular',
    'autocancel_offset_horas', 'dias_max_reserva', 'horas_min_anticipacion',
  ];
  for (const n of numeros) {
    const v = datos.get(n);
    if (v !== null && v !== '' && !(Number(v) >= 0)) return { ok: false, error: `Valor inválido en ${n}.` };
  }

  const textos = ['nombre_consultorio', 'direccion', 'whatsapp_consultorio', 'whatsapp_emergencias'];
  for (const clave of [...horas, ...numeros, ...textos]) {
    const v = datos.get(clave);
    if (v !== null) guardarConfig(clave, String(v));
  }
  guardarConfig('mensajeria_activa', datos.get('mensajeria_activa') === '1' ? '1' : '0');

  revalidatePath('/panel/config');
  revalidatePath('/panel');
  return { ok: true, aviso: 'Configuración guardada.' };
}

export async function guardarHorario(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');
  const dia = Number(datos.get('dia_semana'));
  const ini = String(datos.get('hora_inicio') ?? '');
  const fin = String(datos.get('hora_fin') ?? '');
  if (!(dia >= 0 && dia <= 6)) return { ok: false, error: 'Día inválido.' };
  if (!HORA.test(ini) || !HORA.test(fin)) return { ok: false, error: 'Horas inválidas.' };
  if (fin <= ini) return { ok: false, error: 'La hora final debe ser posterior.' };

  db.prepare('INSERT INTO horarios_atencion (dia_semana, hora_inicio, hora_fin) VALUES (?,?,?)')
    .run(dia, ini, fin);
  revalidatePath('/panel/config');
  return { ok: true, aviso: 'Horario agregado.' };
}

export async function eliminarHorario(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');
  db.prepare('DELETE FROM horarios_atencion WHERE id = ?').run(Number(datos.get('horario_id')));
  revalidatePath('/panel/config');
  return { ok: true, aviso: 'Horario eliminado.' };
}

export async function guardarProcedimiento(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');
  const id = Number(datos.get('procedimiento_id') || 0);
  const nombre = String(datos.get('nombre') ?? '').trim();
  if (!nombre) return { ok: false, error: 'Escribe el nombre del procedimiento.' };
  const precio = datos.get('precio_referencia') === '' ? null : Number(datos.get('precio_referencia'));
  if (precio !== null && !(precio >= 0)) return { ok: false, error: 'Precio inválido.' };

  try {
    if (id) {
      db.prepare('UPDATE procedimientos_catalogo SET nombre=?, precio_referencia=?, activo=? WHERE id=?')
        .run(nombre, precio, datos.get('activo') === '1' ? 1 : 0, id);
    } else {
      db.prepare('INSERT INTO procedimientos_catalogo (nombre, precio_referencia, orden) VALUES (?,?,?)')
        .run(nombre, precio, 999);
    }
  } catch {
    return { ok: false, error: 'Ya existe un procedimiento con ese nombre.' };
  }
  revalidatePath('/panel/config');
  return { ok: true, aviso: 'Catálogo actualizado.' };
}

export async function guardarUsuario(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');
  const id = Number(datos.get('usuario_id') || 0);
  const nombre = String(datos.get('nombre') ?? '').trim();
  const clave = String(datos.get('clave') ?? '');
  if (!nombre) return { ok: false, error: 'Escribe el nombre.' };
  if (clave && clave.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  if (!id) return { ok: false, error: 'Usuario no encontrado.' };

  db.prepare('UPDATE usuarios SET nombre = ?, activo = ? WHERE id = ?')
    .run(nombre, datos.get('activo') === '1' ? 1 : 0, id);
  if (clave) db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hashClave(clave), id);

  revalidatePath('/panel/config');
  return { ok: true, aviso: clave ? 'Usuario y contraseña actualizados.' : 'Usuario actualizado.' };
}

/**
 * Los dos códigos QR de cobro. Van a `data/uploads` como cualquier documento y
 * NO a /public: se sirven por una ruta propia, sin sesión, porque el paciente
 * tiene que verlos al reservar.
 */
export async function subirQR(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');
  const cual = String(datos.get('cual') || '');
  if (cual !== 'pm_qr' && cual !== 'binance_qr') return { ok: false, error: 'Código no válido.' };

  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Escoge una imagen.' };
  if (!/^image\/(png|jpe?g|webp)$/.test(archivo.type)) {
    return { ok: false, error: 'El QR tiene que ser una imagen PNG, JPG o WEBP.' };
  }
  if (archivo.size > 3 * 1024 * 1024) return { ok: false, error: 'La imagen no puede pasar de 3 MB.' };

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
  await fs.mkdir(carpeta, { recursive: true });
  const ext = archivo.type.split('/')[1].replace('jpeg', 'jpg');
  const nombre = `${cual}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(carpeta, nombre), Buffer.from(await archivo.arrayBuffer()));

  db.prepare('INSERT INTO config (clave,valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor')
    .run(cual, nombre);
  revalidatePath('/panel/config');
  revalidatePath('/reservar');
  return { ok: true, aviso: 'Código guardado.' };
}

export async function quitarQR(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('configuracion');
  const cual = String(datos.get('cual') || '');
  if (cual !== 'pm_qr' && cual !== 'binance_qr') return { ok: false, error: 'Código no válido.' };
  db.prepare("UPDATE config SET valor = '' WHERE clave = ?").run(cual);
  revalidatePath('/panel/config');
  revalidatePath('/reservar');
  return { ok: true, aviso: 'Código quitado.' };
}
