'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Testimonio = { nombre: string; texto: string };

/** Slider de testimonios. Si no hay ninguno cargado, la sección no se dibuja:
 *  antes que inventar reseñas, no se muestra nada. */
export function Testimonios({ testimonios }: { testimonios: Testimonio[] }) {
  const [i, setI] = useState(0);
  if (!testimonios.length) return null;

  const mover = (paso: number) =>
    setI((n) => (n + paso + testimonios.length) % testimonios.length);
  const t = testimonios[i];

  return (
    <div>
      <blockquote className="max-w-2xl">
        <p className="entradilla text-[var(--color-nude)]">{t.texto}</p>
        <footer className="marca text-[9.5px] text-[var(--color-cobre-luz)] mt-6">{t.nombre}</footer>
      </blockquote>

      {testimonios.length > 1 && (
        <div className="flex items-center gap-2 mt-8">
          <button onClick={() => mover(-1)} aria-label="Anterior"
            className="grid place-items-center h-10 w-10 rounded-full border border-white/25 text-[var(--color-nude)] hover:bg-white/10">
            <ChevronLeft size={17} />
          </button>
          <button onClick={() => mover(1)} aria-label="Siguiente"
            className="grid place-items-center h-10 w-10 rounded-full border border-white/25 text-[var(--color-nude)] hover:bg-white/10">
            <ChevronRight size={17} />
          </button>
          <span className="marca text-[9.5px] text-[var(--color-nude)]/60 ml-3">
            {i + 1} / {testimonios.length}
          </span>
        </div>
      )}
    </div>
  );
}
