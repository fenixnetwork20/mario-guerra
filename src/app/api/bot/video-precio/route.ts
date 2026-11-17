import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videoPrecios } from '@/lib/botDatos';

export const dynamic = 'force-dynamic';

const ODI = 'https://portal.odichat.app/api/v1/accounts/11';

/**
 * Lo llama el bot (n8n) cuando alguien pregunta el precio de una cirugía: el
 * texto corto ya lo mandó el bot, aquí sale el video del doctor. Una sola vez
 * por conversación, lo diga o no el modelo: mandárselo dos veces a la misma
 * persona es justo lo que el doctor no quiere que se note.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.CRON_TOKEN || token !== process.env.CRON_TOKEN) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  let b: { conversacion?: number | string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }
  const conv = Number(b.conversacion);
  if (!Number.isInteger(conv) || conv <= 0) return NextResponse.json({ error: 'Falta la conversación.' }, { status: 400 });

  const ruta = videoPrecios();
  if (!ruta) return NextResponse.json({ ok: false, motivo: 'sin video' });

  // Se aparta antes de mandar: si llegan dos pedidos juntos, solo uno pasa.
  const apartado = db.prepare('INSERT OR IGNORE INTO videos_enviados (conversacion) VALUES (?)').run(conv);
  if (!apartado.changes) return NextResponse.json({ ok: false, motivo: 'ya enviado' });

  try {
    const datos = new FormData();
    datos.append('message_type', 'outgoing');
    datos.append('content', '');
    const tipo = ruta.endsWith('.3gp') ? 'video/3gpp' : 'video/mp4';
    datos.append('attachments[]', new Blob([await fs.readFile(ruta)], { type: tipo }), path.basename(ruta));
    const r = await fetch(`${ODI}/conversations/${conv}/messages`, {
      method: 'POST',
      headers: { api_access_token: process.env.ODICHAT_TOKEN || '' },
      body: datos,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`odichat ${r.status} ${(await r.text()).slice(0, 200)}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Si no salió, se libera para que la próxima vez se intente de nuevo.
    db.prepare('DELETE FROM videos_enviados WHERE conversacion = ?').run(conv);
    console.error('video de precios', conv, e);
    return NextResponse.json({ ok: false, motivo: String(e) }, { status: 502 });
  }
}
