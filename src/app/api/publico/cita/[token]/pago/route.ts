import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db, cfgNum } from '@/lib/db';
import { citaPorToken } from '@/lib/citas';
import { tasaDelDia } from '@/lib/tasa';
import { notificar } from '@/lib/notificaciones';
import { permitido, ipDe } from '@/lib/ratelimit';
import { fechaLarga, hora12, soloFecha, soloHora } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

/**
 * Subir el comprobante después de reservar. Haylimar Rincón reservó con
 * "efectivo el día de la cita", después pagó por transferencia y su enlace no
 * tenía dónde cargarlo: le escribió al doctor. También sirve a quien se le
 * rechazó el pago.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = ipDe(new Headers(req.headers));
  if (!permitido(`pago:${ip}`, 6, 3600)) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un rato o escríbenos por WhatsApp.' }, { status: 429 });
  }

  const cita = citaPorToken(token);
  if (!cita) return NextResponse.json({ error: 'Cita no encontrada.' }, { status: 404 });
  if (!['reservada', 'confirmada'].includes(cita.estado)) {
    return NextResponse.json({ error: 'Esta cita ya no está activa.' }, { status: 409 });
  }
  if (cita.tipo === 'revision' || cita.pago_estado === 'no_aplica') {
    return NextResponse.json({ error: 'Esta cita no lleva pago.' }, { status: 409 });
  }
  if (cita.pago_estado === 'verificado') {
    return NextResponse.json({ error: 'Tu pago ya está verificado: no hace falta subir nada.' }, { status: 409 });
  }

  let referencia = '';
  let comprobante: File | null = null;
  try {
    const f = await req.formData();
    referencia = String(f.get('referencia') ?? '').trim().slice(0, 60);
    const a = f.get('comprobante');
    if (a instanceof File && a.size) comprobante = a;
  } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }

  if (!referencia || !comprobante) {
    return NextResponse.json({ error: 'Hacen falta las dos cosas: la referencia del pago y la captura.' }, { status: 400 });
  }
  if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(comprobante.type)) {
    return NextResponse.json({ error: 'El comprobante tiene que ser una imagen o un PDF.' }, { status: 400 });
  }
  if (comprobante.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: 'El comprobante no puede pasar de 6 MB.' }, { status: 400 });
  }

  const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
  await fs.mkdir(carpeta, { recursive: true });
  const ext = comprobante.type === 'application/pdf' ? 'pdf' : comprobante.type.split('/')[1].replace('jpeg', 'jpg');
  const archivo = `comprobante-${cita.id}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(carpeta, archivo), Buffer.from(await comprobante.arrayBuffer()));

  // El monto se guarda si no estaba (las de efectivo sí lo tienen; por si acaso).
  const usd = cita.pago_monto_usd ?? cfgNum(cita.modalidad === 'online' ? 'precio_consulta_online' : 'precio_consulta_presencial', 0);
  const t = await tasaDelDia().catch(() => ({ valor: 0 }));
  db.prepare(
    `UPDATE citas SET pago_estado = 'pendiente', pago_metodo = 'transferencia',
       pago_referencia = ?, pago_archivo = ?, pago_monto_usd = ?,
       pago_tasa = COALESCE(pago_tasa, ?), pago_monto_bs = COALESCE(pago_monto_bs, ?)
     WHERE id = ?`
  ).run(referencia, archivo, usd, t.valor || null, t.valor ? Math.round(usd * t.valor * 100) / 100 : null, cita.id);

  notificar(
    'pago_sin_verificar',
    `${cita.paciente_nombre} subió su comprobante de pago (ref. ${referencia}) para su cita del ${fechaLarga(soloFecha(cita.fecha_hora))} ${hora12(soloHora(cita.fecha_hora))}: verifícalo.`,
    `/panel/pacientes/${cita.paciente_id}`
  );
  return NextResponse.json({ ok: true });
}
