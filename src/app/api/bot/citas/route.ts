import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizarTelefono } from '@/lib/mensajeria';
import { ahoraVET, fechaLarga, hora12, soloFecha, soloHora, sumarMinutos } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

/**
 * Lo consulta el bot (n8n) antes de cada respuesta: las citas que tiene el
 * número que está escribiendo. Kerin Castillo reservó, mandó la captura y
 * preguntó "¿queda así la cita?"; el bot no lo sabía, la pasó a una persona y
 * se quedó esperando. Con esto el bot contesta él mismo.
 * Solo por el teléfono de quien escribe: nunca se le cuentan citas ajenas.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (!process.env.CRON_TOKEN || u.searchParams.get('token') !== process.env.CRON_TOKEN) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const tel = normalizarTelefono(u.searchParams.get('telefono') ?? '');
  if (tel.length < 10) return NextResponse.json({ texto: 'NO SE SABE (no llegó el número de quien escribe)' });

  const filas = db.prepare(
    `SELECT c.tipo, c.modalidad, c.fecha_hora, c.estado, c.pago_estado, c.pago_metodo, c.pago_archivo,
            p.nombre, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.fecha_hora >= ?
        AND (c.estado IN ('reservada', 'confirmada')
             OR (c.estado = 'cancelada' AND c.created_at >= datetime('now', '-30 days')))
      ORDER BY c.fecha_hora`
  // Desde dos horas atrás, como buscar-cita: la que está en curso también cuenta.
  ).all(sumarMinutos(ahoraVET(), -120)) as Array<{
    tipo: string; modalidad: string | null; fecha_hora: string; estado: string;
    pago_estado: string; pago_metodo: string | null; pago_archivo: string | null; nombre: string; whatsapp: string;
  }>;
  const suyas = filas.filter((f) => normalizarTelefono(f.whatsapp) === tel);
  if (!suyas.length) return NextResponse.json({ texto: 'NINGUNA a nombre de este número' });

  const texto = suyas.map((c) => {
    const tipo = c.tipo === 'revision' ? 'cita de control' : 'consulta de valoración';
    const modo = c.modalidad === 'online' ? 'por videollamada' : 'presencial en el consultorio';
    const estado =
      c.estado === 'cancelada' ? 'CANCELADA (ya no está en la agenda)'
      : c.estado === 'confirmada' ? 'RESERVADA Y CONFIRMADA'
      : 'RESERVADA, falta por confirmar (un día antes le escribimos por WhatsApp para que confirme)';
    const pago =
      c.estado === 'cancelada' || c.pago_estado === 'no_aplica' ? ''
      : c.pago_estado === 'verificado' ? ' · pago: recibido'
      : c.pago_estado === 'pendiente' && c.pago_archivo ? ' · pago: comprobante recibido, el consultorio lo está revisando'
      : c.pago_metodo === 'efectivo' ? ' · pago: en efectivo el día de la consulta'
      : c.pago_estado === 'rechazado' ? ' · pago: el comprobante no se pudo validar, debe enviarlo de nuevo'
      : ' · pago: pendiente';
    return `- ${tipo} a nombre de ${c.nombre}: ${fechaLarga(soloFecha(c.fecha_hora))} a las ${hora12(soloHora(c.fecha_hora))}, ${modo} · ${estado}${pago}`;
  }).join('\n');
  return NextResponse.json({ texto });
}
