'use server';

import { redirect } from 'next/navigation';
import { iniciarSesion, cerrarSesion } from '@/lib/auth';
import { permitido } from '@/lib/ratelimit';

export async function entrar(_prev: string | null, datos: FormData): Promise<string | null> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  if (!email || !clave) return 'Escribe tu correo y tu contraseña.';

  // Freno a la fuerza bruta: 10 intentos cada 10 minutos por correo.
  if (!permitido(`login:${email}`, 10, 600)) {
    return 'Demasiados intentos. Espera unos minutos.';
  }

  const u = await iniciarSesion(email, clave);
  if (!u) return 'Correo o contraseña incorrectos.';
  redirect('/panel');
}

export async function salir() {
  await cerrarSesion();
  redirect('/login');
}
