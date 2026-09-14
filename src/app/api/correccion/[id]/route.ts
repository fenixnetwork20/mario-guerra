import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** La captura que adjuntaron a una corrección. Solo con sesión: puede tener
 *  datos de pacientes en pantalla. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await usuarioActual())) return new NextResponse('No autorizado', { status: 401 });

  const { id } = await ctx.params;
  const c = db.prepare('SELECT archivo FROM correcciones WHERE id = ?').get(Number(id)) as
    { archivo: string | null } | undefined;
  if (!c?.archivo) return new NextResponse('Sin archivo', { status: 404 });

  const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
  try {
    const datos = await fs.readFile(path.join(carpeta, path.basename(c.archivo)));
    const ext = path.extname(c.archivo).toLowerCase();
    const tipo = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(new Uint8Array(datos), {
      headers: { 'Content-Type': tipo, 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return new NextResponse('No disponible', { status: 404 });
  }
}
