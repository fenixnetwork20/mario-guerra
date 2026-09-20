import Link from 'next/link';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { citasDelDia, bloqueosEntre } from '@/lib/citas';
import { revisionesEnFecha, ETIQUETAS } from '@/lib/cirugias';
import { cuotasVencidas, devolucionesPendientes, resumenMensual, mesActual, usd } from '@/lib/dinero';
import { hoyVET, fechaLarga, hora12, soloHora } from '@/lib/fechas';
import { Seccion, Estado, Cifra, Vacio, EnlacePaciente } from '@/componentes/ui';
import { AccionesRapidasCita } from '@/componentes/AccionesRapidasCita';
import { cambiarEstadoCita, cancelarDesdePanel, reprogramarDesdePanel, verificarPago } from '@/acciones/agenda';
import { FormAccion, Boton } from '@/componentes/FormAccion';

export const dynamic = 'force-dynamic';

export default async function Hoy() {
  const usuario = await exigirSesion();
  const hoy = hoyVET();
  const citas = citasDelDia(hoy);
  const activas = citas.filter((c) => ['reservada', 'confirmada'].includes(c.estado));
  const revisiones = revisionesEnFecha(hoy, hoy);
  const bloqueos = bloqueosEntre(hoy, hoy);
  const verCuentas = puede(usuario, 'cuenta_paciente');
  const vencidas = verCuentas ? cuotasVencidas() : [];
  const devoluciones = puede(usuario, 'pagos') ? devolucionesPendientes() : [];
  const resumen = resumenMensual(mesActual());

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta">{fechaLarga(hoy)}</p>
        <h1 className="titulo text-[28px] mt-0.5">Buen día, {usuario.nombre.split(' ')[0]}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cifra titulo="Citas de hoy" valor={String(activas.length)} detalle={`${citas.length} en total`} />
        <Cifra
          titulo="Sin confirmar"
          valor={String(activas.filter((c) => c.estado === 'reservada').length)}
          tono={activas.some((c) => c.estado === 'reservada') ? 'malo' : 'normal'}
        />
        <Cifra titulo="Revisiones hoy" valor={String(revisiones.length)} />
        {puede(usuario, 'contabilidad_ver') && (
          <Cifra titulo={`Ingresos ${resumen.mes}`} valor={usd(resumen.ingresos)} tono="bueno" />
        )}
      </div>

      <Seccion
        titulo="Agenda de hoy"
        acciones={<Link href="/panel/agenda" className="btn btn-borde h-9">Ver agenda</Link>}
        className="overflow-hidden"
      >
        {citas.length === 0 && <Vacio>No hay citas para hoy.</Vacio>}
        {citas.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[720px]">
              <thead>
                <tr>
                  <th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-medium">{hora12(soloHora(c.fecha_hora))}</td>
                    <td>
                      <EnlacePaciente id={c.paciente_id} nombre={c.paciente_nombre} />
                      <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                        {c.whatsapp}{c.procedimiento_interes ? ` · ${c.procedimiento_interes}` : ''}
                      </div>
                    </td>
                    <td className="capitalize text-[13.5px]">
                      {c.tipo}{c.modalidad ? ` · ${c.modalidad}` : ''}
                    </td>
                    <td><Estado valor={c.estado} /></td>
                    <td>
                      <AccionesRapidasCita
                        citaId={c.id}
                        estado={c.estado}
                        fechaActual={c.fecha_hora}
                        cambiarEstado={cambiarEstadoCita}
                        cancelar={cancelarDesdePanel}
                        reprogramar={reprogramarDesdePanel}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <div className="grid lg:grid-cols-2 gap-6">
        <Seccion titulo="Revisiones postoperatorias de hoy">
          {revisiones.length === 0 && <Vacio>Ninguna para hoy.</Vacio>}
          <ul className="space-y-2">
            {revisiones.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-[14px]">
                <div>
                  <EnlacePaciente id={r.paciente_id} nombre={r.paciente} />
                  <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                    {ETIQUETAS[r.etiqueta] ?? r.etiqueta} · {r.procedimiento}
                  </div>
                </div>
                <Estado valor={r.estado} />
              </li>
            ))}
          </ul>
        </Seccion>

        {verCuentas && (
        <Seccion titulo="Pendientes de plata" descripcion="Cuotas vencidas sin pagar">
          {vencidas.length === 0 && <Vacio>Nada vencido.</Vacio>}
          <ul className="space-y-2">
            {vencidas.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-[14px]">
                <div>
                  <EnlacePaciente id={c.paciente_id} nombre={c.paciente} />
                  <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                    Cuota {c.numero} · venció {c.fecha_vencimiento}
                  </div>
                </div>
                <span className="font-medium text-[var(--color-alerta)]">{usd(c.monto)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
        )}
      </div>

      {devoluciones.length > 0 && (
        <Seccion
          titulo="Devoluciones pendientes"
          descripcion="Citas canceladas que ya estaban pagadas. Devuélvele la plata al paciente y márcalo aquí."
        >
          <ul className="space-y-3">
            {devoluciones.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
                <div className="min-w-0">
                  <EnlacePaciente id={d.paciente_id} nombre={d.paciente} />
                  <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                    Cita del {fechaLarga(d.fecha_hora.slice(0, 10))} · {d.whatsapp}
                    {d.pago_referencia ? ` · ref. ${d.pago_referencia}` : ''}
                  </div>
                  {!d.pago_verificado_at && (
                    <div className="text-[12.5px] text-[var(--color-aviso)]">
                      Este pago nunca se verificó: confirma que el dinero entró antes de devolverlo.
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[var(--color-alerta)] tabular-nums">
                    {d.pago_monto_usd != null ? usd(d.pago_monto_usd) : '—'}
                  </span>
                  <FormAccion accion={verificarPago}>
                    <input type="hidden" name="cita_id" value={d.id} />
                    <input type="hidden" name="estado" value="devuelto" />
                    <Boton variante="borde" className="py-1 px-3 text-[12.5px]">Ya se devolvió</Boton>
                  </FormAccion>
                </div>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {bloqueos.length > 0 && (
        <Seccion titulo="Bloqueos de hoy">
          <ul className="space-y-1.5 text-[14px]">
            {bloqueos.map((b) => (
              <li key={b.id}>
                {soloHora(b.inicio)} – {soloHora(b.fin)}
                {b.motivo ? ` · ${b.motivo}` : ''}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </div>
  );
}
