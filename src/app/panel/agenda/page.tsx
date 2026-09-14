import Link from 'next/link';
import { db, cfgNum } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { citasDelDia, citasEntre, bloqueosEntre } from '@/lib/citas';
import { revisionesEnFecha, ETIQUETAS } from '@/lib/cirugias';
import {
  hoyVET, fechaLarga, fechaCorta, hora12, soloHora, sumarDias, inicioSemana, soloFecha,
} from '@/lib/fechas';
import { Seccion, Estado, Vacio, EnlacePaciente } from '@/componentes/ui';
import { AccionesRapidasCita } from '@/componentes/AccionesRapidasCita';
import { PanelAgenda } from '@/componentes/PanelAgenda';
import { agendarManual, crearBloqueo, cambiarEstadoCita, cancelarDesdePanel, editarBloqueo, eliminarBloqueo, verificarPago } from '@/acciones/agenda';
import { FilaBloqueo } from '@/componentes/FilaBloqueo';
import { CeldaPago } from '@/componentes/CeldaPago';

export const dynamic = 'force-dynamic';

export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; vista?: string }>;
}) {
  await exigirSesion();
  const sp = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? '') ? sp.fecha! : hoyVET();
  const vista = sp.vista === 'semana' ? 'semana' : 'dia';

  const procedimientos = (
    db.prepare('SELECT nombre FROM procedimientos_catalogo WHERE activo = 1 ORDER BY orden, nombre')
      .all() as { nombre: string }[]
  ).map((p) => p.nombre);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta">Agenda</p>
          <h1 className="titulo text-[26px] mt-0.5">
            {vista === 'dia' ? fechaLarga(fecha) : `Semana del ${fechaCorta(inicioSemana(fecha))}`}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/panel/agenda?fecha=${sumarDias(fecha, vista === 'dia' ? -1 : -7)}&vista=${vista}`}
            className="btn btn-borde h-9">←</Link>
          <Link href={`/panel/agenda?fecha=${hoyVET()}&vista=${vista}`} className="btn btn-borde h-9">Hoy</Link>
          <Link href={`/panel/agenda?fecha=${sumarDias(fecha, vista === 'dia' ? 1 : 7)}&vista=${vista}`}
            className="btn btn-borde h-9">→</Link>
          <div className="flex rounded-lg border border-[var(--color-linea)] overflow-hidden">
            {(['dia', 'semana'] as const).map((v) => (
              <Link
                key={v}
                href={`/panel/agenda?fecha=${fecha}&vista=${v}`}
                className={`px-3 py-2 text-[13px] font-semibold ${
                  vista === v ? 'bg-[var(--color-acento)] text-white' : 'bg-[var(--color-tarjeta)] text-[var(--color-tinta-2)]'
                }`}
              >
                {v === 'dia' ? 'Día' : 'Semana'}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {vista === 'dia' ? <VistaDia fecha={fecha} /> : <VistaSemana fecha={fecha} />}

      <PanelAgenda
        fecha={fecha}
        duracionPorDefecto={cfgNum('duracion_cita', 60)}
        procedimientos={procedimientos}
        agendar={agendarManual}
        bloquear={crearBloqueo}
      />
    </div>
  );
}

async function VistaDia({ fecha }: { fecha: string }) {
  const citas = citasDelDia(fecha);
  const bloqueos = bloqueosEntre(fecha, fecha);
  const revisiones = revisionesEnFecha(fecha, fecha);

  return (
    <div className="space-y-6">
      <Seccion titulo="Citas">
        {citas.length === 0 && <Vacio>Sin citas este día.</Vacio>}
        {citas.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[900px]">
              <thead>
                <tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th><th>Pago</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-medium">{hora12(soloHora(c.fecha_hora))}</td>
                    <td>
                      <EnlacePaciente id={c.paciente_id} nombre={c.paciente_nombre} />
                      <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                        {c.whatsapp}{c.notas ? ` · ${c.notas}` : ''}
                      </div>
                    </td>
                    <td className="capitalize text-[13.5px]">
                      {c.tipo}{c.modalidad ? ` · ${c.modalidad}` : ''}
                      <div className="text-[12px] text-[var(--color-tinta-3)]">{c.duracion} min · {c.origen}</div>
                    </td>
                    <td><Estado valor={c.estado} /></td>
                    <td>
                      <CeldaPago
                        cita={{
                          id: c.id,
                          estado: c.pago_estado ?? 'pendiente',
                          usd: c.pago_monto_usd ?? null,
                          bs: c.pago_monto_bs ?? null,
                          referencia: c.pago_referencia ?? null,
                          tieneArchivo: Boolean(c.pago_archivo),
                        }}
                        verificar={verificarPago}
                      />
                    </td>
                    <td>
                      <AccionesRapidasCita
                        citaId={c.id} estado={c.estado}
                        cambiarEstado={cambiarEstadoCita} cancelar={cancelarDesdePanel}
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
        <Seccion titulo="Bloqueos">
          {bloqueos.length === 0 && <Vacio>Sin bloqueos.</Vacio>}
          <ul className="space-y-2 text-[14px]">
            {bloqueos.map((b) => (
              <FilaBloqueo
                key={b.id}
                bloqueo={{ id: b.id, inicio: soloHora(b.inicio), fin: soloHora(b.fin), motivo: b.motivo ?? '' }}
                editar={editarBloqueo}
                eliminar={eliminarBloqueo}
              />
            ))}
          </ul>
        </Seccion>

        <Seccion titulo="Revisiones programadas">
          {revisiones.length === 0 && <Vacio>Ninguna.</Vacio>}
          <ul className="space-y-2 text-[14px]">
            {revisiones.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
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
      </div>
    </div>
  );
}

async function VistaSemana({ fecha }: { fecha: string }) {
  const lunes = inicioSemana(fecha);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const citas = citasEntre(dias[0], dias[6]);
  const bloqueos = bloqueosEntre(dias[0], dias[6]);

  return (
    <div className="scroll-x">
      <div className="grid grid-cols-7 gap-2 min-w-[900px]">
        {dias.map((d) => {
          const delDia = citas.filter((c) => soloFecha(c.fecha_hora) === d);
          const bloqDia = bloqueos.filter((b) => soloFecha(b.inicio) === d);
          const esHoy = d === hoyVET();
          return (
            <div key={d} className={`tarjeta p-3 ${esHoy ? 'border-[var(--color-acento)]' : ''}`}>
              <Link href={`/panel/agenda?fecha=${d}&vista=dia`} className="block">
                <p className="etiqueta">{fechaCorta(d)}</p>
              </Link>
              <div className="mt-2 space-y-1.5">
                {delDia.length === 0 && bloqDia.length === 0 && (
                  <p className="text-[12.5px] text-[var(--color-tinta-3)]">—</p>
                )}
                {bloqDia.map((b) => (
                  <div key={`b${b.id}`} className="rounded-md bg-[var(--color-alerta-luz)] px-2 py-1.5">
                    <p className="text-[12px] font-semibold text-[var(--color-alerta)]">
                      {soloHora(b.inicio)}–{soloHora(b.fin)} bloqueado
                    </p>
                  </div>
                ))}
                {delDia.map((c) => {
                  const muerta = ['cancelada', 'reprogramada'].includes(c.estado);
                  return (
                    <div
                      key={c.id}
                      className={`rounded-md px-2 py-1.5 ${
                        muerta ? 'bg-[var(--color-papel-2)] opacity-60' : 'bg-[var(--color-acento-luz)]'
                      }`}
                    >
                      <p className="text-[12px] font-semibold">{hora12(soloHora(c.fecha_hora))}</p>
                      <p className={`text-[12.5px] leading-tight ${muerta ? 'line-through' : ''}`}>
                        {c.paciente_nombre}
                      </p>
                      <p className="text-[11.5px] text-[var(--color-tinta-3)] capitalize">{c.tipo}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
