import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { permitido, ipDe } from '@/lib/ratelimit';
import { ahoraVET, fechaLarga, hora12, soloFecha, soloHora } from '@/lib/fechas';
import { normalizarCedula, validarCedula } from '@/lib/validar';
import { confirmacionAbierta } from '@/lib/recordatorios';

export const dynamic = 'force-dynamic';

/**
 * Búsqueda de cita por cédula para el menú guiado de /reservar (confirmar y
 * cancelar/reprogramar sin tener a mano el enlace privado).
 *
 * La cédula es el único dato que se pide —decisión del consultorio—, así que
 * todo lo que se puede endurecer sin pedirle nada más al paciente, se endurece:
 *   · 5 intentos por IP cada 10 minutos;
 *   · una sola respuesta para "cédula mal escrita" y para "no tiene cita", de
 *     modo que esto no sirva para averiguar si una cédula tiene cita o no;
 *   · se devuelven fecha, hora, modalidad y estado. NUNCA el nombre, el
 *     teléfono ni el procedimiento de interés: ese es el dato sensible.
 * Solo se exponen las consultas de valoración. Cirugías y revisiones postop
 * las mueve el consultorio.
 */
const GENERICO = 'No encontramos una cita activa con esa cédula. Revisa el número o escríbenos por WhatsApp.';

type Fila = { token_gestion: string; fecha_hora: string; modalidad: string | null; estado: string };

export async function POST(req: Request) {
  const ip = ipDe(new Headers(req.headers));
  if (!permitido(`buscarcita:${ip}`, 5, 600)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera unos minutos o escríbenos por WhatsApp.' },
      { status: 429 }
    );
  }

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: GENERICO }, { status: 404 }); }

  if (!validarCedula(b.cedula ?? '').ok) {
    return NextResponse.json({ error: GENERICO }, { status: 404 });
  }

  const filas = db.prepare(
    `SELECT c.token_gestion, c.fecha_hora, c.modalidad, c.estado
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE p.cedula = ?
        AND c.tipo = 'valoracion'
        AND c.estado IN ('reservada', 'confirmada')
        AND c.fecha_hora >= ?
      ORDER BY c.fecha_hora
      LIMIT 5`
  ).all(normalizarCedula(b.cedula), ahoraVET()) as Fila[];

  if (!filas.length) return NextResponse.json({ error: GENERICO }, { status: 404 });

  return NextResponse.json({
    citas: filas.map((f) => ({
      token: f.token_gestion,
      estado: f.estado,
      modalidad: f.modalidad ?? 'presencial',
      puedeConfirmar: f.estado === 'reservada' && confirmacionAbierta(f.fecha_hora),
      cuando: `${fechaLarga(soloFecha(f.fecha_hora))} a las ${hora12(soloHora(f.fecha_hora))}`,
    })),
  });
}
