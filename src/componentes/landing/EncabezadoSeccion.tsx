import { Aparece } from '@/componentes/Aparece';

/**
 * Encabezado de sección en dos columnas: título a la izquierda, bajada a la
 * derecha. En pantallas anchas ocupa el ancho completo en vez de dejar la
 * mitad derecha vacía, y el párrafo conserva su medida de lectura.
 */
export function EncabezadoSeccion({
  kicker, titulo, children, sobreOscuro = false,
}: {
  kicker: string;
  titulo: React.ReactNode;
  children?: React.ReactNode;
  sobreOscuro?: boolean;
}) {
  return (
    <Aparece className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 lg:gap-16 items-end">
      <div>
        <p className={`marca text-[9.5px] ${sobreOscuro ? 'text-[var(--color-cobre-luz)]' : 'text-[var(--color-cobre)]'}`}>
          {kicker}
        </p>
        <h2 className={`titular-menor mt-4 ${sobreOscuro ? 'text-white' : ''}`}>{titulo}</h2>
        <span className="regla-cobre mt-6" />
      </div>
      {children && (
        <p className={`entradilla medida ${sobreOscuro ? 'text-[var(--color-nude)]/80' : 'text-[var(--color-tinta-2)]'}`}>
          {children}
        </p>
      )}
    </Aparece>
  );
}
