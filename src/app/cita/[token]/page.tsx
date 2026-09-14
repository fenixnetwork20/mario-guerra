import { notFound } from 'next/navigation';
import { cfg } from '@/lib/db';
import { citaPorToken } from '@/lib/citas';
import { confirmacionAbierta } from '@/lib/recordatorios';
import { fechaLarga, hora12, soloFecha, soloHora } from '@/lib/fechas';
import { MarcoPublico, Portada, Divisor } from '@/componentes/MarcoPublico';
import { Aparece } from '@/componentes/Aparece';
import { AccionesCita } from '@/componentes/AccionesCita';

export const dynamic = 'force-dynamic';

export default async function PaginaCita({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ nueva?: string; confirmar?: string }>;
}) {
  const { token } = await params;
  const { nueva, confirmar } = await searchParams;
  const cita = citaPorToken(token);
  if (!cita) notFound();

  const cuando = `${fechaLarga(soloFecha(cita.fecha_hora))} a las ${hora12(soloHora(cita.fecha_hora))}`;
  const direccion = cfg('direccion', '');
  const wa = cfg('whatsapp_consultorio', '');
  const esNueva = nueva === '1';
  // Confirmar solo se ofrece cuando toca: desde que pudo salir el recordatorio.
  const puedeConfirmar = cita.estado === 'reservada' && confirmacionAbierta(cita.fecha_hora);

  return (
    <MarcoPublico>
      <Portada
        compacta
        foto={null}
        kicker={esNueva ? 'Reserva recibida' : 'Tu cita'}
        titulo={<>{fechaLarga(soloFecha(cita.fecha_hora))}<br />a las {hora12(soloHora(cita.fecha_hora))}</>}
        bajada={
          esNueva
            ? 'Guarda este enlace: desde aquí puedes reprogramar o cancelar cuando quieras. Un día antes te escribimos por WhatsApp para que confirmes tu asistencia.'
            : undefined
        }
      />

      <Divisor />

      <section className="modulo">
        <div className="contenedor grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 lg:gap-8 items-start">
          <Aparece as="section" className="tarjeta p-5 sm:p-6 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <p className="marca text-[9.5px] text-[var(--color-cobre)]">Consulta de valoración</p>
              <EstadoPill estado={cita.estado} />
            </div>

            <dl className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <Dato titulo="Paciente" valor={cita.paciente_nombre} />
              <Dato titulo="Cédula" valor={cita.cedula} />
              <Dato titulo="WhatsApp" valor={cita.whatsapp} />
              <Dato titulo="Modalidad" valor={cita.modalidad ?? '—'} />
              <Dato titulo="Procedimiento de interés" valor={cita.procedimiento_interes ?? '—'} />
              <Dato titulo="Puntualidad" valor="Si pasan 5 minutos de la hora, la valoración se cancela." />
              {cita.modalidad === 'presencial' && direccion && <Dato titulo="Dirección" valor={direccion} />}
            </dl>
          </Aparece>

          <Aparece retraso={90} className="min-w-0">
            <AccionesCita
              token={token}
              estadoInicial={cita.estado}
              cuando={cuando}
              whatsappConsultorio={wa}
              puedeConfirmar={puedeConfirmar}
              abrirConfirmar={confirmar === '1' && puedeConfirmar}
            />
          </Aparece>
        </div>
      </section>
    </MarcoPublico>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="etiqueta">{titulo}</dt>
      <dd className="mt-1">{valor}</dd>
    </div>
  );
}

function EstadoPill({ estado }: { estado: string }) {
  const mapa: Record<string, { texto: string; clase: string }> = {
    reservada: { texto: 'Falta confirmar', clase: 'bg-[var(--color-aviso-luz)] text-[var(--color-aviso)]' },
    confirmada: { texto: 'Confirmada', clase: 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]' },
    cancelada: { texto: 'Cancelada', clase: 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]' },
    reprogramada: { texto: 'Reprogramada', clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' },
    completada: { texto: 'Atendida', clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' },
    no_asistio: { texto: 'No asistió', clase: 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]' },
  };
  const e = mapa[estado] ?? { texto: estado, clase: 'bg-[var(--color-papel-2)]' };
  return <span className={`pill ${e.clase}`}>{e.texto}</span>;
}
