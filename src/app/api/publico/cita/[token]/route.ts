import { NextResponse } from 'next/server';
import { cancelarCita, citaPorToken, confirmarCita } from '@/lib/citas';
import { confirmacionAbierta } from '@/lib/recordatorios';
import { permitido, ipDe } from '@/lib/ratelimit';
import { fechaLarga, hora12, soloFecha, soloHora } from '@/lib/fechas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = ipDe(new Headers(req.headers));
  if (!permitido(`cita:${ip}`, 30, 600)) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Espera un momento.' }, { status: 429 });
  }

  const cita = citaPorToken(token);
  if (!cita) return NextResponse.json({ error: 'Cita no encontrada.' }, { status: 404 });

  let accion = '';
  try { accion = (await req.json()).accion; } catch { /* vacío */ }

  if (accion === 'confirmar') {
    if (cita.estado === 'confirmada') return NextResponse.json({ ok: true, estado: 'confirmada' });
    if (cita.estado !== 'reservada') {
      return NextResponse.json({ error: 'Esta cita ya no se puede confirmar.' }, { status: 409 });
    }
    // La confirmación se hace cuando se le recuerda la cita, no al reservarla.
    if (!confirmacionAbierta(cita.fecha_hora)) {
      return NextResponse.json(
        { error: 'Todavía no hace falta confirmar. Un día antes te escribimos por WhatsApp y ahí confirmas con un toque.' },
        { status: 409 }
      );
    }
    confirmarCita(cita.id);
    return NextResponse.json({ ok: true, estado: 'confirmada' });
  }

  if (accion === 'cancelar') {
    if (!['reservada', 'confirmada'].includes(cita.estado)) {
      return NextResponse.json({ error: 'Esta cita ya no está activa.' }, { status: 409 });
    }
    // El paciente ya está en la web: no se le gasta un mensaje de WhatsApp.
    await cancelarCita(cita.id, {
      motivo: 'Cancelada por el paciente',
      plantilla: null,
      tipoNotif: 'cancelo_paciente',
    });
    return NextResponse.json({ ok: true, estado: 'cancelada' });
  }

  return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cita = citaPorToken(token);
  if (!cita) return NextResponse.json({ error: 'Cita no encontrada.' }, { status: 404 });
  return NextResponse.json({
    estado: cita.estado,
    cuando: `${fechaLarga(soloFecha(cita.fecha_hora))} ${hora12(soloHora(cita.fecha_hora))}`,
  });
}
