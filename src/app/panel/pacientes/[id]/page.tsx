import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { estadoCuenta, resumenCirugia, planesDeCirugia, cuotasDePlan, usd } from '@/lib/dinero';
import { cirugiasDePaciente, revisionesDeCirugia, ETIQUETAS } from '@/lib/cirugias';
import { fechaCorta, hora12, soloHora } from '@/lib/fechas';
import { api } from '@/lib/rutas';
import { Seccion, Estado, Cifra, Vacio } from '@/componentes/ui';
import {
  Plegable, FormPaciente, FormPago, FormCargo, FormCirugia, FormCosto, FormPlan,
  FormDocumento, BotonForm,
} from '@/componentes/FormulariosFicha';
import { guardarPaciente, subirDocumento, eliminarDocumento } from '@/acciones/pacientes';
import {
  registrarPago, registrarCargo, guardarCirugia, registrarCosto, guardarPlan, eliminarPlan,
} from '@/acciones/dinero';
import { crearSeguimiento } from '@/acciones/seguimiento';
import { FormSeguimiento } from '@/componentes/FormSeguimiento';

export const dynamic = 'force-dynamic';

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirSesion();
  const { id } = await params;
  const pacienteId = Number(id);

  const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(pacienteId) as
    | { id: number; nombre: string; cedula: string; whatsapp: string; edad: number | null; notas_medicas: string | null; created_at: string }
    | undefined;
  if (!paciente) notFound();

  const verCuentas = puede(usuario, 'cuenta_paciente');   // lo que el paciente debe
  const verNegocio = puede(usuario, 'contabilidad_ver');  // ganancias y costos del consultorio
  const cuenta = estadoCuenta(pacienteId);
  const cirugias = cirugiasDePaciente(pacienteId);
  const citas = db.prepare('SELECT * FROM citas WHERE paciente_id = ? ORDER BY fecha_hora DESC').all(pacienteId) as
    Array<{ id: number; tipo: string; modalidad: string | null; fecha_hora: string; estado: string; procedimiento_interes: string | null; token_gestion: string }>;
  const pagos = db.prepare('SELECT * FROM pagos WHERE paciente_id = ? ORDER BY fecha DESC, id DESC').all(pacienteId) as
    Array<{ id: number; monto: number; metodo: string; fecha: string; concepto: string | null; cirugia_id: number | null }>;
  const cargos = db.prepare('SELECT * FROM cargos WHERE paciente_id = ? ORDER BY fecha DESC, id DESC').all(pacienteId) as
    Array<{ id: number; concepto: string; monto: number; fecha: string }>;
  const documentos = db.prepare('SELECT * FROM documentos WHERE paciente_id = ? ORDER BY fecha DESC, id DESC').all(pacienteId) as
    Array<{ id: number; tipo: string; nombre: string; fecha: string; mime: string | null }>;

  const catalogo = db.prepare('SELECT nombre, precio_referencia FROM procedimientos_catalogo WHERE activo = 1 ORDER BY orden, nombre')
    .all() as { nombre: string; precio_referencia: number | null }[];
  const precios = Object.fromEntries(catalogo.map((c) => [c.nombre, c.precio_referencia]));
  const nombresProc = catalogo.map((c) => c.nombre);
  const cirugiasSimples = cirugias.map((c) => ({ id: c.id, procedimiento: c.procedimiento }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="etiqueta">Ficha del paciente</p>
          <h1 className="titulo text-[28px] mt-0.5">{paciente.nombre}</h1>
          <p className="text-[13.5px] text-[var(--color-tinta-2)] mt-1">
            {paciente.cedula} · {paciente.whatsapp}
            {paciente.edad ? ` · ${paciente.edad} años` : ''}
          </p>
        </div>
        <Link href="/panel/pacientes" className="btn btn-borde h-9">Volver</Link>
      </div>

      {verCuentas && (
      <div className="grid grid-cols-3 gap-3">
        <Cifra titulo="Cargos" valor={usd(cuenta.total)} />
        <Cifra titulo="Pagado" valor={usd(cuenta.pagado)} tono="bueno" />
        <Cifra
          titulo="Pendiente" valor={usd(cuenta.pendiente)}
          tono={cuenta.pendiente > 0 ? 'malo' : 'normal'}
          detalle="Calculado, no editable"
        />
      </div>
      )}

      {paciente.notas_medicas && (
        <Seccion titulo="Notas y condiciones médicas">
          <p className="text-[14px] whitespace-pre-wrap">{paciente.notas_medicas}</p>
        </Seccion>
      )}

      {puede(usuario, 'pacientes_editar') && (
        <Plegable titulo="Editar datos del paciente">
          <div className="pt-3"><FormPaciente accion={guardarPaciente} paciente={paciente} /></div>
        </Plegable>
      )}

      <Seccion titulo="Historial de citas">
        {citas.length === 0 && <Vacio>Sin citas registradas.</Vacio>}
        {citas.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[640px]">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Interés</th><th></th></tr></thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">
                      {fechaCorta(c.fecha_hora.slice(0, 10))} · {hora12(soloHora(c.fecha_hora))}
                    </td>
                    <td className="capitalize text-[13.5px]">{c.tipo}{c.modalidad ? ` · ${c.modalidad}` : ''}</td>
                    <td><Estado valor={c.estado} /></td>
                    <td className="text-[13.5px]">{c.procedimiento_interes ?? '—'}</td>
                    <td className="text-right">
                      <Link href={`/cita/${c.token_gestion}`} target="_blank"
                        className="text-[12.5px] text-[var(--color-acento)] font-semibold hover:underline">
                        Enlace del paciente
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cirugías y procedimientos">
        {cirugias.length === 0 && <Vacio>Ninguna registrada.</Vacio>}
        <div className="space-y-5">
          {cirugias.map((c) => {
            const r = resumenCirugia(c.id);
            const cuentaC = { pagado: r.ingresos };
            const costos = db.prepare('SELECT * FROM costos_operacion WHERE cirugia_id = ? ORDER BY fecha, id')
              .all(c.id) as { id: number; concepto: string; monto: number; fecha: string }[];
            const planes = planesDeCirugia(c.id);
            const revisiones = revisionesDeCirugia(c.id);

            return (
              <div key={c.id} className="rounded-lg border border-[var(--color-linea)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="titulo text-[17px]">{c.procedimiento}</h3>
                    <p className="text-[13px] text-[var(--color-tinta-3)]">
                      {c.fecha ?? 'sin fecha'}{verCuentas ? ` · acordado ${usd(c.precio_acordado)}` : ''}
                    </p>
                  </div>
                  <Estado valor={c.estado} />
                </div>

                {puede(usuario, 'contabilidad_ver') && (
                  <div className="grid grid-cols-3 gap-2 mt-3 text-[13.5px]">
                    <div><span className="etiqueta block">Ingresos</span>{usd(r.ingresos)}</div>
                    <div><span className="etiqueta block">Costos</span>{usd(r.costos)}</div>
                    <div>
                      <span className="etiqueta block">Ganancia</span>
                      <span className={r.ganancia >= 0 ? 'text-[var(--color-acento)] font-medium' : 'text-[var(--color-alerta)] font-medium'}>
                        {usd(r.ganancia)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {verNegocio && (
                  <Plegable titulo={`Costos de la operación (${costos.length})`}>
                    <div className="pt-2 space-y-2">
                      {costos.map((k) => (
                        <div key={k.id} className="flex justify-between text-[13.5px]">
                          <span>{k.concepto} <span className="text-[var(--color-tinta-3)]">· {k.fecha}</span></span>
                          <span>{usd(k.monto)}</span>
                        </div>
                      ))}
                      {puede(usuario, 'contabilidad_ver') && (
                        <div className="pt-2"><FormCosto accion={registrarCosto} cirugiaId={c.id} /></div>
                      )}
                    </div>
                  </Plegable>
                  )}

                  {verCuentas && (
                  <Plegable titulo={`Financiamiento (${planes.length})`}>
                    <div className="pt-2 space-y-4">
                      {planes.map((p) => {
                        const cuotas = cuotasDePlan(p.id);
                        return (
                          <div key={p.id} className="rounded-md bg-[var(--color-papel)] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                              <span>
                                Total {usd(p.total)} · inicial {usd(p.inicial)} · {p.meses} mes(es) desde {p.fecha_inicio}
                              </span>
                              {puede(usuario, 'financiamiento') && (
                                <BotonForm accion={eliminarPlan} campos={{ plan_id: p.id }}
                                  texto="Eliminar" variante="peligro" confirmar="¿Seguro?" />
                              )}
                            </div>
                            <table className="tabla mt-2">
                              <thead><tr><th>#</th><th>Monto</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
                              <tbody>
                                {cuotas.map((q) => (
                                  <tr key={q.id}>
                                    <td>{q.numero}</td>
                                    <td>{usd(q.monto)}</td>
                                    <td>{q.fecha_vencimiento}</td>
                                    <td><Estado valor={q.estado} /></td>
                                    <td className="text-right">
                                      {q.estado === 'pendiente' && puede(usuario, 'pagos') && (
                                        <Plegable titulo="Registrar pago">
                                          <div className="pt-2">
                                            <FormPago
                                              accion={registrarPago} pacienteId={pacienteId}
                                              cirugias={cirugiasSimples} cuotaId={q.id}
                                              montoSugerido={q.monto} cirugiaSugerida={c.id}
                                            />
                                          </div>
                                        </Plegable>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                      {puede(usuario, 'financiamiento') && (
                        <FormPlan accion={guardarPlan} cirugiaId={c.id}
                          totalSugerido={+(c.precio_acordado - cuentaC.pagado).toFixed(2)} />
                      )}
                    </div>
                  </Plegable>
                  )}

                  <Plegable titulo={`Revisiones postoperatorias (${revisiones.length})`}>
                    <ul className="pt-2 space-y-1.5 text-[13.5px]">
                      {revisiones.map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-3">
                          <span>{ETIQUETAS[v.etiqueta] ?? v.etiqueta} · {v.fecha_programada}</span>
                          <Estado valor={v.estado} />
                        </li>
                      ))}
                      {revisiones.length === 0 && <Vacio>Se programan al ponerle fecha a la cirugía.</Vacio>}
                    </ul>
                  </Plegable>

                  {puede(usuario, 'financiamiento') && (
                    <Plegable titulo="Editar cirugía">
                      <div className="pt-2">
                        <FormCirugia accion={guardarCirugia} pacienteId={pacienteId}
                          procedimientos={nombresProc} precios={precios} cirugia={c} />
                      </div>
                    </Plegable>
                  )}
                </div>
              </div>
            );
          })}

          {puede(usuario, 'financiamiento') && (
            <Plegable titulo="Registrar cirugía nueva">
              <div className="pt-3">
                <FormCirugia accion={guardarCirugia} pacienteId={pacienteId}
                  procedimientos={nombresProc} precios={precios} />
              </div>
            </Plegable>
          )}
        </div>
      </Seccion>

      {verCuentas && (
      <div className="grid lg:grid-cols-2 gap-6">
        <Seccion titulo="Pagos">
          {pagos.length === 0 && <Vacio>Sin pagos.</Vacio>}
          <ul className="space-y-2 text-[13.5px]">
            {pagos.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {p.fecha} · <span className="capitalize">{p.metodo}</span>
                  {p.concepto ? ` · ${p.concepto}` : ''}
                </span>
                <span className="font-medium text-[var(--color-acento)]">{usd(p.monto)}</span>
              </li>
            ))}
          </ul>
          {puede(usuario, 'pagos') && (
            <div className="mt-4">
              <Plegable titulo="Registrar pago" abiertoPorDefecto={pagos.length === 0}>
                <div className="pt-3">
                  <FormPago accion={registrarPago} pacienteId={pacienteId} cirugias={cirugiasSimples} />
                </div>
              </Plegable>
            </div>
          )}
        </Seccion>

        <Seccion titulo="Cargos">
          {cargos.length === 0 && <Vacio>Sin cargos.</Vacio>}
          <ul className="space-y-2 text-[13.5px]">
            {cargos.map((k) => (
              <li key={k.id} className="flex justify-between gap-3">
                <span>{k.fecha} · {k.concepto}</span>
                <span className="font-medium">{usd(k.monto)}</span>
              </li>
            ))}
          </ul>
          {puede(usuario, 'financiamiento') && (
            <div className="mt-4">
              <Plegable titulo="Agregar cargo">
                <div className="pt-3">
                  <FormCargo accion={registrarCargo} pacienteId={pacienteId} cirugias={cirugiasSimples} />
                </div>
              </Plegable>
            </div>
          )}
        </Seccion>
      </div>
      )}

      <Seccion titulo="Exámenes y documentos">
        {documentos.length === 0 && <Vacio>Sin archivos.</Vacio>}
        <ul className="space-y-2 text-[13.5px]">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3">
              <a href={api(`/api/documentos/${d.id}`)} target="_blank" rel="noreferrer"
                className="text-[var(--color-acento)] font-medium hover:underline">
                {d.nombre}
              </a>
              <span className="flex items-center gap-3 text-[var(--color-tinta-3)]">
                <span className="capitalize">{d.tipo} · {d.fecha}</span>
                {puede(usuario, 'pacientes_editar') && (
                  <BotonForm accion={eliminarDocumento} campos={{ documento_id: d.id }}
                    texto="Eliminar" variante="peligro" confirmar="¿Seguro?" />
                )}
              </span>
            </li>
          ))}
        </ul>
        {puede(usuario, 'documentos_subir') && (
          <div className="mt-4">
            <Plegable titulo="Subir examen o documento" abiertoPorDefecto={documentos.length === 0}>
              <div className="pt-3"><FormDocumento accion={subirDocumento} pacienteId={pacienteId} /></div>
            </Plegable>
          </div>
        )}
      </Seccion>

      {puede(usuario, 'seguimiento') && (
        <Seccion titulo="Seguimiento" descripcion="Anota cuándo retomar a este paciente">
          <FormSeguimiento accion={crearSeguimiento} pacienteId={pacienteId} />
        </Seccion>
      )}
    </div>
  );
}
