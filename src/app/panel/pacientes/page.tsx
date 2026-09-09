import Link from 'next/link';
import { db } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { usd } from '@/lib/dinero';
import { Seccion, Vacio } from '@/componentes/ui';
import { FormPaciente, Plegable } from '@/componentes/FormulariosFicha';
import { guardarPaciente } from '@/acciones/pacientes';

export const dynamic = 'force-dynamic';

type Fila = {
  id: number; nombre: string; cedula: string; whatsapp: string;
  ultima_cita: string | null; total: number; pagado: number;
};

export default async function Pacientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await exigirSesion();
  const { q } = await searchParams;
  const busca = (q ?? '').trim();
  const verCuentas = puede(usuario, 'cuenta_paciente');

  const filas = db.prepare(
    `SELECT p.id, p.nombre, p.cedula, p.whatsapp,
            (SELECT MAX(fecha_hora) FROM citas c WHERE c.paciente_id = p.id) AS ultima_cita,
            (SELECT COALESCE(SUM(monto),0) FROM cargos g WHERE g.paciente_id = p.id) AS total,
            (SELECT COALESCE(SUM(monto),0) FROM pagos g WHERE g.paciente_id = p.id) AS pagado
       FROM pacientes p
      WHERE (? = '' OR p.nombre LIKE ? OR p.cedula LIKE ? OR p.whatsapp LIKE ?)
      ORDER BY COALESCE(ultima_cita, p.created_at) DESC
      LIMIT 200`
  ).all(busca, `%${busca}%`, `%${busca}%`, `%${busca}%`) as Fila[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta">Fichas</p>
          <h1 className="titulo text-[26px] mt-0.5">Pacientes</h1>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={busca} className="campo w-64" placeholder="Nombre, cédula o teléfono" />
          <button className="btn btn-borde">Buscar</button>
        </form>
      </div>

      {puede(usuario, 'pacientes_editar') && (
        <Plegable titulo="Crear paciente nuevo">
          <div className="pt-3">
            <FormPaciente accion={guardarPaciente} />
          </div>
        </Plegable>
      )}

      <Seccion titulo={`${filas.length} paciente(s)`}>
        {filas.length === 0 && <Vacio>No hay pacientes que coincidan.</Vacio>}
        {filas.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[720px]">
              <thead>
                <tr>
                  <th>Paciente</th><th>Cédula</th><th>WhatsApp</th><th>Última cita</th>
                  {verCuentas && <th>Pendiente</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const pendiente = +(f.total - f.pagado).toFixed(2);
                  return (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/panel/pacientes/${f.id}`} className="font-medium hover:underline">
                          {f.nombre}
                        </Link>
                      </td>
                      <td className="text-[13.5px]">{f.cedula}</td>
                      <td className="text-[13.5px]">{f.whatsapp}</td>
                      <td className="text-[13.5px] whitespace-nowrap">{f.ultima_cita?.slice(0, 16) ?? '—'}</td>
                      {verCuentas && (
                        <td className={pendiente > 0 ? 'text-[var(--color-alerta)] font-medium' : ''}>
                          {pendiente > 0 ? usd(pendiente) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </div>
  );
}
