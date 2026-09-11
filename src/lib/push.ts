import 'server-only';
import webpush from 'web-push';
import { db } from './db';

/**
 * Avisos al panel por Web Push. Un aviso llega al teléfono o a la computadora
 * aunque el panel esté cerrado, que es justo lo que hace falta cuando el bot
 * pasa una conversación a una persona.
 *
 * Una suscripción es un navegador, no una persona: la misma recepcionista en el
 * teléfono y en la computadora son dos filas distintas.
 */

type Fila = { id: number; endpoint: string; p256dh: string; auth: string };

function configurado(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@drmarioguerra.com', pub, priv);
  return true;
}

export function clavePublica(): string {
  return process.env.VAPID_PUBLIC_KEY || '';
}

export function guardarSuscripcion(
  s: { endpoint: string; keys: { p256dh: string; auth: string } },
  usuarioId?: number | null,
  dispositivo?: string | null
) {
  db.prepare(
    `INSERT INTO push_suscripciones (endpoint, p256dh, auth, usuario_id, dispositivo)
     VALUES (?,?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET
       p256dh = excluded.p256dh, auth = excluded.auth,
       usuario_id = excluded.usuario_id, dispositivo = excluded.dispositivo`
  ).run(s.endpoint, s.keys.p256dh, s.keys.auth, usuarioId ?? null, dispositivo ?? null);
}

export function borrarSuscripcion(endpoint: string) {
  db.prepare('DELETE FROM push_suscripciones WHERE endpoint = ?').run(endpoint);
}

export function cuantosDispositivos(): number {
  return (db.prepare('SELECT COUNT(*) c FROM push_suscripciones').get() as { c: number }).c;
}

/**
 * Manda el aviso a todos los dispositivos registrados. No lanza nunca: un fallo
 * aquí no puede tumbar una reserva ni el tick del cron. Las suscripciones que el
 * navegador ya dio de baja (404/410) se borran solas.
 */
export async function enviarPush(titulo: string, cuerpo: string, enlace?: string | null) {
  if (!configurado()) return { enviados: 0, borrados: 0 };
  const filas = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_suscripciones').all() as Fila[];
  if (!filas.length) return { enviados: 0, borrados: 0 };

  const carga = JSON.stringify({ titulo, cuerpo, enlace: enlace ?? '/panel' });
  let enviados = 0;
  let borrados = 0;

  await Promise.all(
    filas.map(async (f) => {
      try {
        await webpush.sendNotification(
          { endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } },
          carga,
          { TTL: 60 * 60 * 12, urgency: 'high' }
        );
        db.prepare("UPDATE push_suscripciones SET ultimo_uso = datetime('now') WHERE id = ?").run(f.id);
        enviados++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) {
          db.prepare('DELETE FROM push_suscripciones WHERE id = ?').run(f.id);
          borrados++;
        }
      }
    })
  );
  return { enviados, borrados };
}
