import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { cfg } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Sirve los dos códigos QR de cobro. Es la única cosa de `data/uploads` que se
 * entrega sin sesión: el paciente tiene que verlos para pagar. No hay nada
 * sensible en un QR de cobro, y el nombre del archivo no se expone.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ cual: string }> }) {
  const { cual } = await ctx.params;
  if (cual !== 'pm' && cual !== 'binance') return new NextResponse('No encontrado', { status: 404 });

  const archivo = cfg(cual === 'pm' ? 'pm_qr' : 'binance_qr', '');
  if (!archivo) return new NextResponse('Sin código cargado', { status: 404 });

  const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
  try {
    const datos = await fs.readFile(path.join(carpeta, path.basename(archivo)));
    const ext = path.extname(archivo).toLowerCase();
    const tipo = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(new Uint8Array(datos), {
      headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return new NextResponse('No disponible', { status: 404 });
  }
}
