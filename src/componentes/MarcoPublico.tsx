import Image from 'next/image';
import { ruta } from '@/lib/rutas';
import { cfg } from '@/lib/db';

/** Cabecera fina + pie. Las secciones de adentro manejan su propio ancho para
 *  poder ir a sangre completa, como los módulos de la referencia. */
export function MarcoPublico({ children }: { children: React.ReactNode }) {
  const direccion = cfg('direccion', '');
  const wa = cfg('whatsapp_consultorio', '');
  const emergencias = cfg('whatsapp_emergencias', '');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[var(--color-tinta)] relative z-20">
        <div className="contenedor py-4 flex items-center gap-3.5">
          <Image src={ruta('/marca/monograma-claro.png')} alt="" width={79} height={88}
            className="h-9 w-auto" priority />
          <div className="border-l border-white/15 pl-3.5">
            <p className="marca text-[13px] sm:text-[15px] text-[var(--color-nude)] leading-none">
              Dr. Mario Guerra
            </p>
            <p className="marca text-[8.5px] sm:text-[9.5px] text-[var(--color-cobre-luz)] mt-1.5 leading-none">
              Cirujano plástico y reconstructivo
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="modulo-oscuro">
        <div className="contenedor py-10 grid gap-6 sm:grid-cols-2 text-[13.5px]">
          <div>
            <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Consultorio</p>
            {direccion && <p className="mt-2 text-[var(--color-nude)]/85 leading-relaxed">{direccion}</p>}
          </div>
          <div>
            <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Contacto</p>
            {wa && <p className="mt-2 text-[var(--color-nude)]/85">WhatsApp {wa}</p>}
            {emergencias && <p className="text-[var(--color-nude)]/85">Emergencias 24/7 {emergencias}</p>}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** El separador fino entre módulos. */
export function Divisor() {
  return (
    <div className="contenedor">
      <div className="divisor" />
    </div>
  );
}

/** Portada de media imagen: texto a la izquierda, foto ocupando la mitad derecha
 *  y fundiéndose en el petróleo — la composición `half-image` de la referencia. */
export function Portada({
  kicker, titulo, bajada, foto = ruta('/marca/foto-doctor.jpg'),
  compacta = false, estrecha = false,
}: {
  kicker: string; titulo: React.ReactNode; bajada?: string;
  /** `null` deja la portada en petróleo liso, sin fotografía. */
  foto?: string | null;
  compacta?: boolean;
  /** Alinea el texto con el contenido angosto de abajo (formularios, fichas). */
  estrecha?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-[var(--color-tinta)]">
      {/* Móvil: la foto va detrás, atenuada. Escritorio: ocupa la mitad derecha. */}
      {foto && (
      <div className="absolute inset-0 lg:left-[42%]">
        <Image
          src={foto}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 58vw"
          className="acercar object-cover object-[58%_14%] opacity-40 lg:opacity-100"
        />
        <div className="absolute inset-0 bg-[var(--color-tinta)]/45 lg:hidden" />
        {/* Fundido del borde izquierdo de la foto hacia el petróleo */}
        <div className="hidden lg:block absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[var(--color-tinta)] to-transparent" />
        <div className="hidden lg:block absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[var(--color-tinta)]/70 to-transparent" />
      </div>
      )}

      <div className={`${estrecha ? 'contenedor-estrecho' : 'contenedor'} relative ${
        compacta ? 'py-16 sm:py-20' : 'py-20 sm:py-28 lg:py-32'
      }`}>
        <div className="max-w-md lg:max-w-lg">
          <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">{kicker}</p>
          <h1 className={`display text-[var(--color-nude)] mt-4 ${compacta ? 'text-[24px] sm:text-[30px]' : 'text-[30px] sm:text-[40px]'}`}>
            {titulo}
          </h1>
          <span className="block h-px w-16 bg-[var(--color-cobre-luz)] mt-6" />
          {bajada && (
            <p className="text-[15px] text-[var(--color-nude)]/75 mt-6 leading-relaxed">
              {bajada}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
