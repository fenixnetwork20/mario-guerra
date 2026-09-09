'use server';

import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth';
import { marcarTodasLeidas } from '@/lib/notificaciones';

export async function marcarLeidas() {
  await exigirUsuario();
  marcarTodasLeidas();
  revalidatePath('/panel');
}
