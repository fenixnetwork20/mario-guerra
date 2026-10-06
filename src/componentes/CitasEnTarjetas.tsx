import { Estado, EnlacePaciente } from '@/componentes/ui';
import { CeldaPago } from '@/componentes/CeldaPago';
import { AccionesRapidasCita } from '@/componentes/AccionesRapidasCita';
import { hora12, soloHora } from '@/lib/fechas';
import type { Respuesta } from '@/componentes/FormAccion';

type Accion = (prev: Respuesta | null, datos: FormData) => Promise<Respuesta>;

type CitaFila = {
  id: number; paciente_id: number; paciente_nombre: string; whatsapp: string;
  fecha_hora: string; tipo: string; modalidad: string | null; estado: string;
  procedimiento_interes?: string | null; notas?: string | null;
  pago_estado?: string | null; pago_monto_usd?: number | null; pago_monto_bs?: number | null;
  pago_referencia?: string | null; pago_archivo?: string | null; pago_metodo?: string | null;
};

/**
 * Las citas en tarjetas, para el teléfono.
 *
 * La tabla mide 900px y el consultorio trabaja desde el celular: la columna del
 * pago quedaba fuera de la pantalla y había que arrastrar la tabla de lado para
 * encontrarla. El doctor preguntó dónde se veía quién había pagado, que es la
 * señal de que no se veía.
 */
export function CitasEnTarjetas({
  citas, cambiarEstado, cancelar, reprogramar, verificar,
}: {
  citas: CitaFila[];
  cambiarEstado: Accion; cancelar: Accion; reprogramar: Accion;
  /** Sin esto la tarjeta no muestra el pago: lo usa la pantalla de Hoy. */
  verificar?: Accion;
}) {
  return (
    <ul className="space-y-3 sm:hidden">
      {citas.map((c) => (
        <li key={c.id} className="rounded-lg border border-[var(--color-linea)] p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium tabular-nums">{hora12(soloHora(c.fecha_hora))}</span>
            <Estado valor={c.estado} />
          </div>

          <div>
            <EnlacePaciente id={c.paciente_id} nombre={c.paciente_nombre} />
            <div className="text-[12.5px] text-[var(--color-tinta-3)]">{c.whatsapp}</div>
            <div className="text-[12.5px] text-[var(--color-tinta-3)] capitalize">
              {c.tipo === 'revision' ? 'control' : c.tipo}{c.modalidad ? ` · ${c.modalidad}` : ''}
              {c.procedimiento_interes ? ` · ${c.procedimiento_interes}` : ''}
            </div>
          </div>

          {verificar && (!['cancelada', 'reprogramada'].includes(c.estado) || ['por_devolver', 'devuelto'].includes(c.pago_estado ?? '')) && (
            <div className="border-t border-[var(--color-linea)] pt-2.5">
              <p className="etiqueta mb-1.5">Pago</p>
              <CeldaPago
                cita={{
                  id: c.id,
                  estado: c.pago_estado ?? 'pendiente',
                  usd: c.pago_monto_usd ?? null,
                  bs: c.pago_monto_bs ?? null,
                  referencia: c.pago_referencia ?? null,
                  tieneArchivo: Boolean(c.pago_archivo),
                  metodo: c.pago_metodo ?? null,
                }}
                verificar={verificar}
              />
            </div>
          )}

          <div className="border-t border-[var(--color-linea)] pt-2.5">
            <AccionesRapidasCita
              citaId={c.id} estado={c.estado} fechaActual={c.fecha_hora}
              cambiarEstado={cambiarEstado} cancelar={cancelar} reprogramar={reprogramar}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
