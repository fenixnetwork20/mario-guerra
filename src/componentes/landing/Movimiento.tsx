'use client';

import { useEffect } from 'react';

/**
 * Un solo escuchador de scroll para toda la landing, y a lo sumo una pasada por
 * cuadro (requestAnimationFrame). Escribe variables CSS y el CSS hace el resto:
 *   · --progreso en <html>: la barra de lectura de arriba.
 *   · --dy en cada [data-paralaje]: se mueve más lento que la página.
 *   · --lleno en cada [data-pasos] y .paso-activo en sus [data-paso]: la línea
 *     de cobre de los pasos de la consulta se va llenando al bajar.
 * Con "reducir movimiento" no se toca nada.
 */
export function Movimiento() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const raiz = document.documentElement;
    let pendiente = false;

    const pintar = () => {
      pendiente = false;
      const alto = window.innerHeight;
      const total = raiz.scrollHeight - alto;
      raiz.style.setProperty('--progreso', String(total > 0 ? Math.min(1, window.scrollY / total) : 0));

      document.querySelectorAll<HTMLElement>('[data-paralaje]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > alto + 200) return;
        const factor = Number(el.dataset.paralaje) || 0.12;
        const centro = r.top + r.height / 2 - alto / 2;
        el.style.setProperty('--dy', `${(-centro * factor).toFixed(1)}px`);
      });

      document.querySelectorAll<HTMLElement>('[data-pasos]').forEach((el) => {
        const r = el.getBoundingClientRect();
        // Se llena mientras el bloque cruza la franja entre el 75% y el 35% de la pantalla.
        const lleno = Math.min(1, Math.max(0, (alto * 0.75 - r.top) / (r.height + alto * 0.4 - alto * 0.35)));
        el.style.setProperty('--lleno', lleno.toFixed(3));
        const pasos = el.querySelectorAll<HTMLElement>('[data-paso]');
        pasos.forEach((p, i) => p.classList.toggle('paso-activo', lleno >= (i + 0.5) / pasos.length - 0.05));
      });
    };

    const alMover = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } };
    pintar();
    window.addEventListener('scroll', alMover, { passive: true });
    window.addEventListener('resize', alMover);
    return () => { window.removeEventListener('scroll', alMover); window.removeEventListener('resize', alMover); };
  }, []);

  return <div className="progreso-lectura" aria-hidden />;
}
