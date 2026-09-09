import Link from 'next/link';
import { db } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { revisionesEnFecha, ETIQUETAS } from '@/lib/cirugias';
import { hoyVET, sumarDias, fechaCorta } from '@/lib/fechas';
import { Seccion, Estado, Vacio, EnlacePaciente } from '@/componentes/ui';
import { BotonForm } from '@/componentes/FormulariosFicha';
import { cambiarEstadoSeguimiento, cambiarEstadoRevision } from '@/acciones/seguimiento';

export const dynamic = 'force-dynamic';

export default async function Seguimiento({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const usuario = await exigirSesion();
  if (!puede(usuario, 'seguimiento')) {
    return <p className="text-[var(--color-alerta)]">Esta sección es de recepción.</p>;
  }

  const sp = await searchParams;
  const estado = ['pendiente', 'hecho', 'descartado'].includes(sp.estado ?? '') ? sp.estado! : 'pendiente';

  const comerciales = db.prepare(
    `SELECT s.*, p.nombre AS paciente, p.whatsapp
       FROM seguimientos s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.tipo = 'comercial' AND s.estado = ?
      ORDER BY s.fecha`
  ).all(estado) as Array<{ id: number; nota: string; fecha: string; estado: string; paciente_id: number; paciente: string; whatsapp: string }>;

  const hoy = hoyVET();
  const revisiones = revisionesEnFecha(sumarDias(hoy, -7), sumarDias(hoy, 45));

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta">Recepción</p>
        <h1 className="titulo text-[26px] mt-0.5">Seguimiento</h1>
        <p className="text-[13.5px] text-[var(--color-tinta-2)] mt-1">
          Cada mensaje que sale del consultorio por WhatsApp se paga. Aquí decides a quién le escribes.
        </p>
      </div>

      <Seccion
        titulo="Re-contacto comercial"
        acciones={
          <div className="flex rounded-lg border border-[var(--color-linea)] overflow-hidden">
            {(['pendiente', 'hecho', 'descartado'] as const).map((e) => (
              <Link key={e} href={`/panel/seguimiento?estado=${e}`}
                className={`px-3 py-1.5 text-[12.5px] font-semibold capitalize ${
                  estado === e ? 'bg-[var(--color-acento)] text-white' : 'bg-[var(--color-tarjeta)] text-[var(--color-tinta-2)]'
                }`}>
                {e}
              </Link>
            ))}
          </div>
        }
      >
        {comerciales.length === 0 && <Vacio>Nada en esta lista.</Vacio>}
        <ul className="space-y-3">
          {comerciales.map((s) => {
            const vencido = s.estado === 'pendiente' && s.fecha <= hoy;
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-papel-2)] pb-3 last:border-0">
                <div>
                  <EnlacePaciente id={s.paciente_id} nombre={s.paciente} />
                  <span className="text-[12.5px] text-[var(--color-tinta-3)]"> · {s.whatsapp}</span>
                  <p className="text-[13.5px] mt-0.5">{s.nota}</p>
                  <p className={`text-[12.5px] mt-0.5 ${vencido ? 'text-[var(--color-alerta)] font-medium' : 'text-[var(--color-tinta-3)]'}`}>
                    Retomar el {fechaCorta(s.fecha)}
                  </p>
                </div>
                {s.estado === 'pendiente' && (
                  <div className="flex gap-1.5">
                    <BotonForm accion={cambiarEstadoSeguimiento}
                      campos={{ seguimiento_id: s.id, estado: 'hecho' }} texto="Hecho" />
                    <BotonForm accion={cambiarEstadoSeguimiento}
                      campos={{ seguimiento_id: s.id, estado: 'descartado' }} texto="Descartar" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Seccion>

      <Seccion titulo="Revisiones postoperatorias" descripcion="Programadas solas al registrar cada cirugía">
        {revisiones.length === 0 && <Vacio>Ninguna en las próximas semanas.</Vacio>}
        <div className="scroll-x">
          <table className="tabla min-w-[700px]">
            <thead><tr><th>Fecha</th><th>Paciente</th><th>Revisión</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {revisiones.map((r) => (
                <tr key={r.id}>
                  <td className={`whitespace-nowrap ${r.fecha_programada <= hoy ? 'font-medium text-[var(--color-alerta)]' : ''}`}>
                    {fechaCorta(r.fecha_programada)}
                  </td>
                  <td>
                    <EnlacePaciente id={r.paciente_id} nombre={r.paciente} />
                    <div className="text-[12.5px] text-[var(--color-tinta-3)]">{r.whatsapp}</div>
                  </td>
                  <td className="text-[13.5px]">
                    {ETIQUETAS[r.etiqueta] ?? r.etiqueta}
                    <div className="text-[12.5px] text-[var(--color-tinta-3)]">{r.procedimiento}</div>
                  </td>
                  <td><Estado valor={r.estado} /></td>
                  <td>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      <Link href={`/panel/agenda?fecha=${r.fecha_programada}`} className="btn btn-borde h-8 px-2.5 text-[12.5px]">
                        Agendar
                      </Link>
                      <BotonForm accion={cambiarEstadoRevision}
                        campos={{ revision_id: r.id, estado: 'completada' }} texto="Completada" />
                      <BotonForm accion={cambiarEstadoRevision}
                        campos={{ revision_id: r.id, estado: 'omitida' }} texto="Omitir" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
