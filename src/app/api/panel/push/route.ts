import { NextResponse } from 'next/server';
import { usuarioActual } from '@/lib/auth';
import { guardarSuscripcion, borrarSuscripcion, clavePublica, cuantosDispositivos } from '@/lib/push';

export const dynamic = 'force-dynamic';

/** La clave pública que el navegador necesita para suscribirse. */
export async function GET() {
  const s = await usuarioActual();
  if (!s) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  return NextResponse.json({ clave: clavePublica(), dispositivos: cuantosDispositivos() });
}

export async function POST(req: Request) {
  const s = await usuarioActual();
  if (!s) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  let b: { suscripcion?: { endpoint: string; keys: { p256dh: string; auth: string } }; dispositivo?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }
  if (!b.suscripcion?.endpoint || !b.suscripcion.keys?.p256dh) {
    return NextResponse.json({ error: 'Suscripción incompleta.' }, { status: 400 });
  }
  guardarSuscripcion(b.suscripcion, s.id, b.dispositivo ?? null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await usuarioActual();
  if (!s) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  let b: { endpoint?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }
  if (b.endpoint) borrarSuscripcion(b.endpoint);
  return NextResponse.json({ ok: true });
}
