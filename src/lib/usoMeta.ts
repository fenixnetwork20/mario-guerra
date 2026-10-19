import 'server-only';
import { db } from './db';

/**
 * Consumo de WhatsApp de Mario, reportado al panel de admin de Fénix
 * (tabla mensajes_enviados de Supabase, la misma que suma el panel).
 *
 * Por qué lo cuenta este sistema y no el sincronizador del panel:
 *  - Las plantillas (reserva, recordatorios, seguimientos) salen directo por la
 *    API de Meta desde aquí y nunca pasan por Chatwoot: el panel no las veía,
 *    y son justo lo que Meta le cobra.
 *  - El reporte de Chatwoot mete en la misma bolsa lo que el consultorio escribe
 *    desde el teléfono (eco de coexistencia), que no sale por la API ni se
 *    cobra. Mirando mensaje por mensaje se separa.
 *
 * Qué cuenta, por día (UTC, igual que el panel):
 *  - plantilla: lo enviado por Meta desde este sistema (mensajes_enviados local).
 *  - bot: lo que sale por la API con el usuario del sistema (bot de n8n y
 *    seguimientos en texto libre).
 *  - humano: lo que alguien escribió desde Chatwoot (también sale por la API).
 * No cuenta: notas internas ni lo escrito desde la app del teléfono.
 *
 * Idempotente: borra y reescribe los días que pudo recontar completos.
 */
const PREFIJO = 'dr_mario_guerra';
const FUENTE = 'marioguerra';
const ODI = 'https://portal.odichat.app/api/v1/accounts/11';
const INBOX = Number(process.env.ODICHAT_INBOX || 85);
// El usuario de la API con el que escriben el bot y este sistema ("Fenix AI").
const USUARIO_SISTEMA = Number(process.env.ODICHAT_USUARIO_SISTEMA || 85);

type Conteo = { plantilla: number; bot: number; humano: number };
type Mensaje = {
  id: number; created_at: number; message_type: number; private?: boolean;
  content_attributes?: { external_echo?: boolean } | null;
  sender?: { id?: number; type?: string } | null;
};

async function odi(ruta: string) {
  const token = process.env.ODICHAT_TOKEN || '';
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(`${ODI}${ruta}`, {
      headers: { api_access_token: token, 'User-Agent': 'marioguerra/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (intento + 1))); continue; }
    if (!r.ok) throw new Error(`odichat ${r.status} en ${ruta}`);
    return r.json();
  }
  throw new Error(`odichat 429 en ${ruta}`);
}

const diaUTC = (segundos: number) => new Date(segundos * 1000).toISOString().slice(0, 10);

/** Mensajes de la API por día, desde `desde` (segundos epoch). */
async function contarChatwoot(desde: number, cuenta: Map<string, Conteo>) {
  // Conversaciones de la bandeja, de la más reciente a la más vieja, hasta
  // pasar la fecha de corte.
  for (let pagina = 1; pagina < 200; pagina++) {
    const d = await odi(`/conversations?inbox_id=${INBOX}&status=all&page=${pagina}`);
    const convs: Array<{ id: number; last_activity_at: number }> = d?.data?.payload ?? [];
    if (!convs.length) break;
    for (const c of convs) {
      if (c.last_activity_at < desde) continue;
      // Los mensajes vienen de a 20, del más nuevo hacia atrás.
      let antes: number | null = null;
      for (let vuelta = 0; vuelta < 100; vuelta++) {
        const r = await odi(`/conversations/${c.id}/messages${antes ? `?before=${antes}` : ''}`);
        const ms: Mensaje[] = r?.payload ?? [];
        if (!ms.length) break;
        for (const m of ms) {
          if (m.created_at < desde || m.message_type !== 1 || m.private) continue;
          if (m.content_attributes?.external_echo) continue; // escrito desde el teléfono
          const dia = diaUTC(m.created_at);
          const fila = cuenta.get(dia) ?? { plantilla: 0, bot: 0, humano: 0 };
          if (m.sender?.id === USUARIO_SISTEMA || m.sender?.type !== 'user') fila.bot++;
          else fila.humano++;
          cuenta.set(dia, fila);
        }
        const masViejo = Math.min(...ms.map((m) => m.created_at));
        if (masViejo < desde || ms.length < 20) break;
        antes = Math.min(...ms.map((m) => m.id));
      }
    }
    if (convs.every((c) => c.last_activity_at < desde)) break;
  }
}

function contarPlantillas(desdeISO: string, cuenta: Map<string, Conteo>) {
  // `fecha` se guarda con datetime('now'): ya está en UTC.
  const filas = db.prepare(
    `SELECT substr(fecha, 1, 10) dia, COUNT(*) n FROM mensajes_enviados
      WHERE estado = 'enviado' AND fecha >= ? GROUP BY 1`
  ).all(desdeISO.replace('T', ' ').slice(0, 19)) as Array<{ dia: string; n: number }>;
  for (const f of filas) {
    const fila = cuenta.get(f.dia) ?? { plantilla: 0, bot: 0, humano: 0 };
    fila.plantilla += f.n;
    cuenta.set(f.dia, fila);
  }
}

/** Recuenta los últimos `dias` días (hoy incluido) y los escribe en el panel. */
export async function reportarUsoMeta(dias = 2) {
  const url = process.env.MEMORIA_SUPABASE_URL;
  const llave = process.env.MEMORIA_SUPABASE_KEY;
  if (!url || !llave || !process.env.ODICHAT_TOKEN) return { ok: false, motivo: 'faltan credenciales' };

  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - (dias - 1)));
  const listaDias: string[] = [];
  for (let d = new Date(inicio); d <= hoy; d.setUTCDate(d.getUTCDate() + 1)) listaDias.push(d.toISOString().slice(0, 10));

  const cuenta = new Map<string, Conteo>();
  contarPlantillas(inicio.toISOString(), cuenta);
  // Si Chatwoot falla a mitad no se escribe nada: un día a medio contar dejaría
  // al cliente cobrado de menos.
  await contarChatwoot(Math.floor(inicio.getTime() / 1000), cuenta);

  const h = { apikey: llave, Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' };
  const borrar = await fetch(
    `${url}/rest/v1/mensajes_enviados?tabla_prefijo=eq.${PREFIJO}&fuente=eq.${FUENTE}&dia=in.(${listaDias.join(',')})`,
    { method: 'DELETE', headers: h, signal: AbortSignal.timeout(20000) }
  );
  if (!borrar.ok) return { ok: false, motivo: `no se pudo limpiar: ${borrar.status}` };

  const filas = listaDias.flatMap((dia) => {
    const c = cuenta.get(dia);
    if (!c) return [];
    return (['plantilla', 'bot', 'humano'] as const)
      .filter((o) => c[o] > 0)
      .map((origen) => ({
        tabla_prefijo: PREFIJO, fuente: FUENTE, dia, origen, canal: 'wa',
        cantidad: c[origen], enviado: true,
        // A mediodía del día: el panel filtra por created_at y así no se corre de mes.
        created_at: `${dia}T12:00:00Z`,
      }));
  });
  if (filas.length) {
    const r = await fetch(`${url}/rest/v1/mensajes_enviados`, {
      method: 'POST', headers: h, body: JSON.stringify(filas), signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { ok: false, motivo: `no se pudo guardar: ${r.status} ${await r.text()}` };
  }
  const total = filas.reduce((a, f) => a + f.cantidad, 0);
  return { ok: true, dias: listaDias.length, total, porDia: Object.fromEntries(cuenta) };
}
