'use client';

import { useState } from 'react';
import { Maximize2, RectangleHorizontal, Square } from 'lucide-react';
import { cambiarAncho } from '@/acciones/preferencias';

import type { Ancho } from '@/lib/ancho';

const OPCIONES: { valor: Ancho; texto: string; Icono: typeof Square }[] = [
  { valor: 'compacto', texto: 'Compacto', Icono: Square },
  { valor: 'ancho', texto: 'Ancho', Icono: RectangleHorizontal },
  { valor: 'completo', texto: 'Pantalla completa', Icono: Maximize2 },
];

export function SelectorAncho({ actual }: { actual: Ancho }) {
  const [abierto, setAbierto] = useState(false);
  const Actual = OPCIONES.find((o) => o.valor === actual)?.Icono ?? RectangleHorizontal;

  return (
    <div className="relative">
      <button
        className="grid place-items-center h-9 w-9 rounded-lg border border-white/15 bg-[var(--color-tarjeta)]/10 text-[var(--color-nude)] hover:bg-[var(--color-tarjeta)]/20"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Ancho de la pantalla"
        title="Ancho de la pantalla"
      >
        <Actual size={16} />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 tarjeta shadow-lg overflow-hidden">
            <p className="etiqueta px-4 pt-3 pb-2">Ancho de la pantalla</p>
            {OPCIONES.map(({ valor, texto, Icono }) => (
              <form key={valor} action={cambiarAncho} onSubmit={() => setAbierto(false)}>
                <input type="hidden" name="ancho" value={valor} />
                <button
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] text-left hover:bg-[var(--color-papel-2)] ${
                    actual === valor ? 'font-semibold text-[var(--color-cobre)]' : ''
                  }`}
                >
                  <Icono size={15} />
                  {texto}
                </button>
              </form>
            ))}
            <p className="px-4 py-2.5 text-[11.5px] text-[var(--color-tinta-3)] border-t border-[var(--color-linea)]">
              Se recuerda en este navegador.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
