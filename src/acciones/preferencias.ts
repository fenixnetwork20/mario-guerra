'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth';
import { ANCHOS, ANCHO_POR_DEFECTO, type Ancho } from '@/lib/ancho';

/** Ancho de trabajo del panel. Va en cookie para que el servidor ya renderice
 *  con el ancho correcto y no se vea el salto al cargar. */
export async function cambiarAncho(datos: FormData) {
  await exigirUsuario();
  const valor = String(datos.get('ancho') ?? '');
  if (!ANCHOS.includes(valor as Ancho)) return;

  (await cookies()).set('mg_ancho', valor, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 86_400,
  });
  revalidatePath('/panel', 'layout');
}

export async function anchoActual(): Promise<Ancho> {
  const v = (await cookies()).get('mg_ancho')?.value;
  return ANCHOS.includes(v as Ancho) ? (v as Ancho) : ANCHO_POR_DEFECTO;
}
