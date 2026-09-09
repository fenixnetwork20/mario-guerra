'use client';

import { FormAccion, Boton } from '@/componentes/FormAccion';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

export function FormSeguimiento({ accion, pacienteId }: { accion: Accion; pacienteId: number }) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <label className="block flex-1 min-w-[220px]">
        <span className="text-[12.5px] font-medium">Nota</span>
        <input name="nota" className="campo mt-1" placeholder="Pidió pensarlo; llamar después de quincena" required />
      </label>
      <label className="block w-44">
        <span className="text-[12.5px] font-medium">Retomar el</span>
        <input name="fecha" type="date" className="campo mt-1" />
      </label>
      <Boton variante="borde">Anotar</Boton>
    </FormAccion>
  );
}
