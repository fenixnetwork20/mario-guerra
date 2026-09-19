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
      {/* Marcada, la sesión dura dos meses en este aparato. Por defecto viene
          marcada: es el consultorio entrando desde su propia computadora. */}
      <label className="flex items-center gap-2 text-[13px] text-[var(--color-tinta-2)]">
        <input type="checkbox" name="recordar" value="1" defaultChecked />
        Mantener la sesión abierta en este equipo
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
