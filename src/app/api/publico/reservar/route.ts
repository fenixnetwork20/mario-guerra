import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { db, cfgNum } from '@/lib/db';
import { tasaDelDia } from '@/lib/tasa';
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

  // El comprobante de pago viene como archivo, así que la reserva llega en
  // multipart. Se acepta JSON también por si algo viejo todavía lo manda así.
  let b: Record<string, string> = {};
  let comprobante: File | null = null;
  const tipo = req.headers.get('content-type') || '';
  try {
    if (tipo.includes('multipart/form-data')) {
      const f = await req.formData();
      for (const [k, v] of f.entries()) {
        if (v instanceof File) { if (k === 'comprobante' && v.size) comprobante = v; }
        else b[k] = String(v);
      }
    } else {
      b = await req.json();
    }
  } catch { return NextResponse.json({ error: 'Petición inválida.' }, { status: 400 }); }

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

  if (comprobante) {
    if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(comprobante.type)) {
      return NextResponse.json({ error: 'El comprobante tiene que ser una imagen o un PDF.' }, { status: 400 });
    }
    if (comprobante.size > 6 * 1024 * 1024) {
      return NextResponse.json({ error: 'El comprobante no puede pasar de 6 MB.' }, { status: 400 });
    }
  }

  const paciente = buscarOCrearPaciente({
    nombre: b.nombre, cedula: b.cedula, whatsapp: b.whatsapp,
    edad: b.edad ? Number(b.edad) : null,
  });

  // Si viene de reprogramar y esa cita ya estaba pagada, el pago se muda con
  // ella. Sin esto, al paciente que ya pagó su consulta se le pedía pagarla de
  // nuevo solo por mover la fecha.
  type PagoPrevio = {
    pago_estado: string; pago_monto_usd: number | null; pago_monto_bs: number | null;
    pago_tasa: number | null; pago_referencia: string | null; pago_archivo: string | null;
    pago_verificado_at: string | null;
  };
  const pagoPrevio = excluir
    ? (db.prepare(
        `SELECT pago_estado, pago_monto_usd, pago_monto_bs, pago_tasa,
                pago_referencia, pago_archivo, pago_verificado_at
           FROM citas WHERE id = ?`
      ).get(excluir) as PagoPrevio | undefined)
    : undefined;
  const traePago = Boolean(pagoPrevio && pagoPrevio.pago_monto_usd != null);

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

  if (traePago && pagoPrevio) {
    // El pago viaja tal cual: si estaba verificado sigue verificado, con su
    // referencia y su comprobante. Y se suelta de la cita vieja para que el
    // mismo dinero no aparezca dos veces en la agenda.
    db.prepare(
      `UPDATE citas SET pago_estado = ?, pago_monto_usd = ?, pago_monto_bs = ?, pago_tasa = ?,
                        pago_referencia = ?, pago_archivo = ?, pago_verificado_at = ?
        WHERE id = ?`
    ).run(
      pagoPrevio.pago_estado, pagoPrevio.pago_monto_usd, pagoPrevio.pago_monto_bs,
      pagoPrevio.pago_tasa, pagoPrevio.pago_referencia, pagoPrevio.pago_archivo,
      pagoPrevio.pago_verificado_at, cita.id
    );
    db.prepare(
      `UPDATE citas SET pago_estado = 'pendiente', pago_monto_usd = NULL, pago_monto_bs = NULL,
                        pago_tasa = NULL, pago_referencia = NULL, pago_archivo = NULL,
                        pago_verificado_at = NULL,
                        notas = TRIM(COALESCE(notas, '') || ?)
        WHERE id = ?`
    ).run(`\nPago trasladado a la cita del ${b.inicio}.`, excluir);
  } else {
  // El pago: monto, tasa del día y comprobante. La cita queda 'pendiente' hasta
  // que recepción lo verifique; el cupo ya está apartado igual.
  try {
    const usd = cfgNum(cita.modalidad === 'online' ? 'precio_consulta_online' : 'precio_consulta_presencial', 0);
    const t = await tasaDelDia();
    let archivo: string | null = null;
    if (comprobante) {
      const carpeta = process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');
      await fs.mkdir(carpeta, { recursive: true });
      const ext = comprobante.type === 'application/pdf' ? 'pdf' : comprobante.type.split('/')[1].replace('jpeg', 'jpg');
      archivo = `comprobante-${cita.id}-${Date.now()}.${ext}`;
      await fs.writeFile(path.join(carpeta, archivo), Buffer.from(await comprobante.arrayBuffer()));
    }
    db.prepare(
      `UPDATE citas SET pago_estado = 'pendiente', pago_monto_usd = ?, pago_tasa = ?,
         pago_monto_bs = ?, pago_referencia = ?, pago_archivo = ? WHERE id = ?`
    ).run(usd, t.valor || null, t.valor ? Math.round(usd * t.valor * 100) / 100 : null,
          (b.referencia || '').slice(0, 60) || null, archivo, cita.id);
  } catch (e) {
    // Que falle el comprobante no puede tumbar la reserva: el cupo ya es suyo.
    console.error('pago de la cita', cita.id, e);
  }
  }

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
