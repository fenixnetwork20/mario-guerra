import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import { ruta } from '@/lib/rutas';
import { db, cfg } from '@/lib/db';
import { cuposLibres } from '@/lib/agenda';
import { citaPorToken } from '@/lib/citas';
import { MarcoPublico } from '@/componentes/MarcoPublico';
import { Aparece } from '@/componentes/Aparece';
import { AsistenteCitas } from '@/componentes/AsistenteCitas';

export const dynamic = 'force-dynamic';

/**
 * La foto de fondo: se toma la más reciente de `public/marca/foto-reserva*`.
 *
 * `/_next/image` cachea 4 horas y su URL es el nombre del archivo, así que
 * sobrescribir la misma foto deja media tarde de gente viendo la anterior. Y no
 * se puede colgar un `?v=` para forzarlo: el optimizador de Next responde 400 a
 * cualquier ruta local con query. Por eso la versión va en el NOMBRE: para
 * cambiar la foto se suelta un archivo nuevo —`foto-reserva-<lo-que-sea>.jpg`—
 * y esto lo toma solo, sin tocar código y sin caché vieja.
 */
function fotoFondo() {
  const dir = path.join(process.cwd(), 'public', 'marca');
  try {
    const elegida = readdirSync(dir)
      .filter((n) => /^foto-reserva.*\.(jpe?g|png|webp)$/i.test(n))
      .map((n) => ({ n, t: statSync(path.join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0];
    if (elegida) return ruta(`/marca/${elegida.n}`);
  } catch { /* sin carpeta o sin permisos: cae al nombre de siempre */ }
  return ruta('/marca/foto-reserva.jpg');
}

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
      {/* Sin portada aparte: el titular y los tres botones viven dentro de la
          misma tarjeta, sobre el petróleo con el retrato muy bajado detrás.
          Todo lo que hay que decidir cabe en una pantalla, sin scroll. */}
      <section className="relative overflow-hidden bg-[var(--color-tinta)] pt-20 pb-12 sm:py-16 flex-1 [@media(max-height:730px)]:pt-8">
        {/* El retrato es el fondo, no un adorno: se ve, desenfocado, y sobre él
            va la tarjeta de vidrio. El velo de petróleo sube desde abajo para
            que el texto de la tarjeta tenga siempre suelo oscuro debajo. */}
        {/* En escritorio el retrato ocupa la mitad izquierda —un retrato vertical
            estirado a lo ancho de la pantalla se convierte en un primerísimo
            plano— y se funde hacia la derecha, donde va la tarjeta. */}
        <div
          className="absolute inset-0 lg:right-[26%] overflow-hidden lg:[mask-image:linear-gradient(to_left,transparent_0%,#000_45%)]"
          aria-hidden
        >
          <Image
            src={fotoFondo()}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 62vw"
            className="object-cover object-[50%_34%] lg:object-[50%_30%] blur-[5px] scale-105 brightness-[1.06]"
          />
          <div className="hidden lg:block absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-tinta)] via-[var(--color-tinta)]/85 to-transparent" />
          {/* Velo suave: lo justo para que el vidrio despegue del fondo. En
              escritorio se carga al lado derecho, donde va la tarjeta, y deja
              limpia la mitad izquierda que es donde queda el retrato. */}
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-tinta)]/45 via-[var(--color-tinta)]/12 to-[var(--color-tinta)]" />
          <div className="hidden lg:block absolute inset-0 bg-gradient-to-l from-[var(--color-tinta)] via-[var(--color-tinta)]/45 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_28%,transparent_50%,rgba(6,23,32,.55)_100%)]" />
        </div>

        <div className="contenedor relative">
          {/* En escritorio la columna se corre a la derecha: el retrato queda a
              la izquierda, entero y sin nada encima. */}
          <div className="px-1 sm:px-0 lg:ml-auto lg:mr-0 lg:w-[38rem]">
          {/* La `key` fuerza el remontaje al pasar de /reservar a /reservar?desde=…:
              sin ella, el asistente se queda con el estado de la pantalla anterior
              y el paciente no ve el paso de reprogramación. */}
          <AsistenteCitas
            key={desde ?? 'menu'}
            dias={cuposLibres(undefined, excluir)}
            procedimientos={procedimientos}
            whatsapp={cfg('whatsapp_consultorio', '')}
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
          >
            <QueIncluye />
          </AsistenteCitas>
          </div>
        </div>
      </section>

    </MarcoPublico>
  );
}

/** Debajo de la tarjeta y solo en el menú: qué pasa en la consulta. */
function QueIncluye() {
  const puntos = [
    ['Una hora contigo', 'Tiempo suficiente para revisarte, escuchar lo que buscas y responder cada duda.'],
    ['Valoración y presupuesto', 'El doctor evalúa tu caso y te explica qué procedimiento aplica y qué implica.'],
    ['La fecha de tu cirugía', 'Si decides avanzar, de esa misma consulta sale la fecha y el plan de pago.'],
    ['Presencial u online', 'Si estás fuera de Maracaibo, la primera valoración puede ser por videollamada.'],
  ];

  return (
    <Aparece as="section" retraso={120} className="mx-auto w-full max-w-[34rem] mt-12">
      <p className="marca text-[9.5px] text-[var(--color-cobre-luz)] text-center">
        Qué pasa en tu consulta
      </p>
      <ul className="mt-7 space-y-5">
        {puntos.map(([titulo, texto], i) => (
          <li key={titulo} className="flex gap-4">
            <span className="marca text-[10px] text-[var(--color-cobre-luz)] pt-1 tabular-nums shrink-0">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-[14.5px] font-medium text-white">{titulo}</p>
              <p className="text-[13px] text-[var(--color-nude)]/70 mt-1 leading-relaxed">{texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </Aparece>
  );
}
