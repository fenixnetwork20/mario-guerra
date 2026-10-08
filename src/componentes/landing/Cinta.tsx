/**
 * Cinta de procedimientos: los nombres en grande y huecos, pasando sin parar.
 * La lista va dos veces seguidas para que el bucle no tenga corte; la segunda
 * copia es decorativa y se le esconde al lector de pantalla.
 */
export function Cinta({ items }: { items: string[] }) {
  const fila = (copia: boolean) => (
    <div className="flex" aria-hidden={copia || undefined}>
      {items.map((t) => <span key={t} className="cinta-item">{t}</span>)}
    </div>
  );
  return (
    <div className="cinta py-8 sm:py-10 bg-[var(--color-tinta)] border-y border-white/10">
      <div className="cinta-pista">
        {fila(false)}
        {fila(true)}
      </div>
    </div>
  );
}
