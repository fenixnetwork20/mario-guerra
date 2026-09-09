'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { exigirPermiso } from '@/lib/permisos';
import { enviarPlantilla, linkGestion } from '@/lib/mensajeria';
import { citaPorId } from '@/lib/citas';
import { fechaLarga, hora12, soloFecha, soloHora } from '@/lib/fechas';
import type { Respuesta } from '@/componentes/FormAccion';

export async function guardarPlantilla(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('mensajeria');
  const id = Number(datos.get('plantilla_id'));
  if (!id) return { ok: false, error: 'Plantilla no encontrada.' };

  db.prepare('UPDATE plantillas_mensajes SET meta_template_name=?, idioma=?, cuerpo_ejemplo=?, activa=? WHERE id=?')
    .run(
      String(datos.get('meta_template_name') || '').trim() || null,
      String(datos.get('idioma') || 'es'),
      String(datos.get('cuerpo_ejemplo') || ''),
      datos.get('activa') === '1' ? 1 : 0,
      id
    );
  revalidatePath('/panel/mensajeria');
  return { ok: true, aviso: 'Plantilla guardada.' };
}

/** Envío manual desde recepción: elige la cita y la plantilla. Gasta un mensaje. */
export async function enviarManual(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('mensajeria');
  const citaId = Number(datos.get('cita_id'));
  const clave = String(datos.get('plantilla') || '');
  const cita = citaPorId(citaId);
  if (!cita) return { ok: false, error: 'Cita no encontrada.' };
  if (!clave) return { ok: false, error: 'Elige la plantilla.' };

  const ok = await enviarPlantilla({
    clave,
    pacienteId: cita.paciente_id,
    citaId: cita.id,
    destino: cita.whatsapp,
    variables: {
      nombre: cita.paciente_nombre,
      fecha: fechaLarga(soloFecha(cita.fecha_hora)),
      hora: hora12(soloHora(cita.fecha_hora)),
      link: linkGestion(cita.token_gestion),
    },
  });
  revalidatePath('/panel/mensajeria');
  return ok
    ? { ok: true, aviso: 'Mensaje disparado. Revisa el registro de abajo.' }
    : { ok: false, error: 'No se pudo enviar. Revisa el registro para ver el motivo.' };
}
