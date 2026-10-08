import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Propuestas de diseño para mostrarle al doctor: HTML sueltos en /propuestas
 * (fuera de public/, que no ve archivos nuevos después del build). Cambiar una
 * propuesta es reemplazar el archivo: no hace falta compilar.
 */
const CARPETA = path.join(process.cwd(), 'propuestas');

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ archivo?: string[] }> }) {
  const { archivo } = await params;
  const pedido = archivo?.join('/') || 'index';
  const nombre = path.basename(pedido).replace(/\.html$/, '');
  if (!/^[a-z0-9-]+$/.test(nombre)) return new Response('No encontrado', { status: 404 });
  try {
    const html = await fs.readFile(path.join(CARPETA, `${nombre}.html`), 'utf8');
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
}
