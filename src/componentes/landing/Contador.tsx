'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cifra que cuenta desde cero cuando entra en pantalla. El número final está en
 * el HTML desde el principio (lo leen buscadores y lectores de pantalla); la
 * cuenta es solo para la vista.
 */
export function Contador({ hasta, prefijo = '', sufijo = '', duracion = 1600 }: {
  hasta: number; prefijo?: string; sufijo?: string; duracion?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [valor, setValor] = useState(hasta);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setValor(0);
    let cuadro = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const inicio = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - inicio) / duracion);
        setValor(Math.round(hasta * (1 - Math.pow(1 - k, 4))));
        if (k < 1) cuadro = requestAnimationFrame(paso);
      };
      cuadro = requestAnimationFrame(paso);
    }, { threshold: 0.4 });
    obs.observe(el);
    // Si nunca entra en pantalla por lo que sea, el número correcto vuelve igual.
    const red = setTimeout(() => setValor(hasta), 6000);
    return () => { obs.disconnect(); cancelAnimationFrame(cuadro); clearTimeout(red); };
  }, [hasta, duracion]);

  return (
    <span ref={ref} className="tabular-nums" aria-label={`${prefijo}${hasta}${sufijo}`}>
      <span aria-hidden>{prefijo}{valor}{sufijo}</span>
    </span>
  );
}
