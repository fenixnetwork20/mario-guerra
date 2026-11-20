import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ahoraVET, fechaLarga, hora12, soloFecha, soloHora, sumarMinutos } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

/**
 * Lo consulta el bot (n8n) antes de cada respuesta. Kerin Castillo reservó,
 * mandó la captura y preguntó "¿queda así la cita?"; el bot no lo sabía, la
 * pasó a una persona y se quedó esperando. Con esto el bot contesta él mismo.
 * Se busca por la cédula que la persona escribe en su mensaje, como el botón
 * "Confirmar mi cita" de la página: el número de WhatsApp no sirve, mucha
 * gente reserva con el de otro familiar.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (!process.env.CRON_TOKEN || u.searchParams.get('token') !== process.env.CRON_TOKEN) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const cedula = cedulaEn(u.searchParams.get('mensaje') ?? '');
  if (!cedula) return NextResponse.json({ texto: 'SIN CEDULA (la persona no escribió su cédula en este mensaje)' });

  const filas = db.prepare(
    `SELECT c.tipo, c.modalidad, c.fecha_hora, c.estado, c.pago_estado, c.pago_metodo, c.pago_archivo,
            p.nombre, p.cedula
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.fecha_hora >= ?
        AND (c.estado IN ('reservada', 'confirmada')
             OR (c.estado = 'cancelada' AND c.created_at >= datetime('now', '-30 days')))
      ORDER BY c.fecha_hora`
  // Desde dos horas atrás, como buscar-cita: la que está en curso también cuenta.
  ).all(sumarMinutos(ahoraVET(), -120)) as Array<{
    tipo: string; modalidad: string | null; fecha_hora: string; estado: string;
    pago_estado: string; pago_metodo: string | null; pago_archivo: string | null; nombre: string; cedula: string;
  }>;
  const suyas = filas.filter((f) => f.cedula.replace(/[^0-9]/g, '') === cedula);
  if (!suyas.length) return NextResponse.json({ texto: `NINGUNA con la cédula ${cedula}` });

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
    return `- cédula ${cedula}, ${tipo} a nombre de ${c.nombre}: ${fechaLarga(soloFecha(c.fecha_hora))} a las ${hora12(soloHora(c.fecha_hora))}, ${modo} · ${estado}${pago}`;
  }).join('\n');
  return NextResponse.json({ texto });
}

/**
 * La cédula dentro de lo que escribió: "V-13.592.540", "13592540", "e 8123456".
 * De 6 a 9 cifras; un teléfono (11) o un monto (2-3) no calzan.
 */
function cedulaEn(texto: string): string {
  const m = texto.match(/(?<![0-9])(?:[VvEe][-.\s]?)?(\d{1,3}(?:[.\s]?\d{3}){1,2})(?![0-9])/g) ?? [];
  for (const x of m) {
    const d = x.replace(/[^0-9]/g, '');
    if (d.length >= 6 && d.length <= 9) return d;
  }
  return '';
}
