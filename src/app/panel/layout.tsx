import Link from 'next/link';
import { ruta } from '@/lib/rutas';
import Image from 'next/image';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { noLeidas, ultimas } from '@/lib/notificaciones';
import { Campanita } from '@/componentes/Campanita';
import { BotonCorreccion } from '@/componentes/BotonCorreccion';
import { enviarCorreccion } from '@/acciones/correcciones';
import { SelectorAncho } from '@/componentes/SelectorAncho';
import { NavPanel } from '@/componentes/NavPanel';
import { salir } from '@/acciones/sesion';
import { anchoActual } from '@/acciones/preferencias';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirSesion();
  const verDinero = puede(usuario, 'cuenta_paciente');
  const ancho = await anchoActual();
  const claseAncho = `mx-auto w-full px-4 sm:px-6 ancho-${ancho}`;

  const enlaces = [
    { href: '/panel', texto: 'Hoy', ver: true },
    { href: '/panel/agenda', texto: 'Agenda', ver: puede(usuario, 'agenda') },
    { href: '/panel/pacientes', texto: 'Pacientes', ver: puede(usuario, 'pacientes_ver') },
    { href: '/panel/dinero', texto: 'Dinero', ver: puede(usuario, 'contabilidad_ver') },
    { href: '/panel/seguimiento', texto: 'Seguimiento', ver: puede(usuario, 'seguimiento') },
    { href: '/panel/mensajeria', texto: 'Mensajería', ver: puede(usuario, 'mensajeria') },
    { href: '/panel/config', texto: 'Configuración', ver: puede(usuario, 'configuracion') },
    { href: '/panel/correcciones', texto: 'Correcciones', ver: true },
  ].filter((e) => e.ver);

  return (
    <div className="min-h-screen">
      {/* Barra de marca: petróleo del logo. Es lo que hace que el panel se lea
          como del consultorio y no como un tablero genérico. */}
      <header className="sticky top-0 z-30 bg-[var(--color-tinta)]">
        <div className={claseAncho}>
          <div className="flex items-center gap-3 pt-3 pb-2">
            <Link href="/panel" className="flex items-center gap-2.5 shrink-0">
              <Image src={ruta('/marca/monograma-claro.png')} alt="" width={79} height={88}
                className="h-8 w-auto" priority />
              <span className="marca text-[11px] text-[var(--color-nude)] hidden sm:block leading-none">
                Dr. Mario Guerra
              </span>
            </Link>
            <span className="pill bg-[var(--color-tarjeta)]/10 text-[var(--color-nude)] border-white/15">
              {usuario.rol === 'recepcion' ? 'Recepción' : 'Doctor'}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <SelectorAncho actual={ancho} />
              <Campanita notificaciones={ultimas(30, verDinero)} sinLeer={noLeidas(verDinero)} />
              <form action={salir}>
                <button className="btn h-9 bg-[var(--color-tarjeta)]/10 border-white/15 text-[var(--color-nude)] hover:bg-[var(--color-tarjeta)]/20">
                  Salir
                </button>
              </form>
            </div>
          </div>

          <NavPanel enlaces={enlaces} />
        </div>
      </header>

      <main className={`${claseAncho} py-6`}>{children}</main>
      <BotonCorreccion enviar={enviarCorreccion} />
    </div>
  );
}
