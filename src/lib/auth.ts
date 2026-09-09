import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import type { Rol, Usuario } from './tipos';

const COOKIE = 'mg_sesion';
const DIAS_SESION = 7;

function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Falta SESSION_SECRET en .env.local (mínimo 16 caracteres)');
  }
  return s;
}

function firmar(payload: string): string {
  return crypto.createHmac('sha256', secreto()).update(payload).digest('base64url');
}

function crearToken(uid: number): string {
  const exp = Date.now() + DIAS_SESION * 86_400_000;
  const payload = Buffer.from(JSON.stringify({ uid, exp })).toString('base64url');
  return `${payload}.${firmar(payload)}`;
}

function leerToken(token: string): { uid: number } | null {
  const [payload, firma] = token.split('.');
  if (!payload || !firma) return null;
  const esperada = firmar(payload);
  // Comparación en tiempo constante para no filtrar la firma byte a byte.
  if (firma.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!uid || !exp || Date.now() > exp) return null;
    return { uid };
  } catch {
    return null;
  }
}

export async function iniciarSesion(email: string, clave: string): Promise<Usuario | null> {
  const fila = db
    .prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1')
    .get(email.trim().toLowerCase()) as (Usuario & { password_hash: string }) | undefined;
  if (!fila || !bcrypt.compareSync(clave, fila.password_hash)) return null;

  const jar = await cookies();
  jar.set(COOKIE, crearToken(fila.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DIAS_SESION * 86_400,
  });
  const { password_hash: _, ...usuario } = fila;
  return usuario;
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

/** Usuario de la sesión actual, o null. Nunca lanza. */
export async function usuarioActual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const datos = leerToken(token);
  if (!datos) return null;
  const u = db
    .prepare('SELECT id, email, nombre, rol, activo FROM usuarios WHERE id = ? AND activo = 1')
    .get(datos.uid) as Usuario | undefined;
  return u ?? null;
}

/** Para páginas: exige sesión o manda al login. */
export async function exigirSesion(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  return u;
}

/** Para acciones/API: exige sesión o lanza. */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) throw new Error('No autorizado');
  return u;
}

export function hashClave(clave: string): string {
  return bcrypt.hashSync(clave, 10);
}

export type { Rol, Usuario };
