import { NextResponse } from 'next/server';
import { correrTick } from '@/lib/recordatorios';

export const dynamic = 'force-dynamic';

// Lo llama el cron del VPS cada 15 minutos:
//   curl -s "http://127.0.0.1:3320/marioguerra/api/cron/tick?token=$CRON_TOKEN"
async function manejar(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || req.headers.get('x-cron-token');
  const esperado = process.env.CRON_TOKEN;

  if (!esperado) return NextResponse.json({ error: 'CRON_TOKEN sin configurar' }, { status: 500 });
  if (token !== esperado) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    return NextResponse.json(await correrTick());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET = manejar;
export const POST = manejar;
