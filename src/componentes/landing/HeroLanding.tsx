'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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
      {fotos.map((f, i) => (
        <div key={f.src} className={`hero-foto ${i === actual ? 'activa' : ''}`} aria-hidden={i !== actual}>
          <Image
            src={f.src}
            alt={i === 0 ? f.alt : ''}
            fill
            priority={i === 0}
            sizes="100vw"
            className={`object-cover ${encuadre}`}
          />
        </div>
      ))}

      {/* Los degradados sostienen el texto sin apagar la foto. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-tinta)] via-[var(--color-tinta)]/65 to-[var(--color-tinta)]/30" />
      <div className="absolute inset-0 lg:bg-gradient-to-r lg:from-[var(--color-tinta)]/85 lg:via-[var(--color-tinta)]/25 lg:to-transparent" />

      <div className="contenedor relative pt-32 pb-28 lg:pb-20">
        <div className="max-w-2xl">
          <p className="marca text-[9.5px] sm:text-[10.5px] text-[var(--color-cobre-luz)]">
            Cirujano plástico · Maracaibo
          </p>
          <h1 className="titular text-[var(--color-nude)] mt-4">Dr. Mario Guerra</h1>
          <span className="regla-cobre mt-6" />
          <p className="entradilla text-[var(--color-nude)]/85 mt-6 max-w-lg">
            Resultados naturales, en manos expertas.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link href="/reservar"
              className="btn py-3.5 px-7 bg-[var(--color-cobre-luz)] text-[var(--color-tinta)] hover:bg-[var(--color-nude)]">
              Agendar consulta
            </Link>
            <a href={whatsapp} target="_blank" rel="noreferrer"
              className="btn py-3.5 px-7 border-white/30 text-[var(--color-nude)] hover:bg-white/10">
              Escríbenos por WhatsApp
            </a>
          </div>

          <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
            {['+10 años de experiencia', '+500 procedimientos', 'Certificado'].map((s) => (
              <li key={s} className="marca text-[9.5px] text-[var(--color-nude)]/65 flex items-center gap-2.5">
                <span className="h-1 w-1 rounded-full bg-[var(--color-cobre-luz)]" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
