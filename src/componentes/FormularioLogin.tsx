'use client';

import { useActionState } from 'react';
import { entrar } from '@/acciones/sesion';

export function FormularioLogin() {
  const [error, accion, pendiente] = useActionState(entrar, null as string | null);

  return (
    <form action={accion} className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-medium">Correo</span>
        <input name="email" type="email" className="campo mt-1" autoComplete="username" required />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium">Contraseña</span>
        <input name="clave" type="password" className="campo mt-1" autoComplete="current-password" required />
      </label>
      {error && (
        <p className="text-[13px] text-[var(--color-alerta)]">{error}</p>
      )}
      <button className="btn btn-principal w-full py-2.5" disabled={pendiente}>
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
