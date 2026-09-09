'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

export type Respuesta = { ok: boolean; error?: string; aviso?: string };
type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

/** Envuelve un server action y muestra su error/aviso sin recargar la página. */
export function FormAccion({
  accion, children, className = '', onOk,
}: {
  accion: Accion; children: React.ReactNode; className?: string; onOk?: () => void;
}) {
  const [estado, ejecutar] = useActionState<Respuesta | null, FormData>(
    async (prev, datos) => {
      const r = await accion(prev, datos);
      if (r.ok && onOk) onOk();
      return r;
    },
    null
  );

  return (
    <form action={ejecutar} className={className}>
      {children}
      {estado?.error && (
        <p className="text-[13px] text-[var(--color-alerta)] mt-2">{estado.error}</p>
      )}
      {estado?.ok && estado.aviso && (
        <p className="text-[13px] text-[var(--color-acento)] mt-2">{estado.aviso}</p>
      )}
      {estado?.ok && !estado.aviso && (
        <p className="text-[13px] text-[var(--color-acento)] mt-2">Listo.</p>
      )}
    </form>
  );
}

export function Boton({
  children, variante = 'principal', className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'borde' | 'peligro' }) {
  const { pending } = useFormStatus();
  const clase = variante === 'principal' ? 'btn-principal' : variante === 'peligro' ? 'btn-peligro' : 'btn-borde';
  return (
    <button className={`btn ${clase} ${className}`} disabled={pending || props.disabled} {...props}>
      {pending ? 'Un momento…' : children}
    </button>
  );
}
