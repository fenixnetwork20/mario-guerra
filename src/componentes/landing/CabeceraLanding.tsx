'use client';

import { useEffect, useState } from 'react';
import { ruta } from '@/lib/rutas';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const ENLACES = [
  { href: '#procedimientos', texto: 'Procedimientos' },
  { href: '#doctor', texto: 'Sobre el Dr.' },
  { href: '#resultados', texto: 'Resultados' },
  { href: '#contacto', texto: 'Contacto' },
];

export function CabeceraLanding({ whatsapp }: { whatsapp: string }) {
  const [encogida, setEncogida] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const alScroll = () => setEncogida(window.scrollY > 40);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  // Con el menú abierto no se debe poder desplazar el fondo.
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menu]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          encogida
            ? 'bg-[var(--color-tinta)]/95 backdrop-blur py-2.5 shadow-[0_1px_0_rgba(255,255,255,.08)]'
            : 'bg-gradient-to-b from-[var(--color-tinta)]/85 to-transparent py-5'
        }`}
      >
        <div className="contenedor flex items-center gap-4">
          <Link href="#inicio" className="flex items-center gap-3 shrink-0" aria-label="Inicio">
            <Image
              src={ruta('/marca/monograma-claro.png')} alt="" width={79} height={88} priority
              className={`w-auto transition-all duration-300 ${encogida ? 'h-8' : 'h-10'}`}
            />
            <span className="marca text-[11px] sm:text-[12px] text-[var(--color-nude)] leading-none hidden sm:block">
              Dr. Mario Guerra
            </span>
          </Link>

          <nav className="ml-auto hidden lg:flex items-center gap-7">
            {ENLACES.map((e) => (
              <a key={e.href} href={e.href}
                className="text-[13.5px] text-[var(--color-nude)]/80 hover:text-white transition-colors">
                {e.texto}
              </a>
            ))}
          </nav>

          <div className="ml-auto lg:ml-0 flex items-center gap-2">
            <a href={whatsapp} target="_blank" rel="noreferrer"
              className="hidden lg:inline-flex btn h-9 border-white/20 text-[var(--color-nude)] hover:bg-white/10">
              WhatsApp
            </a>
            <Link href="/reservar"
              className="hidden lg:inline-flex btn h-9 whitespace-nowrap bg-[var(--color-cobre-luz)] text-[var(--color-tinta)] hover:bg-[var(--color-nude)]">
              Agendar consulta
            </Link>
            <button
              className="lg:hidden grid place-items-center h-9 w-9 rounded-lg border border-white/20 text-[var(--color-nude)]"
              onClick={() => setMenu(true)}
              aria-label="Abrir menú"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-[60] bg-[var(--color-tinta)] lg:hidden">
          <div className="contenedor py-5 flex items-center">
            <Image src={ruta('/marca/monograma-claro.png')} alt="" width={79} height={88} className="h-9 w-auto" />
            <button
              className="ml-auto grid place-items-center h-10 w-10 rounded-lg border border-white/20 text-[var(--color-nude)]"
              onClick={() => setMenu(false)}
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="contenedor mt-8 flex flex-col">
            {ENLACES.map((e) => (
              <a key={e.href} href={e.href} onClick={() => setMenu(false)}
                className="titular-menor text-[var(--color-nude)] py-4 border-b border-white/10">
                {e.texto}
              </a>
            ))}
            <Link href="/reservar" className="btn btn-principal mt-8 py-3.5 bg-[var(--color-cobre-luz)] text-[var(--color-tinta)]">
              Agendar consulta
            </Link>
            <a href={whatsapp} target="_blank" rel="noreferrer"
              className="btn mt-3 py-3.5 border-white/25 text-[var(--color-nude)]">
              Escríbenos por WhatsApp
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
