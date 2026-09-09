'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavPanel({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const ruta = usePathname();

  return (
    <nav className="scroll-x -mx-1">
      <div className="flex gap-1 px-1">
        {enlaces.map((e) => {
          // '/panel' solo está activo en exacto; el resto por prefijo.
          const activo = e.href === '/panel' ? ruta === '/panel' : ruta.startsWith(e.href);
          return (
            <Link
              key={e.href}
              href={e.href}
              className={`shrink-0 px-3 py-2.5 text-[13.5px] font-medium border-b-2 transition-colors ${
                activo
                  ? 'border-[var(--color-cobre-luz)] text-white'
                  : 'border-transparent text-[var(--color-nude)]/65 hover:text-[var(--color-nude)]'
              }`}
            >
              {e.texto}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
