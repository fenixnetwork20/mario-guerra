import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** El comprobante de pago de una cita. Solo con sesión: lleva datos bancarios. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await usuarioActual())) return new NextResponse('No autorizado', { status: 401 });

  const { id } = await ctx.params;
  const c = db.prepare('SELECT pago_archivo FROM citas WHERE id = ?').get(Number(id)) as
    { pago_archivo: string | null } | undefined;
  if (!c?.pago_archivo) return new NextResponse('Sin comprobante', { status: 404 });

  const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
  try {
    const datos = await fs.readFile(path.join(carpeta, path.basename(c.pago_archivo)));
    const ext = path.extname(c.pago_archivo).toLowerCase();
    const tipo = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(new Uint8Array(datos), {
      headers: { 'Content-Type': tipo, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return new NextResponse('No disponible', { status: 404 });
  }
}
