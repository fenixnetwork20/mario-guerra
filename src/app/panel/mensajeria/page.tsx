import { db, cfg } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { hoyVET, sumarDias, fechaCorta, hora12, soloHora } from '@/lib/fechas';
import { Seccion, Vacio } from '@/componentes/ui';
import { FormPlantilla, FormEnvioManual } from '@/componentes/FormsConfig';
import { guardarPlantilla, enviarManual } from '@/acciones/mensajeria';

export const dynamic = 'force-dynamic';

export default async function Mensajeria() {
  const usuario = await exigirSesion();
  if (!puede(usuario, 'mensajeria')) {
    return <p className="text-[var(--color-alerta)]">Esta sección es de recepción.</p>;
  }

  const activa = cfg('mensajeria_activa', '0') === '1';
  const plantillas = db.prepare('SELECT * FROM plantillas_mensajes ORDER BY id').all() as
    Array<{ id: number; clave: string; nombre: string; meta_template_name: string | null; idioma: string; variables: string; cuerpo_ejemplo: string | null; activa: number }>;

  const citas = (db.prepare(
    `SELECT c.id, c.fecha_hora, c.estado, p.nombre
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE substr(c.fecha_hora,1,10) BETWEEN ? AND ?
      ORDER BY c.fecha_hora`
  ).all(sumarDias(hoyVET(), -3), sumarDias(hoyVET(), 30)) as
    Array<{ id: number; fecha_hora: string; estado: string; nombre: string }>)
    .map((c) => ({
      id: c.id,
      etiqueta: `${fechaCorta(c.fecha_hora.slice(0, 10))} ${hora12(soloHora(c.fecha_hora))} · ${c.nombre} (${c.estado})`,
    }));

  const registro = db.prepare(
    `SELECT m.*, p.nombre AS paciente
       FROM mensajes_enviados m LEFT JOIN pacientes p ON p.id = m.paciente_id
      ORDER BY m.id DESC LIMIT 80`
  ).all() as Array<{ id: number; plantilla: string; destino: string; estado: string; respuesta: string | null; fecha: string; paciente: string | null }>;

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta">Recepción</p>
        <h1 className="titulo text-[26px] mt-0.5">Mensajería</h1>
      </div>

      <div className={`rounded-lg border px-4 py-3 text-[13.5px] ${
        activa
          ? 'border-[var(--color-acento-2)] bg-[var(--color-acento-luz)]'
          : 'border-[var(--color-linea)] bg-[var(--color-aviso-luz)]'
      }`}>
        {activa
          ? 'Envío real por WhatsApp activado. Cada mensaje se cobra.'
          : 'Modo simulado: los envíos se registran abajo pero no salen a WhatsApp. Se activa en Configuración cuando Meta apruebe las plantillas.'}
      </div>

      <Seccion titulo="Envío manual" descripcion="Escoge la cita y la plantilla. Gasta un mensaje pagado.">
        {citas.length === 0
          ? <Vacio>No hay citas recientes ni próximas.</Vacio>
          : <FormEnvioManual accion={enviarManual} citas={citas}
              plantillas={plantillas.map((p) => ({ clave: p.clave, nombre: p.nombre }))} />}
      </Seccion>

      <Seccion titulo="Plantillas" descripcion="Cambiar el texto exige re-aprobación en Meta; las variables se rellenan solas.">
        <div className="space-y-6">
          {plantillas.map((p) => (
            <div key={p.id} className="border-b border-[var(--color-papel-2)] pb-6 last:border-0 last:pb-0">
              <FormPlantilla accion={guardarPlantilla} plantilla={p} />
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Registro de envíos">
        {registro.length === 0 && <Vacio>Nada enviado todavía.</Vacio>}
        {registro.length > 0 && (
          <div className="scroll-x">
            <table className="tabla min-w-[720px]">
              <thead><tr><th>Fecha</th><th>Paciente</th><th>Plantilla</th><th>Destino</th><th>Estado</th><th>Respuesta</th></tr></thead>
              <tbody>
                {registro.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-[13px]">{m.fecha}</td>
                    <td className="text-[13.5px]">{m.paciente ?? '—'}</td>
                    <td className="text-[13.5px]">{m.plantilla}</td>
                    <td className="text-[13px]">{m.destino}</td>
                    <td>
                      <span className={`pill ${
                        m.estado === 'enviado' ? 'bg-[var(--color-acento-luz)] text-[var(--color-acento)]'
                        : m.estado === 'error' ? 'bg-[var(--color-alerta-luz)] text-[var(--color-alerta)]'
                        : 'bg-[var(--color-papel-2)] text-[var(--color-tinta-2)]'
                      }`}>{m.estado}</span>
                    </td>
                    <td className="text-[12px] text-[var(--color-tinta-3)] max-w-[280px] break-words">
                      {m.respuesta ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </div>
  );
}
