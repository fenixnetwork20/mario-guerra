'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Aparece } from '@/componentes/Aparece';

export type Categoria = {
  clave: string;
  nombre: string;
  descripcion: string;
  procedimientos: { nombre: string; recuperacion: string; anestesia: string }[];
};

/** Las categorías se abren aquí mismo: no hay subpáginas por procedimiento. */
export function Procedimientos({ categorias }: { categorias: Categoria[] }) {
  const [abierta, setAbierta] = useState<string | null>(categorias[0]?.clave ?? null);
  const activa = categorias.find((c) => c.clave === abierta);

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {categorias.map((c, i) => {
          const seleccionada = c.clave === abierta;
          return (
            <Aparece key={c.clave} retraso={i * 70}>
              <button
                onClick={() => setAbierta(seleccionada ? null : c.clave)}
                aria-expanded={seleccionada}
                aria-controls="detalle-procedimientos"
                className={`w-full text-left h-full rounded-lg border p-5 transition-colors ${
                  seleccionada
                    ? 'border-[var(--color-cobre-luz)] bg-[var(--color-tarjeta)]'
                    : 'border-[var(--color-linea)] bg-[var(--color-tarjeta)] hover:border-[var(--color-tinta-3)]'
                }`}
              >
                <span
                  className={`block h-px w-8 mb-4 transition-all ${
                    seleccionada ? 'bg-[var(--color-cobre-luz)] w-14' : 'bg-[var(--color-linea)]'
                  }`}
                />
                <span className="titulo text-[17px] block">{c.nombre}</span>
                <span className="text-[13px] text-[var(--color-tinta-3)] block mt-1.5 leading-relaxed">
                  {c.descripcion}
                </span>
                <span className="marca text-[9.5px] text-[var(--color-cobre)] block mt-4">
                  {seleccionada ? 'Cerrar' : `Ver ${c.procedimientos.length}`}
                </span>
              </button>
            </Aparece>
          );
        })}
      </div>

      {activa && (
        <div id="detalle-procedimientos" className="mt-4 tarjeta overflow-hidden">
          <div className="px-5 sm:px-7 py-6">
            <p className="marca text-[9.5px] text-[var(--color-cobre)]">{activa.nombre}</p>
            {/* En monitores anchos van en dos columnas: si no, el nombre y los
                datos quedan separados por medio metro de vacío. */}
            <ul className="mt-5 grid xl:grid-cols-2 gap-x-14">
              {activa.procedimientos.map((p) => (
                <li key={p.nombre}
                  className="py-4 border-b border-[var(--color-papel-2)] grid sm:grid-cols-[1fr_auto] gap-x-6 gap-y-2 items-baseline">
                  <span className="text-[15px] font-medium">{p.nombre}</span>
                  <span className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[var(--color-tinta-3)]">
                    <span>Recuperación: {p.recuperacion}</span>
                    <span>Anestesia: {p.anestesia}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-5 leading-relaxed">
              Los tiempos son de referencia. Tu caso se define en la valoración: cada cuerpo responde distinto.
            </p>
          </div>
        </div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="entradilla text-[var(--color-tinta-2)]">
          ¿No sabes cuál es el indicado para ti? Agenda tu valoración.
        </p>
        <Link href="/reservar" className="btn btn-principal py-3 px-6 shrink-0">
          Agendar consulta
        </Link>
      </div>
    </div>
  );
}
