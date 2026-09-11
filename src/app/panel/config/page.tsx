import { db, leerConfig } from '@/lib/db';
import { exigirSesion } from '@/lib/auth';
import { puede } from '@/lib/permisos';
import { usd } from '@/lib/dinero';
import { AvisosPush } from '@/componentes/AvisosPush';
import { Seccion, Vacio } from '@/componentes/ui';
import { BotonForm } from '@/componentes/FormulariosFicha';
import { FormAjustes, FormHorario, FormProcedimiento, FormUsuario } from '@/componentes/FormsConfig';
import {
  guardarAjustes, guardarHorario, eliminarHorario, guardarProcedimiento, guardarUsuario,
} from '@/acciones/config';

export const dynamic = 'force-dynamic';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default async function Config() {
  const usuario = await exigirSesion();
  if (!puede(usuario, 'configuracion')) {
    return <p className="text-[var(--color-alerta)]">Esta sección es de recepción.</p>;
  }

  const cfg = leerConfig();
  const horarios = db.prepare('SELECT * FROM horarios_atencion ORDER BY dia_semana, hora_inicio').all() as
    Array<{ id: number; dia_semana: number; hora_inicio: string; hora_fin: string; activo: number }>;
  const procedimientos = db.prepare('SELECT * FROM procedimientos_catalogo ORDER BY orden, nombre').all() as
    Array<{ id: number; nombre: string; precio_referencia: number | null; activo: number }>;
  const usuarios = db.prepare('SELECT id, email, nombre, rol, activo FROM usuarios ORDER BY id').all() as
    Array<{ id: number; email: string; nombre: string; rol: string; activo: number }>;

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta">Recepción</p>
        <h1 className="titulo text-[26px] mt-0.5">Configuración</h1>
      </div>

      <Seccion
        titulo="Avisos al teléfono"
        descripcion="Para enterarte sin tener el panel abierto."
      >
        <AvisosPush />
      </Seccion>

      <Seccion titulo="Ajustes generales">
        <FormAjustes accion={guardarAjustes} cfg={cfg} />
      </Seccion>

      <Seccion titulo="Horarios de atención" descripcion="De aquí salen los cupos de la reserva pública.">
        {horarios.length === 0 && <Vacio>Sin horarios: la reserva pública no mostrará cupos.</Vacio>}
        <ul className="space-y-2 text-[13.5px]">
          {horarios.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3">
              <span>{DIAS[h.dia_semana]} · {h.hora_inicio} – {h.hora_fin}</span>
              <BotonForm accion={eliminarHorario} campos={{ horario_id: h.id }}
                texto="Eliminar" variante="peligro" confirmar="¿Seguro?" />
            </li>
          ))}
        </ul>
        <div className="mt-4"><FormHorario accion={guardarHorario} /></div>
      </Seccion>

      <Seccion
        titulo="Catálogo de procedimientos"
        descripcion="Los precios son referencia interna. Nunca se muestran en páginas públicas."
      >
        <div className="space-y-3">
          {procedimientos.map((p) => (
            <div key={p.id} className="border-b border-[var(--color-papel-2)] pb-3 last:border-0">
              <FormProcedimiento accion={guardarProcedimiento} procedimiento={p} />
              {p.precio_referencia != null && (
                <p className="text-[12px] text-[var(--color-tinta-3)] mt-1">
                  Referencia actual: {usd(p.precio_referencia)}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-[var(--color-linea)]">
          <p className="etiqueta mb-2">Agregar procedimiento</p>
          <FormProcedimiento accion={guardarProcedimiento} />
        </div>
      </Seccion>

      <Seccion titulo="Cuentas de acceso" descripcion="Solo estas dos cuentas entran al sistema.">
        <div className="space-y-4">
          {usuarios.map((u) => (
            <div key={u.id} className="border-b border-[var(--color-papel-2)] pb-4 last:border-0">
              <FormUsuario accion={guardarUsuario} usuario={u} />
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  );
}
