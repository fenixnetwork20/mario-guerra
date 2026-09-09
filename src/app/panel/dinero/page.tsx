import { db } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { resumenMensual, mesActual, usd, cuotasVencidas } from '@/lib/dinero';
import { Seccion, Cifra, Vacio, EnlacePaciente } from '@/componentes/ui';
import { Plegable, BotonForm } from '@/componentes/FormulariosFicha';
import { FormGastoFijo } from '@/componentes/FormGastoFijo';
import { guardarGastoFijo, eliminarGastoFijo } from '@/acciones/dinero';

export const dynamic = 'force-dynamic';

export default async function Dinero({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirSesion();
  if (!puede(usuario, 'contabilidad_ver')) {
    return <p className="text-[var(--color-alerta)]">No tienes acceso a esta sección.</p>;
  }

  const sp = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : mesActual();
  const r = resumenMensual(mes);

  const pagos = db.prepare(
    `SELECT p.*, pa.nombre AS paciente, pa.id AS pid
       FROM pagos p JOIN pacientes pa ON pa.id = p.paciente_id
      WHERE substr(p.fecha,1,7) = ? ORDER BY p.fecha DESC, p.id DESC`
  ).all(mes) as Array<{ id: number; monto: number; metodo: string; fecha: string; concepto: string | null; paciente: string; pid: number }>;

  const operaciones = db.prepare(
    `SELECT c.id, c.procedimiento, c.fecha, c.estado, pa.id AS pid, pa.nombre AS paciente,
            (SELECT COALESCE(SUM(monto),0) FROM pagos g WHERE g.cirugia_id = c.id) AS ingresos,
            (SELECT COALESCE(SUM(monto),0) FROM costos_operacion k WHERE k.cirugia_id = c.id) AS costos
       FROM cirugias c JOIN pacientes pa ON pa.id = c.paciente_id
      WHERE c.estado <> 'cancelada'
      ORDER BY COALESCE(c.fecha, c.created_at) DESC LIMIT 50`
  ).all() as Array<{ id: number; procedimiento: string; fecha: string | null; estado: string; pid: number; paciente: string; ingresos: number; costos: number }>;

  const gastos = db.prepare('SELECT * FROM gastos_fijos WHERE mes = ? ORDER BY id DESC').all(mes) as
    Array<{ id: number; concepto: string; categoria: string | null; monto: number }>;

  const vencidas = cuotasVencidas();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta">Contabilidad · todo en USD</p>
          <h1 className="titulo text-[26px] mt-0.5">Dinero</h1>
        </div>
        <form className="flex gap-2 items-end">
          <label className="block">
            <span className="text-[12.5px] font-medium">Mes</span>
            <input type="month" name="mes" defaultValue={mes} className="campo mt-1" />
          </label>
          <button className="btn btn-borde">Ver</button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cifra titulo="Ingresos" valor={usd(r.ingresos)} tono="bueno" />
        <Cifra titulo="Costos de operaciones" valor={usd(r.costosOp)} />
        <Cifra titulo="Gastos fijos" valor={usd(r.gastos)} />
        <Cifra titulo="Ganancia neta" valor={usd(r.neto)} tono={r.neto >= 0 ? 'bueno' : 'malo'} />
      </div>

      <Seccion titulo="Ingresos por método">
        {r.porMetodo.length === 0 && <Vacio>Sin cobros este mes.</Vacio>}
        <div className="flex flex-wrap gap-3">
          {r.porMetodo.map((m) => (
            <div key={m.metodo} className="rounded-lg border border-[var(--color-linea)] px-4 py-2">
              <span className="etiqueta capitalize">{m.metodo}</span>
              <p className="titulo text-[18px]">{usd(m.s)}</p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo={`Pagos de ${mes}`}>
        {pagos.length === 0 && <Vacio>Sin pagos registrados.</Vacio>}
        {pagos.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[640px]">
              <thead><tr><th>Fecha</th><th>Paciente</th><th>Método</th><th>Concepto</th><th className="text-right">Monto</th></tr></thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{p.fecha}</td>
                    <td><EnlacePaciente id={p.pid} nombre={p.paciente} /></td>
                    <td className="capitalize">{p.metodo}</td>
                    <td className="text-[13.5px]">{p.concepto || '—'}</td>
                    <td className="text-right font-medium">{usd(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Ganancia por operación" descripcion="Ingresos ligados a la cirugía menos sus costos">
        {operaciones.length === 0 && <Vacio>Sin cirugías registradas.</Vacio>}
        {operaciones.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[720px]">
              <thead>
                <tr><th>Cirugía</th><th>Paciente</th><th>Fecha</th>
                  <th className="text-right">Ingresos</th><th className="text-right">Costos</th><th className="text-right">Ganancia</th></tr>
              </thead>
              <tbody>
                {operaciones.map((o) => {
                  const g = +(o.ingresos - o.costos).toFixed(2);
                  return (
                    <tr key={o.id}>
                      <td>{o.procedimiento}</td>
                      <td><EnlacePaciente id={o.pid} nombre={o.paciente} /></td>
                      <td className="whitespace-nowrap">{o.fecha ?? '—'}</td>
                      <td className="text-right">{usd(o.ingresos)}</td>
                      <td className="text-right">{usd(o.costos)}</td>
                      <td className={`text-right font-medium ${g >= 0 ? 'text-[var(--color-acento)]' : 'text-[var(--color-alerta)]'}`}>
                        {usd(g)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <div className="grid lg:grid-cols-2 gap-6">
        <Seccion titulo={`Gastos fijos de ${mes}`}>
          {gastos.length === 0 && <Vacio>Sin gastos cargados.</Vacio>}
          <ul className="space-y-2 text-[13.5px]">
            {gastos.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3">
                <span>{g.concepto}{g.categoria ? ` · ${g.categoria}` : ''}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">{usd(g.monto)}</span>
                  {puede(usuario, 'gastos_fijos') && (
                    <BotonForm accion={eliminarGastoFijo} campos={{ gasto_id: g.id }}
                      texto="Eliminar" variante="peligro" confirmar="¿Seguro?" />
                  )}
                </span>
              </li>
            ))}
          </ul>
          {puede(usuario, 'gastos_fijos') && (
            <div className="mt-4">
              <Plegable titulo="Cargar gasto fijo" abiertoPorDefecto={gastos.length === 0}>
                <div className="pt-3"><FormGastoFijo accion={guardarGastoFijo} mes={mes} /></div>
              </Plegable>
            </div>
          )}
        </Seccion>

        <Seccion titulo="Cuotas vencidas">
          {vencidas.length === 0 && <Vacio>Nada vencido.</Vacio>}
          <ul className="space-y-2 text-[13.5px]">
            {vencidas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <div>
                  <EnlacePaciente id={c.paciente_id} nombre={c.paciente} />
                  <div className="text-[12.5px] text-[var(--color-tinta-3)]">
                    Cuota {c.numero} · {c.procedimiento} · venció {c.fecha_vencimiento}
                  </div>
                </div>
                <span className="font-medium text-[var(--color-alerta)]">{usd(c.monto)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </div>
  );
}
