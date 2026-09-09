'use client';

import { FormAccion, Boton } from '@/componentes/FormAccion';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

export function FormGastoFijo({ accion, mes }: { accion: Accion; mes: string }) {
  return (
    <FormAccion accion={accion} className="flex flex-wrap items-end gap-2">
      <label className="block flex-1 min-w-[160px]">
        <span className="text-[12.5px] font-medium">Concepto</span>
        <input name="concepto" className="campo mt-1" placeholder="Alquiler, sueldos, insumos" required />
      </label>
      <label className="block w-36">
        <span className="text-[12.5px] font-medium">Categoría</span>
        <input name="categoria" className="campo mt-1" placeholder="Local" />
      </label>
      <label className="block w-28">
        <span className="text-[12.5px] font-medium">Monto</span>
        <input name="monto" type="number" step="0.01" min="0.01" className="campo mt-1" required />
      </label>
      <label className="block w-36">
        <span className="text-[12.5px] font-medium">Mes</span>
        <input name="mes" type="month" defaultValue={mes} className="campo mt-1" />
      </label>
      <Boton variante="borde">Cargar</Boton>
    </FormAccion>
  );
}
