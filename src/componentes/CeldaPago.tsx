'use client';

import { useState } from 'react';
import { api } from '@/lib/rutas';
import { FormAccion, Boton, type Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: 'Por verificar', clase: 'bg-[var(--color-aviso-luz)] text-[var(--color-aviso)]' },
  verificado: { texto: 'Verificado', clase: 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]' },
  rechazado: { texto: 'Rechazado', clase: 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]' },
  por_devolver: { texto: 'Por devolver', clase: 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]' },
  devuelto: { texto: 'Devuelto', clase: 'bg-[var(--color-tinta-3)]/15 text-[var(--color-tinta-2)]' },
};

/** El pago de una consulta: qué mandó el paciente y si recepción ya lo revisó. */
export function CeldaPago({
  cita, verificar,
}: {
  cita: { id: number; estado: string; usd: number | null; bs: number | null; referencia: string | null; tieneArchivo: boolean };
  verificar: Accion;
}) {
  const [abierto, setAbierto] = useState(false);
  const e = ETIQUETA[cita.estado] ?? ETIQUETA.pendiente;

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setAbierto(!abierto)} className={`pill ${e.clase}`}>
        {e.texto}
      </button>
      {cita.usd != null && (
        <div className="text-[12px] text-[var(--color-tinta-3)] tabular-nums">
          {cita.usd} $
          {cita.bs != null && ` · ${cita.bs.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs`}
        </div>
      )}

      {abierto && (
        <div className="rounded-lg border border-[var(--color-linea)] p-2.5 space-y-2 bg-[var(--color-papel)]">
          {cita.referencia && (
            <p className="text-[12.5px]">Referencia: <span className="font-medium">{cita.referencia}</span></p>
          )}
          {cita.tieneArchivo ? (
            <a href={api(`/api/comprobante/${cita.id}`)} target="_blank" rel="noreferrer"
               className="btn btn-borde py-1 px-3 text-[12.5px]">
              Ver comprobante
            </a>
          ) : (
            <p className="text-[12.5px] text-[var(--color-alerta)]">Sin comprobante.</p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(['verificado', 'rechazado', 'pendiente', 'por_devolver', 'devuelto'] as const)
              .filter((x) => x !== cita.estado)
              .map((x) => (
                <FormAccion key={x} accion={verificar} onOk={() => setAbierto(false)}>
                  <input type="hidden" name="cita_id" value={cita.id} />
                  <input type="hidden" name="estado" value={x} />
                  <Boton variante={x === 'rechazado' ? 'peligro' : x === 'verificado' ? 'principal' : 'borde'}
                    className="py-1 px-3 text-[12.5px] capitalize">
                    {x === 'pendiente' ? 'Volver a pendiente'
                      : x === 'por_devolver' ? 'Por devolver'
                      : x === 'devuelto' ? 'Marcar devuelto' : x}
                  </Boton>
                </FormAccion>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
