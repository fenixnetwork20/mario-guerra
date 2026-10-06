'use client';

import { useState } from 'react';
import { api } from '@/lib/rutas';
import { FormAccion, Boton, type Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

const AVISO = 'bg-[var(--color-aviso-luz)] text-[var(--color-aviso)]';
const BIEN = 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]';
const MAL = 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]';
const NEUTRO = 'bg-[var(--color-tinta-3)]/15 text-[var(--color-tinta-2)]';

/**
 * Lo que pasa con el pago, dicho en palabras. Antes una cita en efectivo y una
 * con comprobante salían las dos como "Por verificar", y el doctor no sabía
 * cuál había pagado y cuál no.
 */
export function etiquetaPago(c: { estado: string; metodo?: string | null; tieneArchivo: boolean; referencia?: string | null }) {
  switch (c.estado) {
    case 'verificado': return { texto: 'Pagado', clase: BIEN };
    case 'no_aplica': return { texto: 'Control · no paga', clase: NEUTRO };
    case 'rechazado': return { texto: 'Pago rechazado', clase: MAL };
    case 'por_devolver': return { texto: 'Por devolver', clase: MAL };
    case 'devuelto': return { texto: 'Devuelto', clase: NEUTRO };
  }
  if (c.tieneArchivo || c.referencia) return { texto: 'Pagó · falta verificar', clase: AVISO };
  if (c.metodo === 'efectivo') return { texto: 'Efectivo · cobrar al llegar', clase: NEUTRO };
  return { texto: 'No ha pagado', clase: MAL };
}

/** El pago de una consulta: qué mandó el paciente y si recepción ya lo revisó. */
export function CeldaPago({
  cita, verificar,
}: {
  cita: { id: number; estado: string; usd: number | null; bs: number | null; referencia: string | null; tieneArchivo: boolean; metodo?: string | null };
  verificar: Accion;
}) {
  const [abierto, setAbierto] = useState(false);
  const e = etiquetaPago(cita);

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

      {abierto && cita.estado !== 'no_aplica' && (
        <div className="rounded-lg border border-[var(--color-linea)] p-2.5 space-y-2 bg-[var(--color-papel)]">
          {cita.referencia && (
            <p className="text-[12.5px]">Referencia: <span className="font-medium">{cita.referencia}</span></p>
          )}
          {cita.metodo === 'efectivo' && (
            <p className="text-[12.5px] text-[var(--color-aviso)]">
              Dijo que paga en efectivo el día de la cita.
            </p>
          )}
          {cita.tieneArchivo ? (
            <a href={api(`/api/comprobante/${cita.id}`)} target="_blank" rel="noreferrer"
               className="btn btn-borde py-1 px-3 text-[12.5px]">
              Ver comprobante
            </a>
          ) : (
            <p className="text-[12.5px] text-[var(--color-alerta)]">
              {cita.metodo === 'efectivo' ? 'Sin comprobante, cobrar al llegar.' : 'Sin comprobante.'}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(['verificado', 'rechazado', 'pendiente', 'por_devolver', 'devuelto'] as const)
              .filter((x) => x !== cita.estado)
              .map((x) => (
                <FormAccion key={x} accion={verificar} onOk={() => setAbierto(false)}>
                  <input type="hidden" name="cita_id" value={cita.id} />
                  <input type="hidden" name="estado" value={x} />
                  <Boton variante={x === 'rechazado' ? 'peligro' : x === 'verificado' ? 'principal' : 'borde'}
                    className="py-1 px-3 text-[12.5px]">
                    {x === 'verificado' ? 'Marcar como pagado'
                      : x === 'rechazado' ? 'Rechazar pago'
                      : x === 'pendiente' ? 'Volver a pendiente'
                      : x === 'por_devolver' ? 'Por devolver' : 'Marcar devuelto'}
                  </Boton>
                </FormAccion>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
