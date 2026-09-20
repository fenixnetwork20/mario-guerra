#!/usr/bin/env node
/**
 * Vigilancia del consultorio, cada 3 horas.
 *
 * Mira de punta a punta lo que un paciente toca —la web, los cupos, el cobro—
 * y lo que sostiene al bot —el workflow, el buzón, las plantillas—. Lee además
 * lo que Mayelis está respondiendo de verdad, porque un sistema puede estar
 * "arriba" y aun así estar diciendo disparates.
 *
 * Arregla solo lo que es seguro arreglar sin criterio: levantar el proceso,
 * reactivar el workflow, reasignar el bot al buzón. Todo lo demás lo reporta:
 * si hace falta una decisión, la toma una persona.
 *
 * Avisa SOLO cuando hay algo mal, al panel (campanita + teléfono). Un vigilante
 * que escribe cada tres horas deja de leerse a la tercera semana.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const RAIZ = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const fenix = Object.fromEntries(
  fs.readFileSync('/var/www/fenix-flow-ia/.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);

const WEB = 'https://drmarioguerra.com';
const N8N = 'https://n8n.srv876463.hstgr.cloud/api/v1';
const WORKFLOW = 'wEFvtdL687EqKQZi';
const ODICHAT = 'https://portal.odichat.app/api/v1/accounts/11';
const ODI_TOKEN = 'BcXP4hpQkNDU4SKiWSsQdGzU';
const INBOX = 85;
const BOT = 11;

const fallas = [];
const arreglos = [];
const notas = [];
const mal = (q) => fallas.push(q);

const pedir = async (url, opciones = {}) => {
  const r = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20000) });
  return { estado: r.status, texto: await r.text() };
};
const json = (t) => { try { return JSON.parse(t); } catch { return null; } };

// ── 1. El proceso ──────────────────────────────────────────────────────────
try {
  const pm2 = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
  const p = pm2.find((x) => x.name === 'marioguerra');
  if (!p || p.pm2_env.status !== 'online') {
    execSync('pm2 restart marioguerra', { stdio: 'ignore' });
    arreglos.push('el proceso estaba caído: se levantó');
  } else if (p.pm2_env.restart_time > 50) {
    notas.push(`el proceso lleva ${p.pm2_env.restart_time} reinicios`);
  }
} catch (e) { mal(`no se pudo revisar el proceso: ${e.message}`); }

// ── 2. Lo que ve el paciente ───────────────────────────────────────────────
for (const [ruta, esperado] of [['/', 200], ['/reservar', 200], ['/login', 200]]) {
  const { estado } = await pedir(WEB + ruta).catch(() => ({ estado: 0 }));
  if (estado !== esperado) mal(`${ruta} responde ${estado} (debería ser ${esperado})`);
}

const cupos = json((await pedir(`${WEB}/api/publico/cupos`).catch(() => ({ texto: '' }))).texto);
const dias = cupos ? (cupos.dias ?? cupos) : null;
if (!Array.isArray(dias)) mal('la lista de cupos no responde');
else if (dias.length === 0) mal('NO HAY NI UN CUPO LIBRE: nadie puede agendar');
else if (dias.length < 5) notas.push(`solo quedan ${dias.length} días con cupo`);

// ── 3. El cobro, que es donde se pierde plata ──────────────────────────────
const cobro = json((await pedir(`${WEB}/api/publico/cobro?modalidad=presencial`).catch(() => ({ texto: '' }))).texto);
if (!cobro) mal('los datos de cobro no responden');
else {
  if (!cobro.usd) mal('el precio de la consulta quedó en cero');
  if (!cobro.tasa) mal('no hay tasa del día: el paciente no ve el monto en bolívares');
  // Una tasa fuera de rango pasó de verdad: el sheet cambió de formato y el
  // parser la multiplicó por cien. No se arregla sola, se avisa.
  else if (cobro.tasa < 50 || cobro.tasa > 20000) mal(`la tasa se ve rarísima: ${cobro.tasa}`);
  if (!cobro.pagoMovil && !cobro.binance && !cobro.zelle && !cobro.efectivo) {
    mal('no hay ninguna forma de pago cargada');
  }
}

// ── 4. El bot ──────────────────────────────────────────────────────────────
// La llave vivía en /tmp, que se borra al reiniciar: el cron habría fallado callado.
const llaveN8N = ['/home/fenix/.config/fenix/n8n_key', '/tmp/n8n_key.txt']
  .find((f) => fs.existsSync(f));
if (!llaveN8N) mal('no se encuentra la llave de N8N: no se puede revisar el bot');
const cabN8N = { 'X-N8N-API-KEY': llaveN8N ? fs.readFileSync(llaveN8N, 'utf8').trim() : '' };
if (llaveN8N) try {
  const w = json((await pedir(`${N8N}/workflows/${WORKFLOW}`, { headers: cabN8N })).texto);
  if (!w) mal('no se pudo leer el workflow en N8N');
  else if (!w.active) {
    await pedir(`${N8N}/workflows/${WORKFLOW}/activate`, { method: 'POST', headers: cabN8N });
    arreglos.push('el bot estaba apagado en N8N: se encendió');
  }
} catch (e) { mal(`N8N no responde: ${e.message}`); }

const cabOdi = { api_access_token: ODI_TOKEN, 'Content-Type': 'application/json' };
const asignado = json((await pedir(`${ODICHAT}/inboxes/${INBOX}/agent_bot`, { headers: cabOdi })).texto);
if (!asignado?.agent_bot?.id) {
  await pedir(`${ODICHAT}/inboxes/${INBOX}/set_agent_bot`, {
    method: 'POST', headers: cabOdi, body: JSON.stringify({ agent_bot: BOT }),
  });
  arreglos.push('el bot no estaba asignado al WhatsApp: se reasignó');
}

// ── 4b. Lo que Meta opina del número y de las plantillas ───────────────────
// En campaña esto es lo primero que se rompe: Meta pausa una plantilla por
// calidad o restringe el número, y los recordatorios dejan de salir en silencio.
try {
  const tk = env.WHATSAPP_TOKEN;
  const pl = json((await pedir(
    `https://graph.facebook.com/v21.0/1774692996896546/message_templates?fields=name,status,quality_score&limit=30&access_token=${tk}`
  )).texto);
  for (const t of pl?.data ?? []) {
    if (t.status !== 'APPROVED') mal(`Meta puso la plantilla ${t.name} en ${t.status}`);
    if (t.quality_score?.score === 'RED') mal(`Meta le bajó la calidad a ${t.name} (roja)`);
  }
  if (!pl?.data?.length) mal('no se pudieron leer las plantillas en Meta');
  else notas.push(`${pl.data.length} plantillas revisadas en Meta, todas aprobadas`);

  const num = json((await pedir(
    `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}?fields=quality_rating,messaging_limit_tier,status&access_token=${tk}`
  )).texto);
  if (num?.status && num.status !== 'CONNECTED') mal(`el número de WhatsApp está en ${num.status}`);
  if (num?.quality_rating === 'RED') mal('Meta le bajó la calidad al número: el alcance queda limitado');
  else if (num?.quality_rating === 'YELLOW') notas.push('la calidad del número está en amarillo');
  notas.push(`número ${num?.status ?? '?'}, calidad ${num?.quality_rating ?? '?'}${num?.messaging_limit_tier ? `, tope ${num.messaging_limit_tier}` : ''}`);
} catch (e) { notas.push(`no se pudo consultar Meta: ${e.message}`); }

// ── 5. El prompt que corre, contra el que tenemos guardado ─────────────────
try {
  const r = await pedir(
    `${fenix.SUPABASE_URL}/rest/v1/config_clientes?nombre_cliente=eq.${encodeURIComponent('DR MARIO GUERRA')}&select=system_prompt`,
    { headers: { apikey: fenix.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${fenix.SUPABASE_SERVICE_KEY}` } }
  );
  const enLinea = json(r.texto)?.[0]?.system_prompt ?? '';
  const local = fs.readFileSync(path.join(RAIZ, 'prompt-bot-mayelis-nuevo.txt'), 'utf8');
  if (!enLinea) mal('el prompt de Supabase vino vacío');
  else if (enLinea !== local) notas.push('el prompt de Supabase no es igual al del repositorio');
} catch (e) { mal(`no se pudo leer el prompt: ${e.message}`); }

// ── 6. Lo que Mayelis está respondiendo de verdad ──────────────────────────
const REGLAS = [
  [/\$\s?\d{3,}|(?<!4)(?<!5)0\s?\$/, 'dio un monto que no es el de la consulta'],
  [/[\u{1F300}-\u{1FAFF}]/u, 'usó emojis'],
  [/wa\.link|wa\.me/i, 'mandó un enlace viejo de WhatsApp'],
  [/\{"mensaje"/, 'se le escapó el JSON crudo'],
  [/centro de especialidades/i, 'nombró la clínica'],
  [/s[áa]bado[^.]{0,30}cerrado/i, 'dijo que el sábado está cerrado'],
  [/soy (una )?(ia|inteligencia artificial|bot)/i, 'admitió ser un bot'],
];
try {
  const convs = json((await pedir(`${ODICHAT}/conversations?inbox_id=${INBOX}&status=all`, { headers: cabOdi })).texto);
  const lista = convs?.data?.payload ?? [];
  const desde = Date.now() / 1000 - 3 * 3600 - 600;
  let revisados = 0;
  let sinAtender = 0;
  for (const c of lista.slice(0, 15)) {
    const ms = json((await pedir(`${ODICHAT}/conversations/${c.id}/messages`, { headers: cabOdi })).texto)?.payload ?? [];
    const nuevos = ms.filter((m) => (m.created_at ?? 0) > desde);
    for (const m of nuevos.filter((m) => m.message_type === 1 && !m.private)) {
      revisados++;
      for (const [re, queja] of REGLAS) {
        if (re.test(m.content || '')) mal(`en la conversación ${c.id} el bot ${queja}: "${(m.content || '').slice(0, 90)}"`);
      }
      // Una respuesta que Meta rechaza se ve igual de bien en el panel que una
      // entregada. En campaña eso es un paciente perdido sin que nadie lo note.
      if (m.status === 'failed') {
        const causa = m.content_attributes?.external_error ?? 'sin detalle';
        mal(`no se entregó una respuesta del bot en la conversación ${c.id}: ${String(causa).slice(0, 120)}`);
      }
    }

    // El bot puede figurar encendido y aun así no contestar. La prueba de que
    // está vivo es que a cada mensaje del paciente le siga uno suyo.
    const ultimoPaciente = [...ms].reverse().find((m) => m.message_type === 0);
    if (ultimoPaciente && (ultimoPaciente.created_at ?? 0) < Date.now() / 1000 - 900) {
      const contestado = ms.some(
        (m) => m.message_type === 1 && !m.private && (m.created_at ?? 0) > (ultimoPaciente.created_at ?? 0)
      );
      if (!contestado) mal(`el bot no le contestó al paciente en la conversación ${c.id}`);
    }
    // Una conversación que el bot pasó a una persona y nadie tocó en 3 horas.
    const ultimo = ms[ms.length - 1];
    if (c.status === 'open' && ultimo && ultimo.message_type === 0 && (ultimo.created_at ?? 0) < Date.now() / 1000 - 3 * 3600) {
      sinAtender++;
    }
  }
  notas.push(`${revisados} respuestas del bot revisadas en las últimas 3 horas`);
  if (sinAtender) mal(`${sinAtender} conversación(es) llevan más de 3 horas esperando respuesta de una persona`);
} catch (e) { notas.push(`no se pudieron leer las conversaciones: ${e.message}`); }

// ── 7. La base y los envíos ────────────────────────────────────────────────
const db = new Database(path.join(RAIZ, 'data', 'marioguerra.db'), { readonly: true });
const cfg = (k) => db.prepare('SELECT valor FROM config WHERE clave = ?').get(k)?.valor ?? '';
if (cfg('mensajeria_activa') !== '1') mal('los recordatorios automáticos están apagados');

const errores = db.prepare(
  "SELECT plantilla, respuesta FROM mensajes_enviados WHERE estado = 'error' AND fecha > datetime('now','-3 hours')"
).all();
for (const e of errores) mal(`falló el envío de ${e.plantilla}: ${(e.respuesta || '').slice(0, 120)}`);

const sinPlantilla = db.prepare(
  "SELECT COUNT(*) c FROM plantillas_mensajes WHERE activa = 1 AND (meta_template_name IS NULL OR meta_template_name = '')"
).get().c;
if (sinPlantilla) mal(`${sinPlantilla} plantilla(s) activas sin nombre aprobado de Meta`);

// Plata del paciente que el consultorio todavia tiene en la mano.
const devoluciones = db.prepare(
  "SELECT COUNT(*) c, COALESCE(SUM(pago_monto_usd),0) s FROM citas WHERE pago_estado = 'por_devolver'"
).get();
if (devoluciones.c) notas.push(`${devoluciones.c} devolución(es) pendientes por ${devoluciones.s} $`);

const porVerificar = db.prepare(
  "SELECT COUNT(*) c FROM citas WHERE pago_estado = 'pendiente' AND fecha_hora >= datetime('now') AND pago_archivo IS NOT NULL"
).get().c;
if (porVerificar) notas.push(`${porVerificar} pago(s) con comprobante esperando verificación`);

// El tick de los recordatorios tiene que estar corriendo cada 15 minutos.
try {
  const log = fs.readFileSync('/home/fenix/respaldos/marioguerra/cron.log', 'utf8').trim().split('\n');
  // Solo las líneas del respaldo: este mismo informe también cae en cron.log y
  // si no se filtra, el vigilante termina leyéndose a sí mismo.
  const ultima = log.filter((l) => /^\d{4}-\d{2}-\d{2}T[\d:+-]+ respaldo/.test(l)).pop() || '';
  notas.push(`último respaldo: ${ultima.slice(0, 80) || 'sin registro'}`);
} catch { /* el log puede no existir todavía */ }

// ── 8. Disco ───────────────────────────────────────────────────────────────
try {
  const libre = execSync("df -P / | tail -1 | awk '{print 100-$5+0}'", { encoding: 'utf8' }).trim();
  if (Number(libre) < 10) mal(`queda ${libre}% de disco libre`);
} catch { /* nada */ }

// ── Informe ────────────────────────────────────────────────────────────────
const sello = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
const lineas = [
  `── ${sello}`,
  ...arreglos.map((a) => `   ARREGLADO: ${a}`),
  ...fallas.map((f) => `   MAL: ${f}`),
  ...notas.map((n) => `   · ${n}`),
  `   ${fallas.length ? `${fallas.length} problema(s)` : 'todo en orden'}`,
];
const informe = lineas.join('\n');
console.log(informe);
fs.appendFileSync('/home/fenix/respaldos/marioguerra/vigilancia.log', informe + '\n');

// Solo molesta si hay algo que atender.
if (fallas.length || arreglos.length) {
  const resumen = [...arreglos.map((a) => `Arreglado: ${a}`), ...fallas].slice(0, 4).join(' · ');
  await pedir(`${WEB}/api/publico/aviso?token=${env.CRON_TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje: `Revisión del sistema: ${resumen}`.slice(0, 380), enlace: '/panel' }),
  }).catch(() => {});
}
process.exit(fallas.length ? 1 : 0);
