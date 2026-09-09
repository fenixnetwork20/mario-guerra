import { NextResponse } from 'next/server';
import { cuposLibres } from '@/lib/agenda';
import { permitido, ipDe } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ip = ipDe(new Headers(req.headers));
  if (!permitido(`cupos:${ip}`, 60, 300)) {
    return NextResponse.json({ error: 'Demasiadas consultas. Espera un momento.' }, { status: 429 });
  }
  return NextResponse.json({ dias: cuposLibres() });
}
