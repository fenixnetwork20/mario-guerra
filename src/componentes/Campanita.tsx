'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { marcarLeidas } from '@/acciones/notificaciones';

type Notif = { id: number; tipo: string; mensaje: string; enlace: string | null; leida: number; fecha: string };

export function Campanita({ notificaciones, sinLeer }: { notificaciones: Notif[]; sinLeer: number }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative">
      <button
        className="relative grid place-items-center h-9 w-9 rounded-lg border border-white/15 bg-[var(--color-tarjeta)]/10 text-[var(--color-nude)] hover:bg-[var(--color-tarjeta)]/20"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
      >
        <Bell size={17} />
        {sinLeer > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-[var(--color-alerta)] text-white text-[10px] font-bold">
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] tarjeta shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-linea)]">
              <span className="etiqueta">Notificaciones</span>
              {sinLeer > 0 && (
                <form action={marcarLeidas}>
                  <button className="text-[12.5px] text-[var(--color-acento)] font-semibold">
                    Marcar leídas
                  </button>
                </form>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notificaciones.length === 0 && (
                <p className="px-4 py-6 text-[13.5px] text-[var(--color-tinta-3)]">Nada por ahora.</p>
              )}
              {notificaciones.map((n) => {
                const cuerpo = (
                  <div className={`px-4 py-3 border-b border-[var(--color-papel-2)] ${n.leida ? '' : 'bg-[var(--color-acento-luz)]/40'}`}>
                    <p className="text-[13.5px] leading-snug">{n.mensaje}</p>
                    <p className="text-[11.5px] text-[var(--color-tinta-3)] mt-1">{n.fecha}</p>
                  </div>
                );
                return n.enlace
                  ? <Link key={n.id} href={n.enlace} onClick={() => setAbierto(false)} className="block hover:bg-[var(--color-papel-2)]">{cuerpo}</Link>
                  : <div key={n.id}>{cuerpo}</div>;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
