import 'server-only';
import type { Rol, Usuario } from './tipos';
import { exigirUsuario } from './auth';

// SQLite no tiene RLS. El equivalente aquí es esta única puerta: TODA escritura y
// TODA lectura sensible pasa por `puede()` / `exigirPermiso()` en el servidor,
// nunca por condicionales de la UI. Los componentes solo esconden botones.
export type Permiso =
  | 'agenda'            // ver, agendar, bloquear, cancelar, reprogramar
  | 'pacientes_ver'
  | 'pacientes_editar'
  | 'documentos_subir'
  | 'pagos'              // registrar un cobro
  | 'cuenta_paciente'   // ver lo que un paciente debe: cargos, pagos y cuotas
  | 'financiamiento'    // crear planes y definir cuánto se cobra
  | 'contabilidad_ver'  // el negocio: ganancias, costos y resúmenes del mes
  | 'gastos_fijos'
  | 'mensajeria'
  | 'seguimiento'
  | 'configuracion';

const MATRIZ: Record<Rol, Permiso[]> = {
  // La recepcionista es la asistente del doctor: ve y maneja todo el dinero
  // (confirmado por el doctor el 2026-09-09).
  recepcion: [
    'agenda', 'pacientes_ver', 'pacientes_editar', 'documentos_subir',
    'pagos', 'cuenta_paciente', 'financiamiento', 'contabilidad_ver', 'gastos_fijos',
    'mensajeria', 'seguimiento', 'configuracion',
  ],
  doctor: [
    'agenda', 'pacientes_ver', 'documentos_subir', 'pagos', 'cuenta_paciente',
    'financiamiento', 'contabilidad_ver', 'gastos_fijos', 'mensajeria',
    'seguimiento', 'configuracion',
  ],
};

export function puede(usuario: Pick<Usuario, 'rol'> | null, permiso: Permiso): boolean {
  if (!usuario) return false;
  return MATRIZ[usuario.rol].includes(permiso);
}

/** Exige sesión + permiso. Devuelve el usuario para poder atribuir la acción. */
export async function exigirPermiso(permiso: Permiso): Promise<Usuario> {
  const u = await exigirUsuario();
  if (!puede(u, permiso)) throw new Error(`Sin permiso: ${permiso}`);
  return u;
}
