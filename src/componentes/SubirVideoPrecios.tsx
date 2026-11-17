'use client';

import { api } from '@/lib/rutas';
import { FormAccion, Boton, type Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

/** El video que manda el bot cuando preguntan el precio de una cirugía. */
export function SubirVideoPrecios({ cargado, enviados, subir, quitar }: {
  cargado: boolean; enviados: number; subir: Accion; quitar: Accion;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-linea)] p-4 space-y-3">
      {cargado ? (
        <div className="space-y-3">
          <video src={api('/api/publico/video-precios')} controls preload="metadata"
            className="w-full max-w-xs rounded-md border border-[var(--color-linea)] bg-black" />
          <p className="text-[12.5px] text-[var(--color-tinta-3)]">
            Enviado a {enviados} {enviados === 1 ? 'persona' : 'personas'}. Se manda una sola vez por conversación.
          </p>
          <FormAccion accion={quitar}>
            <Boton variante="peligro" className="py-1 px-3 text-[12.5px]">Quitar video</Boton>
          </FormAccion>
        </div>
      ) : (
        <p className="text-[12.5px] text-[var(--color-tinta-3)]">
          Sin video: cuando preguntan el precio de una cirugía, el bot lo explica solo por texto.
        </p>
      )}
      <FormAccion accion={subir}>
        <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--color-linea)] bg-[var(--color-tarjeta)] px-3 py-2">
          <span className="btn btn-borde py-1 px-3 text-[12.5px] shrink-0">Escoger video</span>
          <span className="text-[12.5px] text-[var(--color-tinta-3)]">MP4, hasta 16 MB</span>
          <input type="file" name="archivo" accept="video/mp4,video/3gpp" className="sr-only" />
        </label>
        <Boton className="mt-2 py-1.5 px-4 text-[13px]">{cargado ? 'Reemplazar' : 'Subir'}</Boton>
      </FormAccion>
    </div>
  );
}
