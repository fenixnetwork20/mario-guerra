import 'server-only';
import { db } from './db';
import { enviarPlantilla, linkGestion, normalizarTelefono } from './mensajeria';
import { notificar } from './notificaciones';
import { anotarEnMemoria, textoDePlantilla, odi, primerNombre } from './leads';
import { validarWhatsapp } from './validar';
import { ahoraVET, horaVET, sumarDias, soloFecha, soloHora, fechaLarga, hora12 } from './fechas';

/**
 * Seguimiento a quien se valoró y no arrancó su proceso.
 *
 * Siete días después de la valoración se le escribe una vez, con la plantilla
 * de mensaje manual que ya está aprobada como utilidad (no hace falta otra).
 * Cuando la persona responde, el bot sigue la conversación con el contexto que
 * queda anotado en su memoria.
 *
 * No se le escribe a quien:
 *  - tiene la marca "inició su proceso" en su ficha,
 *  - tiene una cirugía registrada,
 *  - tiene otra cita por delante (ya volvió solo),
 *  - ya recibió este seguimiento.
 *
 * La ventana es de 7 a 10 días: más tarde ya no es seguimiento, y así al
 * prender esto no le cae un mensaje a todo el que se valoró hace meses.
 */
const DIAS_DESPUES = 7;
const DIAS_TOPE = 10;
// Una sola franja, de mañana: es un mensaje para pensar, no para contestar en la noche.
const FRANJA: [string, string] = ['09:00', '11:00'];

type Candidata = {
  id: number; paciente_id: number; fecha_hora: string; token_gestion: string;
  procedimiento_interes: string | null; nombre: string; whatsapp: string;
};

export function candidatasPostconsulta(ahora = ahoraVET()): Candidata[] {
  const hoy = soloFecha(ahora);
  return db.prepare(
    `SELECT c.id, c.paciente_id, c.fecha_hora, c.token_gestion, c.procedimiento_interes,
            p.nombre, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.tipo = 'valoracion'
        AND c.estado IN ('completada', 'confirmada')
        AND c.postconsulta_at IS NULL
        AND substr(c.fecha_hora, 1, 10) <= ?
        AND substr(c.fecha_hora, 1, 10) >= ?
        AND p.proceso_iniciado_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM cirugias x WHERE x.paciente_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM citas f WHERE f.paciente_id = p.id
                          AND f.fecha_hora > c.fecha_hora
                          AND f.estado IN ('reservada', 'confirmada', 'completada'))
      ORDER BY c.fecha_hora`
  ).all(sumarDias(hoy, -DIAS_DESPUES), sumarDias(hoy, -DIAS_TOPE)) as Candidata[];
}

/** El contacto de odichat de ese número, para dejarle al bot el contexto. */
async function contactoDe(telefono: string): Promise<{ contacto: number | null; conversacion: number | null }> {
  const lead = db.prepare(
    'SELECT contacto_id, conversacion_id FROM leads_wa WHERE telefono = ? ORDER BY id DESC LIMIT 1'
  ).get(telefono) as { contacto_id: number | null; conversacion_id: number | null } | undefined;
  if (lead?.contacto_id) return { contacto: lead.contacto_id, conversacion: lead.conversacion_id };
  try {
    const r = await odi(`/contacts/search?q=${encodeURIComponent(telefono)}`);
    const c = (r.payload ?? []).find((x: { phone_number?: string }) =>
      (x.phone_number || '').replace(/\D/g, '') === telefono);
    if (!c) return { contacto: null, conversacion: null };
    const conv = await odi(`/contacts/${c.id}/conversations`);
    // El mismo contacto puede tener conversaciones en otras bandejas: la que
    // sirve es la del WhatsApp del consultorio.
    const delConsultorio = (conv.payload ?? []).find((x: { inbox_id: number }) =>
      x.inbox_id === Number(process.env.ODICHAT_INBOX || 85));
    return { contacto: c.id, conversacion: delConsultorio?.id ?? null };
  } catch {
    return { contacto: null, conversacion: null };
  }
}

/** `soloPaciente` y `ignorarFranja` existen para probar con un paciente de prueba. */
export async function correrPostconsulta(op: { soloPaciente?: number; ignorarFranja?: boolean } = {}) {
  const reporte = { postconsulta: 0 };
  const hora = horaVET();
  if (!op.ignorarFranja && (hora < FRANJA[0] || hora >= FRANJA[1])) return reporte;

  const yaEscritos = new Set<number>();
  for (const c of candidatasPostconsulta()) {
    if (op.soloPaciente && c.paciente_id !== op.soloPaciente) continue;
    if (yaEscritos.has(c.paciente_id)) continue;
    const telefono = normalizarTelefono(c.whatsapp);
    // Un número que hoy no pasaría la reserva (sin código de país y que no es
    // celular venezolano) no se adivina: se salta y queda a la vista en la ficha.
    if (!telefono || !validarWhatsapp(c.whatsapp).ok) {
      db.prepare("UPDATE citas SET postconsulta_at = ? WHERE paciente_id = ? AND tipo = 'valoracion' AND postconsulta_at IS NULL")
        .run(`omitido: número dudoso (${ahoraVET()})`, c.paciente_id);
      notificar('seguimiento', `No se le mandó el seguimiento de 7 días a ${c.nombre}: su WhatsApp (${c.whatsapp}) no parece válido. Corrígelo en su ficha.`, `/panel/pacientes/${c.paciente_id}`);
      yaEscritos.add(c.paciente_id);
      continue;
    }

    const nombre = primerNombre(c.nombre) || c.nombre.split(' ')[0];
    const fecha = fechaLarga(soloFecha(c.fecha_hora));
    const hora12c = hora12(soloHora(c.fecha_hora));
    const link = linkGestion(c.token_gestion);
    const ok = await enviarPlantilla({
      clave: 'libre',
      pacienteId: c.paciente_id,
      citaId: c.id,
      destino: c.whatsapp,
      variables: { nombre, fecha, hora: hora12c, link },
    });
    // Se marca aunque falle: un número malo no puede reintentarse cada 15 minutos.
    // El fallo queda en Mensajería.
    db.prepare('UPDATE citas SET postconsulta_at = ? WHERE paciente_id = ? AND tipo = ? AND postconsulta_at IS NULL')
      .run(ahoraVET(), c.paciente_id, 'valoracion');
    yaEscritos.add(c.paciente_id);
    if (!ok) continue;
    reporte.postconsulta++;

    // La plantilla sale por la API de Meta y no pasa por el bot: sin esto, cuando
    // la persona contesta, el bot no sabe de qué le están hablando.
    const { contacto, conversacion } = await contactoDe(telefono);
    const texto = textoDePlantilla('libre', [nombre, fecha, hora12c, link]);
    // El bot reconoce este mensaje en su historial (regla en su prompt) y sabe
    // que es el seguimiento de una valoración que ya pasó.
    await anotarEnMemoria({ contacto_id: contacto }, texto);
    if (conversacion) {
      await fetch(`https://portal.odichat.app/api/v1/accounts/11/conversations/${conversacion}/messages`, {
        method: 'POST',
        headers: { api_access_token: process.env.ODICHAT_TOKEN || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Se le envió el seguimiento de los 7 días después de su valoración del ${fecha}.`,
          message_type: 'outgoing',
          private: true,
        }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => { /* la nota es ayuda, no requisito */ });
    }
  }

  if (reporte.postconsulta) {
    notificar('seguimiento',
      `Seguimiento de 7 días enviado a ${reporte.postconsulta} paciente(s) que se valoraron y no han iniciado su proceso.`,
      '/panel/pacientes');
  }
  return reporte;
}
