import type { Metadata } from 'next';
import { ruta } from '@/lib/rutas';
import Image from 'next/image';
import Link from 'next/link';
import { cfg } from '@/lib/db';
import { normalizarTelefono } from '@/lib/mensajeria';
import { Aparece } from '@/componentes/Aparece';
import { CabeceraLanding } from '@/componentes/landing/CabeceraLanding';
import { EncabezadoSeccion } from '@/componentes/landing/EncabezadoSeccion';
import { HeroLanding } from '@/componentes/landing/HeroLanding';
import { Procedimientos, type Categoria } from '@/componentes/landing/Procedimientos';
import { Testimonios, type Testimonio } from '@/componentes/landing/Testimonios';
import { BarraMovil } from '@/componentes/landing/BarraMovil';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dr. Mario Guerra | Cirujano Plástico en Maracaibo',
  description:
    'Cirugía plástica y reconstructiva en Maracaibo. Valoración honesta, resultados naturales y acompañamiento antes, durante y después. Agenda tu consulta.',
  openGraph: {
    title: 'Dr. Mario Guerra | Cirujano Plástico en Maracaibo',
    description:
      'Valoración honesta, resultados naturales y acompañamiento en todo el proceso. Agenda tu consulta.',
    images: [ruta('/marca/foto-doctor.jpg')],
    locale: 'es_VE',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const GPS = 'https://maps.app.goo.gl/FNh72gqEtimSv26XA';
const REDES = [
  { nombre: 'Instagram', usuario: '@DRMARIOGUERRA', url: 'https://www.instagram.com/drmarioguerra/' },
  { nombre: 'TikTok', usuario: '@DRMARIOGUERRAOFICIAL', url: 'https://www.tiktok.com/@drmarioguerraoficial' },
  { nombre: 'Facebook', usuario: 'DR MARIOGUERRA', url: 'https://www.facebook.com/DRMARIOGUERRA' },
];

// Recuperación y anestesia de referencia (del brief). Sin precios, en ningún lado.
const GENERAL = { recuperacion: '2 a 3 semanas', anestesia: 'General' };
const SIN_QUIROFANO = { recuperacion: 'Sin reposo', anestesia: 'Tópica o local' };

const CATEGORIAS: Categoria[] = [
  {
    clave: 'cuerpo',
    nombre: 'Cuerpo',
    descripcion: 'Contorno, abdomen y definición.',
    procedimientos: [
      { nombre: 'Lipoescultura', ...GENERAL },
      { nombre: 'Abdominoplastia', ...GENERAL },
      { nombre: 'Mela abdominal', ...GENERAL },
      { nombre: 'Minidermo', ...GENERAL },
      { nombre: 'Lipo de papada', ...GENERAL },
      { nombre: 'Corrección de cicatrices', ...GENERAL },
    ],
  },
  {
    clave: 'mamas',
    nombre: 'Mamas',
    descripcion: 'Aumento, levantamiento y reducción.',
    procedimientos: [
      { nombre: 'Aumento mamario', ...GENERAL },
      { nombre: 'Mastopexia con implantes', recuperacion: '4 semanas', anestesia: 'General' },
      { nombre: 'Mastopexia sin implantes', ...GENERAL },
      { nombre: 'Reducción mamaria', ...GENERAL },
    ],
  },
  {
    clave: 'rostro',
    nombre: 'Rostro',
    descripcion: 'Mirada y armonía facial.',
    procedimientos: [
      { nombre: 'Blefaroplastia superior', ...GENERAL },
      { nombre: 'Blefaroplastia inferior', ...GENERAL },
      { nombre: 'Armonización facial', ...SIN_QUIROFANO },
    ],
  },
  {
    clave: 'no-quirurgico',
    nombre: 'No quirúrgico',
    descripcion: 'Sin quirófano y sin reposo.',
    procedimientos: [
      { nombre: 'Toxina botulínica (Botox)', ...SIN_QUIROFANO },
      { nombre: 'Ácido hialurónico', ...SIN_QUIROFANO },
      { nombre: 'Aumento de labios', ...SIN_QUIROFANO },
    ],
  },
];

// Vacío a propósito: aquí solo van testimonios reales de pacientes.
const TESTIMONIOS: Testimonio[] = [];

export default function Landing() {
  const direccion = cfg('direccion', '');
  const telefono = cfg('whatsapp_consultorio', '04129086272');
  const emergencias = cfg('whatsapp_emergencias', '');
  const whatsapp = `https://wa.me/${normalizarTelefono(telefono)}?text=${encodeURIComponent(
    'Hola, quisiera información sobre una consulta de valoración.'
  )}`;
  const mapa = `https://www.google.com/maps?q=${encodeURIComponent(
    direccion || 'Av. 3H entre calle 70 y 71, Bella Vista, Maracaibo, Zulia'
  )}&output=embed`;

  return (
    <div className="bg-[var(--color-papel)] pb-16 lg:pb-0">
      <CabeceraLanding whatsapp={whatsapp} />

      <HeroLanding
        whatsapp={whatsapp}
        fotos={[
          { src: ruta('/marca/foto-doctor.jpg'), alt: 'Dr. Mario Guerra, cirujano plástico en Maracaibo' },
        ]}
      />

      {/* ── Enfoque ─────────────────────────────────────────────────────── */}
      <section id="doctor" className="seccion">
        <div className="contenedor grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Aparece>
            <p className="marca text-[9.5px] text-[var(--color-cobre)]">Sobre el doctor</p>
            <h2 className="titular-menor mt-4">Un enfoque honesto y cercano</h2>
            <span className="regla-cobre mt-6" />
            <p className="entradilla text-[var(--color-tinta-2)] mt-6">
              Cada paciente es diferente, y cada resultado también. El Dr. Mario Guerra combina
              técnica y criterio para ayudarte a lograr lo que buscas, con una valoración clara y
              sin promesas irreales.
            </p>
            <p className="entradilla text-[var(--color-tinta-2)] mt-4">
              Aquí no te vendemos un procedimiento: te evaluamos, te explicamos tus opciones y te
              acompañamos en todo el proceso.
            </p>
          </Aparece>

          <Aparece retraso={110}>
            <div className="zoom-suave relative aspect-[4/5] rounded-lg">
              <Image
                src={ruta('/marca/foto-doctor.jpg')}
                alt="Dr. Mario Guerra en su consultorio"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-[55%_15%]"
              />
            </div>
          </Aparece>
        </div>
      </section>

      {/* ── Procedimientos ──────────────────────────────────────────────── */}
      <section id="procedimientos" className="seccion bg-[var(--color-papel-2)]">
        <div className="contenedor">
          <EncabezadoSeccion kicker="Procedimientos" titulo="Qué se puede hacer">
            Abre la categoría que te interesa para ver los procedimientos, con su recuperación y
            tipo de anestesia.
          </EncabezadoSeccion>

          <div className="mt-12">
            <Procedimientos categorias={CATEGORIAS} />
          </div>
        </div>
      </section>

      {/* ── Resultados ──────────────────────────────────────────────────── */}
      <section id="resultados" className="seccion">
        <div className="contenedor">
          <EncabezadoSeccion kicker="Resultados" titulo="Resultados reales de pacientes reales">
            Los casos se publican en Instagram, siempre con la autorización de cada paciente.
          </EncabezadoSeccion>

          <Aparece retraso={90} className="mt-10">
            <a
              href={REDES[0].url}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-lg border border-[var(--color-linea)] bg-[var(--color-tarjeta)] p-7 sm:p-10 transition-colors hover:border-[var(--color-cobre-luz)]"
            >
              <p className="marca text-[9.5px] text-[var(--color-cobre)]">Instagram</p>
              <p className="titular-menor mt-3">{REDES[0].usuario}</p>
              <p className="text-[14px] text-[var(--color-tinta-2)] mt-4">
                Antes y después, videos y casos del día a día del consultorio.
              </p>
              <span className="marca text-[9.5px] text-[var(--color-cobre)] mt-6 inline-block group-hover:underline">
                Ver el perfil
              </span>
            </a>
          </Aparece>

          <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-6 max-w-xl leading-relaxed">
            Los resultados varían en cada paciente.
          </p>
        </div>
      </section>

      {/* ── Sí / No — el compromiso, partido en dos ─────────────────────── */}
      <SiNo />

      {/* ── Credenciales ────────────────────────────────────────────────── */}
      <section className="seccion modulo-oscuro">
        <div className="contenedor">
          <Aparece>
            <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Respaldo</p>
            <div className="grid sm:grid-cols-3 gap-8 mt-8">
              {[
                ['+10 años', 'de experiencia en cirugía plástica y reconstructiva'],
                ['+500', 'procedimientos realizados con éxito'],
                ['Certificado', 'con certificaciones profesionales vigentes'],
              ].map(([cifra, texto]) => (
                <div key={cifra}>
                  <p className="titular-menor text-white">{cifra}</p>
                  <p className="text-[13.5px] text-[var(--color-nude)]/70 mt-2 leading-relaxed">{texto}</p>
                </div>
              ))}
            </div>
            <p className="text-[13.5px] text-[var(--color-nude)]/70 mt-10 max-w-xl leading-relaxed">
              Las cirugías se realizan en el Centro de Especialidades Quirúrgicas del Sur.
            </p>
          </Aparece>
        </div>
      </section>

      {TESTIMONIOS.length > 0 && (
        <section className="seccion modulo-oscuro">
          <div className="contenedor">
            <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Testimonios</p>
            <div className="mt-8">
              <Testimonios testimonios={TESTIMONIOS} />
            </div>
          </div>
        </section>
      )}

      {/* ── La consulta ─────────────────────────────────────────────────── */}
      <section className="seccion">
        <div className="contenedor grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Aparece className="lg:order-2">
            <p className="marca text-[9.5px] text-[var(--color-cobre)]">La consulta</p>
            <h2 className="titular-menor mt-4">Tu consulta de valoración</h2>
            <span className="regla-cobre mt-6" />
            <p className="entradilla text-[var(--color-tinta-2)] mt-6">
              Disponible presencial u online. Esto es lo que pasa, en orden:
            </p>
            <ol className="mt-8 space-y-5">
              {[
                'El doctor te evalúa.',
                'Aclara todas tus dudas.',
                'Arma tu presupuesto personalizado.',
                'Si lo deseas, define la fecha de tu cirugía.',
              ].map((paso, i) => (
                <li key={paso} className="flex gap-4 items-baseline">
                  <span className="marca text-[10px] text-[var(--color-cobre)] tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px]">{paso}</span>
                </li>
              ))}
            </ol>
            <Link href="/reservar" className="btn btn-principal py-3 px-6 mt-9">
              Agendar consulta
            </Link>
          </Aparece>

          <Aparece retraso={110} className="lg:order-1">
            <div className="zoom-suave relative aspect-[4/3] rounded-lg">
              <Image
                src={ruta('/marca/foto-quirofano.jpg')}
                alt="El Dr. Guerra y su equipo en quirófano"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Aparece>
        </div>
      </section>

      {/* ── Financiamiento ──────────────────────────────────────────────── */}
      <section className="seccion bg-[var(--color-papel-2)]">
        <div className="contenedor">
          <EncabezadoSeccion kicker="Financiamiento" titulo="Financiamiento a tu medida">
            El doctor ofrece planes de financiamiento que se adaptan a cada paciente. Los
            conversamos contigo en la consulta para encontrar la mejor opción.
          </EncabezadoSeccion>
        </div>
      </section>

      {/* ── Cierre y contacto ───────────────────────────────────────────── */}
      <section id="contacto" className="seccion modulo-oscuro">
        <div className="contenedor">
          <Aparece className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-8 lg:gap-16 items-end">
            <div>
              <h2 className="titular text-[var(--color-nude)]">Agenda tu consulta</h2>
              <span className="regla-cobre mt-6" />
              <p className="entradilla medida text-[var(--color-nude)]/80 mt-6">
                Escoge día y hora tú mismo, o escríbenos y te ayudamos.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/reservar"
                className="btn py-3.5 px-7 bg-[var(--color-cobre-luz)] text-[var(--color-tinta)] hover:bg-[var(--color-nude)]">
                Agendar consulta
              </Link>
              <a href={whatsapp} target="_blank" rel="noreferrer"
                className="btn py-3.5 px-7 border-white/30 text-[var(--color-nude)] hover:bg-white/10">
                Escríbenos por WhatsApp
              </a>
            </div>
          </Aparece>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mt-16">
            <Aparece>
              <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Dónde estamos</p>
              <p className="text-[15px] text-[var(--color-nude)]/85 mt-4 leading-relaxed">{direccion}</p>
              <a href={GPS} target="_blank" rel="noreferrer"
                className="btn mt-6 border-white/30 text-[var(--color-nude)] hover:bg-white/10">
                Cómo llegar
              </a>

              <p className="marca text-[9.5px] text-[var(--color-cobre-luz)] mt-10">Contacto</p>
              <p className="text-[15px] text-[var(--color-nude)]/85 mt-4">WhatsApp {telefono}</p>
              {emergencias && (
                <p className="text-[15px] text-[var(--color-nude)]/85">Emergencias 24/7 {emergencias}</p>
              )}

              <p className="marca text-[9.5px] text-[var(--color-cobre-luz)] mt-10">Redes</p>
              <ul className="mt-4 space-y-2">
                {REDES.map((r) => (
                  <li key={r.nombre}>
                    <a href={r.url} target="_blank" rel="noreferrer"
                      className="text-[15px] text-[var(--color-nude)]/85 hover:text-white">
                      {r.nombre} · {r.usuario}
                    </a>
                  </li>
                ))}
              </ul>
            </Aparece>

            <Aparece retraso={110}>
              <div className="rounded-lg overflow-hidden border border-white/10 aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[380px]">
                <iframe
                  src={mapa}
                  title="Ubicación del consultorio"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full border-0"
                />
              </div>
            </Aparece>
          </div>
        </div>
      </section>

      {/* ── Pie ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[var(--color-tinta)] border-t border-white/10">
        <div className="contenedor py-12 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
          <Image src={ruta('/marca/monograma-claro.png')} alt="Dr. Mario Guerra"
            width={79} height={88} className="h-12 w-auto" />
          <div>
            <nav className="flex flex-wrap gap-x-7 gap-y-2">
              {[
                ['#procedimientos', 'Procedimientos'],
                ['#doctor', 'Sobre el Dr.'],
                ['#resultados', 'Resultados'],
                ['#contacto', 'Contacto'],
              ].map(([href, texto]) => (
                <a key={href} href={href} className="text-[13.5px] text-[var(--color-nude)]/70 hover:text-white">
                  {texto}
                </a>
              ))}
            </nav>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5">
              {REDES.map((r) => (
                <a key={r.nombre} href={r.url} target="_blank" rel="noreferrer"
                  className="text-[13.5px] text-[var(--color-nude)]/70 hover:text-white">
                  {r.nombre}
                </a>
              ))}
            </div>
            <p className="text-[12px] text-[var(--color-nude)]/45 mt-8 max-w-xl leading-relaxed">
              Las imágenes pueden no representar resultados reales. Los resultados varían en cada
              paciente.
            </p>
          </div>
        </div>
      </footer>

      <BarraMovil whatsapp={whatsapp} />
    </div>
  );
}

/**
 * El compromiso partido en dos. Es lo más distintivo del brief —un cirujano
 * diciendo en público lo que NO hace— así que la página se parte por la mitad
 * para decirlo: claro a un lado, petróleo al otro, y una línea de cobre en medio.
 */
function SiNo() {
  return (
    <section className="relative">
      <div className="grid lg:grid-cols-2">
        <Aparece className="bg-[var(--color-nude)] px-6 sm:px-10 lg:px-14 py-14 sm:py-20">
          <div className="lg:ml-auto lg:max-w-md">
            <p className="marca text-[9.5px] text-[var(--color-cobre)]">El Dr. Mario Guerra sí</p>
            <ul className="mt-8 space-y-5 text-[15px] text-[var(--color-tinta)] leading-relaxed">
              <li>Te escucha y evalúa tu caso con honestidad.</li>
              <li>Te dice si lo que buscas es posible, y si no, te propone alternativas y te explica por qué.</li>
              <li>Te muestra casos similares para que sepas qué esperar.</li>
              <li>Te acompaña antes, durante y después, con revisiones incluidas.</li>
            </ul>
          </div>
        </Aparece>

        <Aparece retraso={120} className="bg-[var(--color-tinta)] px-6 sm:px-10 lg:px-14 py-14 sm:py-20">
          <div className="lg:max-w-md">
            <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">El Dr. Mario Guerra no</p>
            <ul className="mt-8 space-y-5 text-[15px] text-[var(--color-nude)]/85 leading-relaxed">
              <li>No te promete resultados irreales ni te dice solo lo que quieres oír.</li>
              <li>No te vende procedimientos que no necesitas.</li>
              <li>No te da un presupuesto sin evaluarte primero.</li>
              <li>No te apura para decidir.</li>
            </ul>
          </div>
        </Aparece>
      </div>
      <span className="hidden lg:block absolute inset-y-0 left-1/2 w-px bg-[var(--color-cobre-luz)]" aria-hidden />
    </section>
  );
}
