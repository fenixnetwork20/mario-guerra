import fs from 'node:fs';
import { Readable } from 'node:stream';
import { videoPrecios } from '@/lib/botDatos';

export const dynamic = 'force-dynamic';

/**
 * El video de precios, para verlo en Configuración. Va en stream y por rangos:
 * leer el archivo entero a memoria por cada pedido tumbó el VPS una vez.
 */
export async function GET(req: Request) {
  const ruta = videoPrecios();
  if (!ruta) return new Response('Sin video.', { status: 404 });
  const total = fs.statSync(ruta).size;
  const tipo = ruta.endsWith('.3gp') ? 'video/3gpp' : 'video/mp4';
  const rango = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (rango) {
    const inicio = rango[1] ? Number(rango[1]) : 0;
    const fin = Math.min(rango[2] ? Number(rango[2]) : total - 1, total - 1);
    if (inicio > fin) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    const cuerpo = Readable.toWeb(fs.createReadStream(ruta, { start: inicio, end: fin })) as ReadableStream;
    return new Response(cuerpo, {
      status: 206,
      headers: {
        'Content-Type': tipo, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${inicio}-${fin}/${total}`, 'Content-Length': String(fin - inicio + 1),
      },
    });
  }
  const cuerpo = Readable.toWeb(fs.createReadStream(ruta)) as ReadableStream;
  return new Response(cuerpo, { headers: { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Content-Length': String(total) } });
}
