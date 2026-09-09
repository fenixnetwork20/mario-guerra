'use client';

import { useState } from 'react';
import { FormAccion, Boton } from '@/componentes/FormAccion';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

export function AccionesRapidasCita({
  citaId, estado, cambiarEstado, cancelar,
}: {
  citaId: number;
  estado: string;
  cambiarEstado: Accion;
  cancelar: Accion;
}) {
  const [modal, setModal] = useState(false);
  const activa = estado === 'reservada' || estado === 'confirmada';
  if (!activa) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {estado === 'reservada' && (
        <FormAccion accion={cambiarEstado} className="inline">
          <input type="hidden" name="cita_id" value={citaId} />
          <input type="hidden" name="estado" value="confirmada" />
          <Boton variante="borde" className="h-8 px-2.5 text-[12.5px]">Confirmar</Boton>
        </FormAccion>
      )}
      <FormAccion accion={cambiarEstado} className="inline">
        <input type="hidden" name="cita_id" value={citaId} />
        <input type="hidden" name="estado" value="completada" />
        <Boton variante="borde" className="h-8 px-2.5 text-[12.5px]">Atendida</Boton>
      </FormAccion>
      <FormAccion accion={cambiarEstado} className="inline">
        <input type="hidden" name="cita_id" value={citaId} />
        <input type="hidden" name="estado" value="no_asistio" />
        <Boton variante="borde" className="h-8 px-2.5 text-[12.5px]">No asistió</Boton>
      </FormAccion>
      <button className="btn btn-peligro h-8 px-2.5 text-[12.5px]" onClick={() => setModal(true)}>
        Cancelar
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={() => setModal(false)}>
          <div className="tarjeta w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="titulo text-lg">Cancelar esta cita</h3>
            <FormAccion accion={cancelar} className="mt-4 space-y-3">
              <input type="hidden" name="cita_id" value={citaId} />
              <label className="block">
                <span className="text-[13px] font-medium">Motivo</span>
                <input name="motivo" className="campo mt-1" placeholder="Ej: el paciente llamó" />
              </label>
              <label className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" name="avisar" value="1" />
                Avisar al paciente por WhatsApp (gasta un mensaje)
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn btn-borde" onClick={() => setModal(false)}>Volver</button>
                <Boton variante="peligro">Cancelar cita</Boton>
              </div>
            </FormAccion>
          </div>
        </div>
      )}
    </div>
  );
}
