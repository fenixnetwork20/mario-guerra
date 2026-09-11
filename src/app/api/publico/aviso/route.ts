import { NextResponse } from 'next/server';
import { notificar } from '@/lib/notificaciones';

export const dynamic = 'force-dynamic';

/**
 * Por aquí avisa el bot cuando pasa una conversación a una persona. Cae en la
 * campanita del panel y sale como notificación al teléfono de quien la tenga
 * activada. Se protege con el mismo token del cron: no hay sesión detrás.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.CRON_TOKEN || token !== process.env.CRON_TOKEN) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let b: { mensaje?: string; enlace?: string; tipo?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }

  const mensaje = (b.mensaje || '').trim().slice(0, 400);
  if (!mensaje) return NextResponse.json({ error: 'Falta el mensaje.' }, { status: 400 });

  notificar('atencion_humana', mensaje, b.enlace?.slice(0, 500));
  return NextResponse.json({ ok: true });
}
