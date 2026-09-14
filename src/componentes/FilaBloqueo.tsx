'use client';

import { useState } from 'react';
import { FormAccion, Boton, type Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

/**
 * Un bloqueo de la agenda, con sus dos acciones. Se puede corregir la hora o el
 * motivo sin borrarlo y volverlo a crear, que era lo único que se podía hacer.
 */
export function FilaBloqueo({
  bloqueo, editar, eliminar,
}: {
  bloqueo: { id: number; inicio: string; fin: string; motivo: string };
  editar: Accion;
  eliminar: Accion;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li className="rounded-lg border border-[var(--color-linea)] p-3">
        <FormAccion accion={editar} onOk={() => setEditando(false)}>
          <input type="hidden" name="bloqueo_id" value={bloqueo.id} />
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-[11.5px] text-[var(--color-tinta-3)]">Desde</span>
              <input name="hora_inicio" type="time" defaultValue={bloqueo.inicio} className="campo mt-1 w-[7.5rem]" />
            </label>
            <label className="block">
              <span className="text-[11.5px] text-[var(--color-tinta-3)]">Hasta</span>
              <input name="hora_fin" type="time" defaultValue={bloqueo.fin} className="campo mt-1 w-[7.5rem]" />
            </label>
            <label className="block flex-1 min-w-[9rem]">
              <span className="text-[11.5px] text-[var(--color-tinta-3)]">Motivo</span>
              <input name="motivo" defaultValue={bloqueo.motivo} className="campo mt-1" placeholder="Emergencia" />
            </label>
          </div>
          <div className="flex gap-2 mt-3">
            <Boton>Guardar</Boton>
            <button type="button" className="btn btn-borde" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </FormAccion>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        {bloqueo.inicio} – {bloqueo.fin}
        {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ''}
      </span>
      <span className="flex items-center gap-2">
        <button type="button" className="btn btn-borde py-1 px-3 text-[12.5px]" onClick={() => setEditando(true)}>
          Editar
        </button>
        <FormAccion accion={eliminar}>
          <input type="hidden" name="bloqueo_id" value={bloqueo.id} />
          <Boton variante="peligro" className="py-1 px-3 text-[12.5px]">Eliminar</Boton>
        </FormAccion>
      </span>
    </li>
  );
}
