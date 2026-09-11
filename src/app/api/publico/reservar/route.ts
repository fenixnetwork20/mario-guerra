import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cupoDisponible } from '@/lib/agenda';
import { buscarOCrearPaciente, crearCita, citaPorToken } from '@/lib/citas';
import { notificar } from '@/lib/notificaciones';
import { enviarPlantilla, linkGestion } from '@/lib/mensajeria';
import { permitido, ipDe } from '@/lib/ratelimit';
import { fechaLarga, hora12, soloFecha, soloHora } from '@/lib/fechas';
import {
  primerError, validarCedula, validarEdad, validarMomento, validarNombre, validarWhatsapp,
} from '@/lib/validar';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = ipDe(new Headers(req.headers));
  if (!permitido(`reservar:${ip}`, 8, 3600)) {
    return NextResponse.json(
      { error: 'Se hicieron demasiadas reservas desde esta conexión. Intenta más tarde o escríbenos por WhatsApp.' },
      { status: 429 }
    );
  }

  let b: Record<string, string>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }

  const error = primerError(
    validarNombre(b.nombre), validarCedula(b.cedula), validarWhatsapp(b.whatsapp),
    validarEdad(b.edad), validarMomento(b.inicio)
  );
  if (error) return NextResponse.json({ error }, { status: 400 });

  if (b.modalidad !== 'presencial' && b.modalidad !== 'online') {
    return NextResponse.json({ error: 'Elige la modalidad de la consulta.' }, { status: 400 });
  }
  if (!b.procedimiento) {
    return NextResponse.json({ error: 'Elige el procedimiento que te interesa.' }, { status: 400 });
  }

  // Reprogramación: viene con el token de la cita anterior.
  const anterior = b.desde ? citaPorToken(b.desde) : undefined;
  const excluir = anterior && ['reservada', 'confirmada'].includes(anterior.estado) ? anterior.id : undefined;

  if (!cupoDisponible(b.inicio, undefined, excluir)) {
    return NextResponse.json(
      { error: 'Ese horario acaba de ocuparse. Elige otro, por favor.', recargar: true },
      { status: 409 }
    );
  }

  const paciente = buscarOCrearPaciente({
    nombre: b.nombre, cedula: b.cedula, whatsapp: b.whatsapp,
    edad: b.edad ? Number(b.edad) : null,
  });

  const cita = db.transaction(() => {
    if (excluir) {
      db.prepare("UPDATE citas SET estado = 'reprogramada' WHERE id = ?").run(excluir);
    }
    return crearCita({
      pacienteId: paciente.id,
      tipo: 'valoracion',
      modalidad: b.modalidad as 'presencial' | 'online',
      fechaHora: b.inicio,
      origen: 'link',
      procedimientoInteres: b.procedimiento,
    });
  })();

  const cuando = `${fechaLarga(soloFecha(cita.fecha_hora))} a las ${hora12(soloHora(cita.fecha_hora))}`;

  // El enlace privado también por WhatsApp: en pantalla se ve una vez y se pierde.
  // Si falla, la reserva ya está hecha y el motivo queda en mensajes_enviados.
  await enviarPlantilla({
    clave: 'reserva_recibida',
    pacienteId: paciente.id,
    citaId: cita.id,
    destino: paciente.whatsapp,
    variables: {
      nombre: paciente.nombre,
      fecha: fechaLarga(soloFecha(cita.fecha_hora)),
      hora: hora12(soloHora(cita.fecha_hora)),
      link: linkGestion(cita.token_gestion),
    },
  });

  notificar(
    'reserva_nueva',
    `${excluir ? 'Reprogramación' : 'Nueva reserva'}: ${paciente.nombre} — ${cuando} (${b.modalidad})`,
    `/panel/agenda?fecha=${soloFecha(cita.fecha_hora)}`
  );

  return NextResponse.json({ token: cita.token_gestion });
}
