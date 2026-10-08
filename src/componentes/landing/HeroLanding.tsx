'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Contador } from './Contador';

/** Crossfade lento entre fotos. Acepta las que haya: con una sola se queda fija. */
export function HeroLanding({
  fotos, whatsapp, encuadre = 'object-[60%_18%] lg:object-[72%_20%]',
}: {
  fotos: { src: string; alt: string }[];
  whatsapp: string;
  /** El recorte depende de la foto: una vertical con dos personas no se encuadra
   *  como un retrato suelto. Se pasa desde la página, no se adivina aquí. */
  encuadre?: string;
}) {
  const [actual, setActual] = useState(0);

  useEffect(() => {
    if (fotos.length < 2) return;
    const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (menosMovimiento) return;
    const id = setInterval(() => setActual((i) => (i + 1) % fotos.length), 6500);
    return () => clearInterval(id);
  }, [fotos.length]);

  return (
    <section id="inicio" className="relative min-h-[100svh] flex items-end overflow-hidden bg-[var(--color-tinta)]">
      {/* La foto va en una capa más alta que la pantalla: el parallax la mueve
          más lento que la página y así nunca se ve el borde. */}
      <div className="absolute inset-x-0 -top-[10%] -bottom-[10%] paralaje" data-paralaje="0.18">
        {fotos.map((f, i) => (
          <div key={f.src} className={`hero-foto ${i === actual ? 'activa' : ''}`} aria-hidden={i !== actual}>
            <div className="absolute inset-0 respira">
              <Image
                src={f.src}
                alt={i === 0 ? f.alt : ''}
                fill
                priority={i === 0}
                sizes="100vw"
                className={`object-cover ${encuadre}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Los degradados sostienen el texto sin apagar la foto. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-tinta)] via-[var(--color-tinta)]/60 to-[var(--color-tinta)]/25" />
      <div className="absolute inset-0 lg:bg-gradient-to-r lg:from-[var(--color-tinta)]/85 lg:via-[var(--color-tinta)]/20 lg:to-transparent" />

      <div className="contenedor relative pt-28 pb-36 lg:pb-20 w-full">
        <div className="max-w-3xl">
          <p className="marca text-[9.5px] sm:text-[10.5px] text-[var(--color-cobre-luz)] entra" style={{ ['--retraso' as string]: '150ms' }}>
            Cirujano plástico · Maracaibo
          </p>
          <h1 className="titular-hero text-[var(--color-nude)] mt-5">
            <span className="ranura"><span style={{ ['--retraso' as string]: '250ms' }}>Dr. Mario</span></span>
            <span className="ranura"><span style={{ ['--retraso' as string]: '400ms' }}>Guerra</span></span>
          </h1>
          <span className="regla-cobre trazo mt-7 w-24" style={{ ['--retraso' as string]: '800ms' }} />
          <p className="entradilla text-[var(--color-nude)]/85 mt-6 max-w-lg entra" style={{ ['--retraso' as string]: '900ms' }}>
            Resultados naturales, en manos expertas.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 entra" style={{ ['--retraso' as string]: '1050ms' }}>
            <Link href="/reservar"
              className="btn brillo py-3.5 px-7 bg-[var(--color-cobre-luz)] text-[var(--color-tinta)] hover:bg-[var(--color-nude)]">
              Agendar consulta <span className="flecha" aria-hidden>→</span>
            </Link>
            <a href={whatsapp} target="_blank" rel="noreferrer"
              className="btn brillo py-3.5 px-7 border-white/30 text-[var(--color-nude)] hover:bg-white/10">
              Escríbenos por WhatsApp
            </a>
          </div>

          <ul className="mt-12 grid grid-cols-3 gap-4 sm:gap-10 max-w-xl entra" style={{ ['--retraso' as string]: '1250ms' }}>
            <li>
              <p className="text-[clamp(1.6rem,5vw,2.4rem)] font-light text-white leading-none"><Contador hasta={8} prefijo="+" /></p>
              <p className="marca text-[8.5px] sm:text-[9.5px] text-[var(--color-nude)]/60 mt-2">Años de experiencia</p>
            </li>
            <li>
              <p className="text-[clamp(1.6rem,5vw,2.4rem)] font-light text-white leading-none"><Contador hasta={500} prefijo="+" /></p>
              <p className="marca text-[8.5px] sm:text-[9.5px] text-[var(--color-nude)]/60 mt-2">Procedimientos</p>
            </li>
            <li>
              <p className="text-[clamp(1.6rem,5vw,2.4rem)] font-light text-white leading-none">24/7</p>
              <p className="marca text-[8.5px] sm:text-[9.5px] text-[var(--color-nude)]/60 mt-2">Emergencias</p>
            </li>
          </ul>
        </div>
      </div>

      <a href="#doctor" aria-label="Bajar" className="hidden lg:flex absolute right-[clamp(1.25rem,4.5vw,5rem)] bottom-12 flex-col items-center gap-4 entra" style={{ ['--retraso' as string]: '1500ms' }}>
        <span className="marca text-[9px] text-[var(--color-nude)]/60 [writing-mode:vertical-rl]">Desliza</span>
        <span className="baja" />
      </a>
    </section>
  );
}
