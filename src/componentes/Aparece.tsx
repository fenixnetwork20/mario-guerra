'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * El único gesto de movimiento del sitio público: el bloque aparece cuando
 * entra en pantalla. Se dispara una sola vez — un elemento que se desvanece al
 * volver a subir se siente roto, no elegante.
 */
export function Aparece({
  children, retraso = 0, className = '', as: Etiqueta = 'div',
}: {
  children: React.ReactNode;
  retraso?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    // Sin IntersectionObserver (o con el bloque ya en pantalla al cargar), se muestra y ya.
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }

    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(nodo);

    // Segunda red: si por lo que sea el observador nunca dispara, el bloque
    // aparece igual a los 4 segundos. Nada queda escondido para siempre.
    const red = setTimeout(() => setVisible(true), 4000);
    return () => { obs.disconnect(); clearTimeout(red); };
  }, []);

  return (
    <Etiqueta
      ref={ref as React.Ref<never>}
      className={`aparece ${visible ? 'visible' : ''} ${className}`}
      style={{ ['--retraso' as string]: `${retraso}ms` }}
    >
      {children}
    </Etiqueta>
  );
}
