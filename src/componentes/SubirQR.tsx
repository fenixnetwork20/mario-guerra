'use client';

import { api } from '@/lib/rutas';
import { FormAccion, Boton, type Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

/** Los códigos QR que verá el paciente en la pantalla de pago. */
export function SubirQR({
  cual, titulo, cargado, subir, quitar,
}: {
  cual: 'pm_qr' | 'binance_qr';
  titulo: string;
  cargado: boolean;
  subir: Accion;
  quitar: Accion;
}) {
  const ruta = cual === 'pm_qr' ? '/api/publico/qr/pm' : '/api/publico/qr/binance';

  return (
    <div className="rounded-lg border border-[var(--color-linea)] p-4 space-y-3">
      <p className="text-[13.5px] font-medium">{titulo}</p>

      {cargado ? (
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={api(ruta)} alt={`Código QR de ${titulo}`}
            className="h-24 w-24 rounded-md border border-[var(--color-linea)] bg-white p-1 object-contain" />
          <FormAccion accion={quitar}>
            <input type="hidden" name="cual" value={cual} />
            <Boton variante="peligro" className="py-1 px-3 text-[12.5px]">Quitar</Boton>
          </FormAccion>
        </div>
      ) : (
        <p className="text-[12.5px] text-[var(--color-tinta-3)]">Todavía no hay código cargado.</p>
      )}

      <FormAccion accion={subir}>
        <input type="hidden" name="cual" value={cual} />
        <input type="file" name="archivo" accept="image/png,image/jpeg,image/webp"
          className="campo text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-acento)] file:px-3 file:py-1.5 file:text-white file:text-[12.5px]" />
        <Boton className="mt-2 py-1.5 px-4 text-[13px]">{cargado ? 'Reemplazar' : 'Subir'}</Boton>
      </FormAccion>
    </div>
  );
}
