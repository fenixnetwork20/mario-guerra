import Image from 'next/image';
import { ruta } from '@/lib/rutas';
import { db } from '@/lib/db';
import { cuposLibres } from '@/lib/agenda';
import { citaPorToken } from '@/lib/citas';
import { MarcoPublico, Portada, Divisor } from '@/componentes/MarcoPublico';
import { Aparece } from '@/componentes/Aparece';
import { FormularioReserva } from '@/componentes/FormularioReserva';

export const dynamic = 'force-dynamic';

export default async function Reservar({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  const { desde } = await searchParams;
  const anterior = desde ? citaPorToken(desde) : undefined;

  const procedimientos = (
    db.prepare('SELECT nombre FROM procedimientos_catalogo WHERE activo = 1 ORDER BY orden, nombre')
      .all() as { nombre: string }[]
  ).map((p) => p.nombre);

  // Si viene de una reprogramación, su propio cupo actual también está disponible.
  const excluir = anterior && ['reservada', 'confirmada'].includes(anterior.estado) ? anterior.id : undefined;

  return (
    <MarcoPublico>
      <Portada
        kicker="Consulta de valoración"
        titulo={<>Agenda tu cita<br />en un minuto</>}
        bajada="Escoge el día y la hora que te sirva. Al terminar recibes un enlace privado para confirmar, reprogramar o cancelar cuando quieras, sin escribirle a nadie."
      />

      {/* El formulario va sobre el petróleo con el retrato detrás, muy bajado:
          los pasos quedan en tarjetas claras y se leen sin esfuerzo. */}
      <section className="modulo relative overflow-hidden bg-[var(--color-tinta)]">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={ruta('/marca/foto-doctor.jpg')}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[45%_30%] opacity-[0.22] blur-[3px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-tinta)] via-[var(--color-tinta)]/70 to-[var(--color-tinta)]" />
        </div>

        <div className="contenedor relative">
          <FormularioReserva
            sobreOscuro
            dias={cuposLibres(undefined, excluir)}
            procedimientos={procedimientos}
            reprogramando={
              anterior && excluir
                ? {
                    token: desde!,
                    nombre: anterior.paciente_nombre,
                    cedula: anterior.cedula,
                    whatsapp: anterior.whatsapp,
                    procedimiento: anterior.procedimiento_interes ?? '',
                    modalidad: (anterior.modalidad ?? 'presencial') as 'presencial' | 'online',
                    fechaActual: anterior.fecha_hora,
                  }
                : null
            }
          />
        </div>
      </section>

      <Divisor />

      <QueIncluye />
    </MarcoPublico>
  );
}

/** Módulo oscuro de media imagen — la variante `half-image dark` del sistema. */
function QueIncluye() {
  const puntos = [
    ['Una hora contigo', 'Tiempo suficiente para revisarte, escuchar lo que buscas y responder cada duda.'],
    ['Valoración y presupuesto', 'El doctor evalúa tu caso y te explica qué procedimiento aplica y qué implica.'],
    ['La fecha de tu cirugía', 'Si decides avanzar, de esa misma consulta sale la fecha y el plan de pago.'],
    ['Presencial u online', 'Si estás fuera de Maracaibo, la primera valoración puede ser por videollamada.'],
  ];

  return (
    <section className="modulo modulo-oscuro overflow-hidden">
      <div className="contenedor grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <Aparece>
          <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Qué pasa en tu consulta</p>
          <h2 className="display text-[24px] sm:text-[30px] mt-4 text-white">
            Antes de operar,<br />primero entender
          </h2>
          <span className="block h-px w-16 bg-[var(--color-cobre-luz)] mt-6" />
          <ul className="mt-8 space-y-6">
            {puntos.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="marca text-[10px] text-[var(--color-cobre-luz)] pt-1 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-[15px] font-medium text-white">{titulo}</p>
                  <p className="text-[13.5px] text-[var(--color-nude)]/70 mt-1 leading-relaxed">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </Aparece>

        <Aparece retraso={120} className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
            <Image
              src={ruta('/marca/foto-quirofano.jpg')}
              alt="El Dr. Guerra y su equipo en quirófano"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg" />
          </div>
        </Aparece>
      </div>
    </section>
  );
}
