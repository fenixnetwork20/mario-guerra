import Link from 'next/link';

export function Seccion({
  titulo, descripcion, acciones, children, className = '',
}: {
  titulo?: string; descripcion?: string; acciones?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || acciones) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-[var(--color-linea)]">
          <div>
            {/* Filete cobre: el detalle de marca que separa un título de sección */}
            {titulo && (
              <h2 className="titulo text-[17px] flex items-center gap-2.5">
                <span className="inline-block h-4 w-[3px] rounded-full bg-[var(--color-cobre-luz)]" />
                {titulo}
              </h2>
            )}
            {descripcion && (
              <p className="text-[13px] text-[var(--color-tinta-3)] mt-0.5 pl-[13px]">{descripcion}</p>
            )}
          </div>
          {acciones}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  reservada:   { texto: 'Sin confirmar', clase: 'bg-[var(--color-aviso-luz)] text-[var(--color-aviso)]' },
  confirmada:  { texto: 'Confirmada',    clase: 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]' },
  cancelada:   { texto: 'Cancelada',     clase: 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]' },
  reprogramada:{ texto: 'Reprogramada',  clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' },
  completada:  { texto: 'Atendida',      clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' },
  no_asistio:  { texto: 'No asistió',    clase: 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]' },
  pendiente:   { texto: 'Pendiente',     clase: 'bg-[var(--color-aviso-luz)] text-[var(--color-aviso)]' },
  pagada:      { texto: 'Pagada',        clase: 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]' },
  programada:  { texto: 'Programada',    clase: 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]' },
  realizada:   { texto: 'Realizada',     clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' },
  agendada:    { texto: 'Agendada',      clase: 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]' },
  hecho:       { texto: 'Hecho',         clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' },
  descartado:  { texto: 'Descartado',    clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-3)]' },
  omitida:     { texto: 'Omitida',       clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-3)]' },
};

export function Estado({ valor }: { valor: string }) {
  const e = ESTADOS[valor] ?? { texto: valor, clase: 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]' };
  return <span className={`pill ${e.clase}`}>{e.texto}</span>;
}

export function Cifra({
  titulo, valor, detalle, tono = 'normal',
}: {
  titulo: string; valor: string; detalle?: string; tono?: 'normal' | 'bueno' | 'malo';
}) {
  // La regla de arriba lleva el color: cobre para lo positivo, rojo terroso para
  // lo que necesita atención, petróleo para lo neutro.
  const regla =
    tono === 'bueno' ? 'bg-[var(--color-cobre-luz)]'
    : tono === 'malo' ? 'bg-[var(--color-alerta)]'
    : 'bg-[var(--color-acento)]';
  const color =
    tono === 'bueno' ? 'text-[var(--color-cobre)]'
    : tono === 'malo' ? 'text-[var(--color-alerta)]'
    : 'text-[var(--color-tinta)]';
  return (
    <div className="tarjeta overflow-hidden">
      <div className={`h-[3px] ${regla}`} />
      <div className="px-4 py-3">
        <p className="etiqueta">{titulo}</p>
        <p className={`titulo text-[26px] leading-tight mt-1.5 ${color}`}>{valor}</p>
        {detalle && <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-0.5">{detalle}</p>}
      </div>
    </div>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-[var(--color-tinta-3)] py-2">{children}</p>;
}

export function EnlacePaciente({ id, nombre }: { id: number; nombre: string }) {
  return (
    <Link href={`/panel/pacientes/${id}`} className="font-medium hover:underline decoration-[var(--color-tinta-3)]">
      {nombre}
    </Link>
  );
}
