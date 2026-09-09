import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { usuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Los exámenes son datos médicos: se sirven solo con sesión abierta y nunca
// desde /public, para que no queden accesibles por URL adivinable.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await usuarioActual())) return new NextResponse('No autorizado', { status: 401 });

  const { id } = await ctx.params;
  const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(Number(id)) as
    { nombre: string; archivo: string; mime: string | null } | undefined;
  if (!doc) return new NextResponse('No encontrado', { status: 404 });

  const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
  try {
    const datos = await fs.readFile(path.join(carpeta, path.basename(doc.archivo)));
    return new NextResponse(new Uint8Array(datos), {
      headers: {
        'Content-Type': doc.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.nombre)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Archivo no disponible', { status: 404 });
  }
}
