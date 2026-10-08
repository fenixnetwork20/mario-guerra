import Link from 'next/link';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { citasDelDia, bloqueosEntre, citasPorCerrar } from '@/lib/citas';
import { revisionesEnFecha, ETIQUETAS } from '@/lib/cirugias';
import { cuotasVencidas, devolucionesPendientes, pagosPorRevisar, resumenMensual, mesActual, usd } from '@/lib/dinero';
import { metricasLeads } from '@/lib/leads';
import { hoyVET, fechaLarga, hora12, soloHora } from '@/lib/fechas';
import { Seccion, Estado, Cifra, Vacio, EnlacePaciente } from '@/componentes/ui';
import { AccionesRapidasCita } from '@/componentes/AccionesRapidasCita';
import { CitasEnTarjetas } from '@/componentes/CitasEnTarjetas';
import { CeldaPago } from '@/componentes/CeldaPago';
import { cambiarEstadoCita, cancelarDesdePanel, reprogramarDesdePanel, verificarPago } from '@/acciones/agenda';
import { FormAccion, Boton } from '@/componentes/FormAccion';
import { Refrescar } from '@/componentes/Refrescar';
import { citasProximas, pagoListo } from '@/lib/proxima';
import { ahoraVET, minutosEntre } from '@/lib/fechas';

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
  const porCerrar = puede(usuario, 'agenda') ? citasPorCerrar() : [];
  const leads = metricasLeads();
  const cobros = puede(usuario, 'pagos') ? pagosPorRevisar() : [];
  // Los que dicen haber pagado (subieron captura o pusieron referencia): eso es
  // lo único que hay que verificar. El efectivo se cobra al llegar.
  const porVerificar = cobros.filter((c) => c.pago_archivo || c.pago_referencia).length;
  const resumen = resumenMensual(mesActual());
  const ahora = ahoraVET();
  const proximas = puede(usuario, 'agenda') ? citasProximas(ahora) : [];

  return (
    <div className="space-y-6">
      <Refrescar segundos={60} />
      <div>
        <p className="etiqueta">{fechaLarga(hoy)}</p>
        <h1 className="titulo text-[28px] mt-0.5">Buen día, {usuario.nombre.split(' ')[0]}</h1>
      </div>

      {/* La cita que viene o la que está en curso, arriba de todo. Verde: pagó o
          es control. Rojo: falta el pago (o cobrarlo al llegar). */}
      {proximas.map((c) => {
        const pago = pagoListo(c);
        const faltan = minutosEntre(ahora, c.fecha_hora);
        const cuando = faltan > 0 ? `Empieza en ${faltan} min` : 'En curso ahora';
        const como = c.tipo === 'revision' ? 'Control' : c.modalidad === 'online' ? 'Videollamada' : 'Presencial';
        return (
          <Link key={c.id} href={`/panel/pacientes/${c.paciente_id}`}
            className={`block rounded-xl border-2 px-4 py-3.5 ${pago.ok
              ? 'border-[var(--color-bien)] bg-[var(--color-bien-luz)]'
              : 'border-[var(--color-alerta)] bg-[var(--color-alerta-luz)]'}`}>
            <p className={`text-[12px] font-bold uppercase tracking-[.12em] ${pago.ok ? 'text-[var(--color-bien)]' : 'text-[var(--color-alerta)]'}`}>
              {cuando} · {hora12(soloHora(c.fecha_hora))}
            </p>
            <p className="titulo text-[20px] mt-0.5 text-[var(--color-tinta)]">{c.paciente_nombre}</p>
            <p className="text-[14px] mt-0.5 text-[var(--color-tinta-2)]">
              {como} · <span className={`font-semibold ${pago.ok ? 'text-[var(--color-bien)]' : 'text-[var(--color-alerta)]'}`}>{pago.texto}</span>
            </p>
          </Link>
        );
      })}

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

      {porVerificar > 0 && (
        <a href="#pagos" className="block rounded-xl border border-[var(--color-aviso)]/40 bg-[var(--color-aviso-luz)] px-4 py-3.5">
          <p className="font-semibold text-[var(--color-aviso)] text-[15.5px]">
            {porVerificar === 1 ? 'Tienes 1 pago por verificar' : `Tienes ${porVerificar} pagos por verificar`}
          </p>
          <p className="text-[13px] text-[var(--color-tinta-2)] mt-0.5">
            Pacientes que ya mandaron su comprobante. Revisa que el dinero haya entrado y márcalo como pagado.
          </p>
          <span className="btn btn-principal mt-3 inline-flex">Verificar pagos →</span>
        </a>
      )}

      {cobros.length > 0 && (
        <Seccion
          id="pagos"
          titulo="Pagos por revisar"
          descripcion="Abre la captura, revisa en el banco que el dinero entró y toca Marcar como pagado."
        >
          <ul className="space-y-3">
            {cobros.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 text-[14px]">
                <div className="min-w-0">
                  <EnlacePaciente id={c.paciente_id} nombre={c.paciente} />
                  <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                    {fechaLarga(c.fecha_hora.slice(0, 10))} a las {hora12(soloHora(c.fecha_hora))}
                    {c.modalidad ? ` · ${c.modalidad}` : ''} · {c.whatsapp}
                  </div>

                </div>
                <CeldaPago
                  cita={{
                    id: c.id,
                    estado: c.pago_estado,
                    usd: c.pago_monto_usd,
                    bs: c.pago_monto_bs,
                    referencia: c.pago_referencia,
                    tieneArchivo: Boolean(c.pago_archivo),
                    metodo: c.pago_metodo,
                  }}
                  verificar={verificarPago}
                  siempreAbierto
                />
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      <Seccion
        titulo="Agenda de hoy"
        acciones={<Link href="/panel/agenda" className="btn btn-borde h-9">Ver agenda</Link>}
        className="overflow-hidden"
      >
        {citas.length === 0 && <Vacio>No hay citas para hoy.</Vacio>}
        {citas.length > 0 && (
          <>
          <CitasEnTarjetas
            citas={citas}
            cambiarEstado={cambiarEstadoCita}
            cancelar={cancelarDesdePanel}
            reprogramar={reprogramarDesdePanel}
            verificar={puede(usuario, 'pagos') ? verificarPago : undefined}
          />
          <div className="scroll-x hidden sm:block">
            <table className="tabla min-w-[720px]">
              <thead>
                <tr>
                  <th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th><th>Pago</th><th>Acciones</th>
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
                      {c.tipo === 'revision' ? 'control' : c.tipo}{c.modalidad ? ` · ${c.modalidad}` : ''}
                    </td>
                    <td><Estado valor={c.estado} /></td>
                    <td>
                      {puede(usuario, 'pagos') && (!['cancelada', 'reprogramada'].includes(c.estado) || ['por_devolver', 'devuelto'].includes(c.pago_estado ?? '')) ? (
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
                          verificar={verificarPago}
                        />
                      ) : '—'}
                    </td>
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
          </>
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

      {leads.total > 0 && (
        <Seccion
          titulo="Gente que preguntó por WhatsApp"
          descripcion="Los que escribieron y no agendaron. El sistema los retoma dos veces y no insiste más."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Cifra titulo="Preguntaron" valor={String(leads.total)} />
            <Cifra titulo="Agendaron" valor={String(leads.agendaron ?? 0)} tono="bueno" />
            <Cifra titulo="Contestaron" valor={String(leads.respondieron ?? 0)} />
            <Cifra titulo="Sin respuesta" valor={String(leads.agotados ?? 0)} />
          </div>
          <p className="text-[12.5px] text-[var(--color-tinta-3)] mt-3">
            {leads.abiertos ?? 0} en seguimiento · {leads.con_seg1 ?? 0} recibieron el primer
            mensaje · {leads.con_seg2 ?? 0} el segundo
            {(leads.humano ?? 0) > 0 && ` · ${leads.humano} los atendió una persona`}
          </p>
        </Seccion>
      )}

      {porCerrar.length > 0 && (
        <Seccion
          titulo="Citas por cerrar"
          descripcion="Ya pasó su hora y nadie dijo qué ocurrió. Hasta que no se marquen, el cobro de la consulta no entra en Dinero."
        >
          <ul className="space-y-3">
            {porCerrar.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
                <div className="min-w-0">
                  <EnlacePaciente id={c.paciente_id} nombre={c.paciente_nombre} />
                  <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                    {fechaLarga(c.fecha_hora.slice(0, 10))} a las {hora12(soloHora(c.fecha_hora))} · {c.whatsapp}
                  </div>
                </div>
                <AccionesRapidasCita
                  citaId={c.id}
                  estado={c.estado}
                  fechaActual={c.fecha_hora}
                  cambiarEstado={cambiarEstadoCita}
                  cancelar={cancelarDesdePanel}
                  reprogramar={reprogramarDesdePanel}
                />
              </li>
            ))}
          </ul>
        </Seccion>
      )}

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
