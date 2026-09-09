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

/** 04129086272 → 584129086272 (formato que espera Meta). */
export function normalizarTelefono(v: string): string {
  const d = (v || '').replace(/\D/g, '');
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
};

/**
 * Dispara una plantilla y deja el rastro en mensajes_enviados.
 * Devuelve false si la plantilla no está configurada o el envío falló.
 */
export async function enviarPlantilla(e: Envio): Promise<boolean> {
  const pl = db
    .prepare('SELECT * FROM plantillas_mensajes WHERE clave = ?')
    .get(e.clave) as
    | { clave: string; meta_template_name: string | null; idioma: string; variables: string; activa: number }
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
  return r.ok;
}
