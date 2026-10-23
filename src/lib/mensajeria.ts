import 'server-only';
import { db, cfg } from './db';

// Capa de envío detrás de una interfaz. Hoy hay dos implementaciones:
//   - 'simulado': registra el mensaje en mensajes_enviados sin gastar nada (por defecto).
//   - 'meta':     WhatsApp Business API (Cloud API) con plantillas aprobadas.
// Conectar Meta no toca ningún otro módulo: basta con las variables de entorno
// y poner mensajeria_activa = 1 en Configuración.

export type Variables = Record<string, string>;

export interface ProveedorWhatsApp {
  nombre: string;
  enviar(destino: string, plantillaMeta: string, idioma: string, variables: string[]):
    Promise<{ ok: boolean; respuesta: string }>;
}

const simulado: ProveedorWhatsApp = {
  nombre: 'simulado',
  async enviar(destino, plantillaMeta, _idioma, variables) {
    return { ok: true, respuesta: `simulado → ${destino} [${plantillaMeta}] ${JSON.stringify(variables)}` };
  },
};

const meta: ProveedorWhatsApp = {
  nombre: 'meta',
  async enviar(destino, plantillaMeta, idioma, variables) {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;
    if (!phoneId || !token) return { ok: false, respuesta: 'Faltan WHATSAPP_PHONE_ID / WHATSAPP_TOKEN' };
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: destino,
          type: 'template',
          template: {
            name: plantillaMeta,
            language: { code: idioma || 'es' },
            components: variables.length
              ? [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: v })) }]
              : [],
          },
        }),
      });
      const texto = await r.text();
      return { ok: r.ok, respuesta: texto.slice(0, 500) };
    } catch (e) {
      return { ok: false, respuesta: String(e).slice(0, 500) };
    }
  },
};

function proveedor(): ProveedorWhatsApp {
  return cfg('mensajeria_activa', '0') === '1' ? meta : simulado;
}

/**
 * Al formato que espera Meta: 04129086272 → 584129086272, +1 832 593 0835 → 18325930835.
 * Ojo con el caso de diez dígitos sueltos: se asume Venezuela, que es de donde viene
 * casi todo paciente. Un número extranjero hay que guardarlo con su código de país.
 */
export function normalizarTelefono(v: string): string {
  const crudo = (v || '').trim();
  const d = crudo.replace(/\D/g, '');
  // Escrito con `+`, el código de país ya viene puesto: no se toca.
  if (crudo.startsWith('+')) return d;
  if (d.startsWith('58')) return d;
  if (d.startsWith('0')) return `58${d.slice(1)}`;
  if (d.length === 10) return `58${d}`;
  return d;
}

export function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || 'https://fenixflowai.com/marioguerra').replace(/\/$/, '');
}

export const linkGestion = (token: string) => `${baseUrl()}/cita/${token}`;
export const linkReserva = (token?: string) =>
  token ? `${baseUrl()}/reservar?desde=${token}` : `${baseUrl()}/reservar`;

type Envio = {
  clave: string;                 // clave de plantillas_mensajes
  pacienteId?: number | null;
  citaId?: number | null;
  destino: string;               // whatsapp del paciente, sin normalizar
  variables: Variables;
  /** false = no dejar la nota en el chat (quien llama deja la suya). */
  nota?: boolean;
};

/**
 * Dispara una plantilla y deja el rastro en mensajes_enviados.
 * Devuelve false si la plantilla no está configurada o el envío falló.
 */
/**
 * Las citas de control tienen sus propias plantillas, que dicen "cita de
 * control" y no "cita de valoración". Mientras Meta no las apruebe (o si
 * alguien las desactiva) se usa la de siempre: un texto con la palabra
 * equivocada es mejor que un mensaje que no sale.
 */
const VERSION_CONTROL: Record<string, string> = {
  reserva_recibida: 'control_reservado',
  recordatorio_1: 'control_recordatorio',
};
export function claveParaCita(clave: string, tipo: string | null | undefined): string {
  const alterna = VERSION_CONTROL[clave];
  if (tipo !== 'revision' || !alterna) return clave;
  const fila = db.prepare(
    'SELECT activa, meta_template_name FROM plantillas_mensajes WHERE clave = ?'
  ).get(alterna) as { activa: number; meta_template_name: string | null } | undefined;
  return fila?.activa && fila.meta_template_name ? alterna : clave;
}

export async function enviarPlantilla(e: Envio): Promise<boolean> {
  const pl = db
    .prepare('SELECT * FROM plantillas_mensajes WHERE clave = ?')
    .get(e.clave) as
    | { clave: string; nombre: string; meta_template_name: string | null; idioma: string; variables: string; activa: number; cuerpo_ejemplo: string | null }
    | undefined;

  const destino = normalizarTelefono(e.destino);
  const registrar = (estado: string, respuesta: string) =>
    db
      .prepare(
        `INSERT INTO mensajes_enviados (paciente_id, cita_id, plantilla, destino, variables, estado, respuesta)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(e.pacienteId ?? null, e.citaId ?? null, e.clave, destino,
           JSON.stringify(e.variables), estado, respuesta);

  if (!pl || !pl.activa) {
    registrar('error', 'Plantilla inexistente o desactivada');
    return false;
  }
  if (!destino) {
    registrar('error', 'Número de destino vacío o inválido');
    return false;
  }

  const orden: string[] = JSON.parse(pl.variables || '[]');
  const valores = orden.map((v) => e.variables[v] ?? '');

  const prov = proveedor();
  if (prov.nombre === 'meta' && !pl.meta_template_name) {
    registrar('error', 'La plantilla no tiene nombre aprobado de Meta');
    return false;
  }

  const r = await prov.enviar(destino, pl.meta_template_name || pl.clave, pl.idioma, valores);
  registrar(prov.nombre === 'simulado' ? 'simulado' : r.ok ? 'enviado' : 'error', r.respuesta);
  if (r.ok && prov.nombre === 'meta' && e.nota !== false) {
    const texto = (pl.cuerpo_ejemplo || '').replace(/\{\{(\d+)\}\}/g, (_, n) => valores[Number(n) - 1] ?? '') || valores.filter(Boolean).join(' · ');
    await notaEnChat(destino, `Plantilla "${pl.nombre}" enviada por el sistema:\n\n${texto}`);
  }
  return r.ok;
}

/**
 * Nota interna en la conversación del paciente con lo que se le mandó.
 *
 * Las plantillas salen directo por la API de Meta y Odichat no las ve: en el
 * chat de Nathalie Sánchez no aparecía ni la reserva ni los dos recordatorios,
 * y el consultorio no tenía cómo saber qué se le había dicho. Solo se anota si
 * ya hay conversación: crear una desde aquí podría despertar al bot.
 */
async function notaEnChat(telefono: string, texto: string) {
  const token = process.env.ODICHAT_TOKEN;
  if (!token) return;
  const base = 'https://portal.odichat.app/api/v1/accounts/11';
  const h = { api_access_token: token, 'Content-Type': 'application/json', 'User-Agent': 'marioguerra/1.0' };
  try {
    const c = await fetch(`${base}/contacts/search?q=${encodeURIComponent(telefono)}`, { headers: h, signal: AbortSignal.timeout(10000) })
      .then((x) => x.json());
    const contacto = (c?.payload ?? []).find((x: { phone_number?: string }) =>
      (x.phone_number || '').replace(/\D/g, '') === telefono);
    if (!contacto) return;
    const cv = await fetch(`${base}/contacts/${contacto.id}/conversations`, { headers: h, signal: AbortSignal.timeout(10000) })
      .then((x) => x.json());
    const conv = (cv?.payload ?? []).find((x: { inbox_id: number }) =>
      x.inbox_id === Number(process.env.ODICHAT_INBOX || 85));
    if (!conv) return;
    await fetch(`${base}/conversations/${conv.id}/messages`, {
      method: 'POST', headers: h, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ content: texto, message_type: 'outgoing', private: true }),
    });
  } catch { /* la nota es ayuda: que falle no puede tumbar el envío */ }
}
