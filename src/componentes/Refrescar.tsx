'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Vuelve a pedir la pantalla cada tanto, sin recargar ni perder lo escrito.
 * Hoy queda abierta toda la mañana en recepción: sin esto la cita "que viene"
 * nunca cambiaba hasta que alguien recargaba a mano.
 */
export function Refrescar({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
