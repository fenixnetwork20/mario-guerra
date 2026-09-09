'use client';

import Link from 'next/link';

/** En teléfono el CTA nunca se pierde: barra fija abajo. */
export function BarraMovil({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-[var(--color-tinta)]/95 backdrop-blur border-t border-white/10">
      <div className="contenedor py-2.5 flex gap-2">
        <Link href="/reservar"
          className="btn flex-1 py-3 bg-[var(--color-cobre-luz)] text-[var(--color-tinta)]">
          Agendar consulta
        </Link>
        <a href={whatsapp} target="_blank" rel="noreferrer"
          className="btn py-3 px-5 border-white/25 text-[var(--color-nude)]">
          WhatsApp
        </a>
      </div>
    </div>
  );
}
