import 'server-only';
import { db } from './db';
import { normalizarTelefono, baseUrl, enviarPlantilla } from './mensajeria';
import { notificar } from './notificaciones';
import { ahoraVET, horaVET, desdeEpochVET, sumarDias, sumarMinutos, soloFecha } from './fechas';

/**
 * Seguimiento de la gente que preguntó por WhatsApp y no agendó.
 *
 * El bot manda el enlace y ahí moría todo. Con pauta corriendo eso es plata
 * tirada: cuatro personas preguntaron en dos días y ninguna reservó.
 *
 * Dos toques y se acabó. El primero siempre dentro de las 24 horas desde el
 * último mensaje de la persona, que es cuando WhatsApp todavía deja escribir
 * texto libre. El segundo casi siempre cae fuera y necesita plantilla, así que
 * por ahora se anota y espera (fase 2).
 */

const ODI = 'https://portal.odichat.app/api/v1/accounts/11';
const TOKEN = process.env.ODICHAT_TOKEN || '';
const INBOX = Number(process.env.ODICHAT_INBOX || 85);

/**
 * Franjas en que se permite escribir, hora de Venezuela: el consultorio pidió
 * el primer toque entre 6 y 8 de la noche y el segundo a las 8 de la mañana.
 * Se dan dos horas de margen porque el tick corre cada quince minutos y un
 * envío que se perdió su franja debe esperar la siguiente, no salir a deshora.
 */
const FRANJAS: Array<[string, string]> = [['18:00', '20:00'], ['08:00', '10:00']];
/** Entre un toque y el siguiente: garantiza que caigan en franjas distintas. */
const HORAS_ENTRE_TOQUES = 8;
/** Nunca se intenta texto libre pegado al límite: un retraso y Meta lo rechaza. */
const MARGEN_HORAS = 22;
/** No se le escribe encima a alguien que acaba de escribir. */
const ESPERA_MINIMA_MIN = 120;
/** Retomar a alguien cinco días después no es seguimiento, es spam. */
const ANTIGUEDAD_MAX_DIAS = 3;

type Lead = {
  id: number; telefono: string; nombre: string | null; conversacion_id: number;
  tema: string | null; ultimo_mensaje_at: string;
  seg1_at: string | null; seg2_at: string | null; estado: string;
};

async function odi(ruta: string) {
  const r = await fetch(`${ODI}${ruta}`, {
    headers: { api_access_token: TOKEN, 'User-Agent': 'marioguerra/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`odichat ${r.status} en ${ruta}`);
  return r.json();
}

/**
 * Los dos momentos en que toca retomar a alguien que escribió por última vez a
 * `ultimo`. Se toma la próxima franja con al menos dos horas de aire, y la
 * siguiente después de esa.
 */
export function momentosSeguimiento(ultimo: string) {
  const desde = sumarMinutos(ultimo, ESPERA_MINIMA_MIN);
  const candidatos: string[] = [];
  for (let d = 0; d <= 3; d++) {
    for (const h of FRANJAS) candidatos.push(`${sumarDias(soloFecha(ultimo), d)} ${h}`);
  }
  const libres = candidatos.filter((c) => c >= desde).sort();
  return { seg1: libres[0], seg2: libres[1] };
}

/** Hasta cuándo se le puede escribir texto libre sin plantilla. */
export function dentroDeVentana(ultimo: string, cuando: string): boolean {
  return cuando <= sumarMinutos(ultimo, MARGEN_HORAS * 60);
}

/** ¿Este teléfono ya tiene una cita viva? Se compara normalizado en los dos lados. */
export function yaAgendo(telefono: string): boolean {
  const t = normalizarTelefono(telefono);
  const filas = db.prepare(
    `SELECT p.whatsapp FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.estado IN ('reservada','confirmada','completada')`
  ).all() as Array<{ whatsapp: string }>;
  return filas.some((f) => normalizarTelefono(f.whatsapp) === t);
}

/**
 * Lo que preguntó, para no retomarlo con un saludo en seco.
 *
 * El catálogo guarda "Mastopexia con implantes", pero la gente escribe
 * "mastopexia" a secas —Patricia lo hizo—, así que también se busca por la
 * primera palabra. Gana la coincidencia más larga.
 */
function detectarTema(textos: string[]): string | null {
  const limpia = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const catalogo = (db.prepare(
    `SELECT nombre FROM procedimientos_catalogo WHERE activo = 1 AND nombre NOT LIKE 'Otro%'`
  ).all() as Array<{ nombre: string }>).map((x) => x.nombre);

  const terminos = new Set<string>();
  for (const nombre of catalogo) {
    terminos.add(limpia(nombre));
    const primera = limpia(nombre).split(' ')[0];
    if (primera.length >= 5) terminos.add(primera);
  }

  const todo = limpia(textos.join(' '));
  const hallados = [...terminos].filter((t) => todo.includes(t));
  if (!hallados.length) return null;
  return hallados.sort((a, b) => b.length - a.length)[0];
}

/** Lee el buzón y anota a los que preguntaron. No escribe nada todavía. */
export async function sincronizarLeads() {
  if (!TOKEN) return { leidas: 0, nuevos: 0, cerrados: 0 };
  const convs = (await odi(`/conversations?inbox_id=${INBOX}&status=all`))?.data?.payload ?? [];
  let nuevos = 0, cerrados = 0;

  for (const c of convs) {
    const contacto = c?.meta?.sender ?? {};
    const tel = normalizarTelefono(contacto.phone_number || '');
    if (!tel) continue;

    const ms = (await odi(`/conversations/${c.id}/messages`))?.payload ?? [];
    const entrantes = ms.filter((m: Record<string, unknown>) => m.message_type === 0);
    if (!entrantes.length) continue;

    // Si una persona del consultorio entró a la conversación, el bot no se mete.
    const humano = ms.some((m: Record<string, unknown>) =>
      m.message_type === 1 &&
      Boolean((m.content_attributes as Record<string, unknown> | undefined)?.external_echo));

    const ultimo = desdeEpochVET(
      Math.max(...entrantes.map((m: Record<string, number>) => m.created_at ?? 0))
    );
    const textos = entrantes
      .map((m: Record<string, string>) => (m.content || '').trim())
      .filter(Boolean);
    const tema = detectarTema(textos);

    // Al número le caen códigos de verificación de Instagram y Meta. No son
    // pacientes: escribirles gasta plata y le baja la calidad al número.
    const soloCodigos = textos.length > 0 && textos.every((t: string) =>
      /c[oó]digo de (instagram|facebook|whatsapp)|no lo compartas|verification code/i.test(t));

    const previo = db.prepare('SELECT * FROM leads_wa WHERE telefono = ?').get(tel) as Lead | undefined;

    let estado = 'abierto';
    if (soloCodigos) estado = 'agotado';
    else if (humano) estado = 'humano';
    else if (yaAgendo(tel)) estado = 'agendo';
    // Si volvió a escribir después de que le mandamos el primer toque, contestó.
    else if (previo?.seg1_at && ultimo > previo.seg1_at) estado = 'respondio';
    else if (previo?.seg2_at) estado = 'agotado';
    else if (previo) estado = previo.estado === 'abierto' ? 'abierto' : previo.estado;

    if (!previo) {
      db.prepare(
        `INSERT INTO leads_wa (telefono, nombre, conversacion_id, tema, ultimo_mensaje_at, estado)
         VALUES (?,?,?,?,?,?)`
      ).run(tel, contacto.name ?? null, c.id, tema, ultimo, estado);
      nuevos++;
    } else {
      db.prepare(
        `UPDATE leads_wa SET nombre = ?, conversacion_id = ?, tema = COALESCE(?, tema),
                             ultimo_mensaje_at = ?, estado = ?
          WHERE id = ?`
      ).run(contacto.name ?? previo.nombre, c.id, tema, ultimo, estado, previo.id);
      if (estado !== 'abierto' && previo.estado === 'abierto') cerrados++;
    }
  }
  return { leidas: convs.length, nuevos, cerrados };
}

/**
 * El nombre de WhatsApp es lo que la persona escribió en su perfil, no su
 * nombre: salían saludos como "Hola la," (de "la bendición de Dios"), "Hola
 * 🙌🏼🩷🌸," o "Hola +584128203166,". Solo se usa si parece un nombre de verdad;
 * si no, se saluda sin nombre, que es mejor que saludar raro.
 */
const NO_SON_NOMBRES = new Set([
  'la', 'el', 'los', 'las', 'de', 'del', 'mi', 'tu', 'su', 'un', 'una', 'yo', 'soy',
  'dios', 'bendicion', 'bendiciones', 'amor', 'mama', 'papa', 'hola', 'bella', 'reina',
  'princesa', 'negra', 'negrita', 'flaca', 'gorda', 'bebe', 'baby', 'sra', 'sr', 'dra', 'dr',
]);
export function primerNombre(crudo: string | null): string {
  const palabra = (crudo || '').trim().split(/\s+/)[0] ?? '';
  if (/\d/.test(palabra)) return '';                       // un teléfono o un usuario
  // Los emojis pegados al nombre ("Merlyn❤") se quitan; lo que queda tiene que ser letras.
  const letras = palabra.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letras.length < 3) return '';
  // Todo en minúscula y largo es un usuario ("neydamolerob"), no un nombre.
  if (letras === letras.toLowerCase() && letras.length > 10) return '';
  const base = letras.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (NO_SON_NOMBRES.has(base)) return '';
  return letras.charAt(0).toUpperCase() + letras.slice(1).toLowerCase();
}

function textoSeguimiento(l: Lead, toque: number): string {
  if (toque === 2) return textoSegundoToque(l);
  const link = `${baseUrl()}/reservar`;
  const nombre = primerNombre(l.nombre);
  const hola = nombre ? `Hola ${nombre}, ` : 'Hola, ';
  const fuera = !l.telefono.startsWith('58');
  const online = fuera
    ? ' Si estas fuera de Venezuela, la valoracion tambien se puede hacer por videollamada.'
    : '';
  if (l.tema) {
    return `${hola}soy Mayelis, la asistente del Dr. Mario Guerra. Quede pendiente de lo que me `
      + `preguntaste sobre ${l.tema.toLowerCase()}. El doctor lo evalua en la valoracion y ahi mismo `
      + `te dice que aplica en tu caso y cuanto seria.${online} Si quieres avanzar, aqui escoges el `
      + `dia y la hora que te sirva: ${link}\n\nY si te quedo alguna duda, escribeme por aqui y te ayudo.`;
  }
  return `${hola}soy Mayelis, la asistente del Dr. Mario Guerra. Me quede con la duda de si pude `
    + `ayudarte con lo que buscabas.${online} Si me dices que procedimiento te interesa, te explico `
    + `por aqui. Y si prefieres que el doctor te evalue, aqui escoges dia y hora: ${link}`;
}

/**
 * El segundo y último. Recibir dos veces el mismo mensaje se lee como un bot
 * roto, así que este cierra en vez de repetir, y dice que no se insiste más.
 */
function textoSegundoToque(l: Lead): string {
  const link = `${baseUrl()}/reservar`;
  const nombre = primerNombre(l.nombre);
  const inicio = nombre ? `${nombre}, no` : 'No';
  return `${inicio} te escribo mas para no molestarte. Te dejo el enlace por si en algun `
    + `momento quieres que el doctor te evalue: ${link}\n\nY si prefieres preguntarme algo `
    + `antes de decidir, escribeme cuando quieras y con gusto te ayudo.`;
}

async function escribirEnChatwoot(conversacionId: number, texto: string) {
  const r = await fetch(`${ODI}/conversations/${conversacionId}/messages`, {
    method: 'POST',
    headers: { api_access_token: TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: texto, message_type: 'outgoing' }),
    signal: AbortSignal.timeout(20000),
  });
  return r.ok;
}

/** Manda los seguimientos que toquen. Se llama desde el tick de cada 15 minutos. */
export async function correrSeguimientos() {
  const ahora = ahoraVET();
  const reporte = { seg1: 0, seg2: 0, esperanPlantilla: 0 };
  if (!TOKEN) return reporte;

  // Fuera de las franjas no se escribe. Así un mensaje que se perdió su hora
  // espera a la siguiente en vez de salir a las tres de la tarde.
  const hora = horaVET();
  if (!FRANJAS.some(([a, b]) => hora >= a && hora < b)) return reporte;

  const leads = db.prepare(`SELECT * FROM leads_wa WHERE estado = 'abierto'`).all() as Lead[];

  for (const l of leads) {
    // Se vuelve a preguntar JUSTO ANTES de escribir: alguien pudo agendar a las
    // 5 y el toque estaba programado para las 6.
    if (yaAgendo(l.telefono)) {
      db.prepare("UPDATE leads_wa SET estado = 'agendo' WHERE id = ?").run(l.id);
      continue;
    }
    // Retomar a alguien de hace cinco días no es seguimiento, es spam.
    if (l.ultimo_mensaje_at < sumarDias(soloFecha(ahora), -ANTIGUEDAD_MAX_DIAS)) {
      db.prepare("UPDATE leads_wa SET estado = 'agotado' WHERE id = ?").run(l.id);
      continue;
    }
    // Nada de escribirle encima a quien acaba de hablar.
    if (ahora < sumarMinutos(l.ultimo_mensaje_at, ESPERA_MINIMA_MIN)) continue;

    // El segundo toque nunca el mismo día que el primero. A quien escribió de
    // madrugada le caían los dos en diez horas, que se lee como acoso.
    const segundoToca = !l.seg2_at
      && ahora >= sumarMinutos(l.seg1_at ?? ahora, HORAS_ENTRE_TOQUES * 60)
      && soloFecha(ahora) > soloFecha(l.seg1_at ?? ahora);
    const toque = !l.seg1_at ? 1 : segundoToca ? 2 : 0;
    if (!toque) continue;

    const enviado = await mandarToque(l, ahora, toque);
    if (enviado === 'sin_via') { reporte.esperanPlantilla++; continue; }
    if (!enviado) continue;

    if (toque === 1) {
      db.prepare('UPDATE leads_wa SET seg1_at = ? WHERE id = ?').run(ahora, l.id);
      reporte.seg1++;
    } else {
      db.prepare("UPDATE leads_wa SET seg2_at = ?, estado = 'agotado' WHERE id = ?").run(ahora, l.id);
      reporte.seg2++;
    }
  }

  if (reporte.seg1 || reporte.seg2) {
    notificar('seguimiento', `Seguimiento enviado a ${reporte.seg1 + reporte.seg2} persona(s) que no agendaron.`, '/panel');
  }
  return reporte;
}

/**
 * Dentro de las 24 horas se escribe texto libre, que es gratis y suena a
 * persona. Fuera, WhatsApp solo admite plantilla aprobada.
 */
async function mandarToque(l: Lead, ahora: string, toque: number): Promise<boolean | 'sin_via'> {
  if (dentroDeVentana(l.ultimo_mensaje_at, ahora)) {
    return escribirEnChatwoot(l.conversacion_id, textoSeguimiento(l, toque));
  }
  const plantilla = db.prepare(
    `SELECT activa, meta_template_name FROM plantillas_mensajes WHERE clave = 'seguimiento'`
  ).get() as { activa: number; meta_template_name: string | null } | undefined;
  if (!plantilla?.activa || !plantilla.meta_template_name) return 'sin_via';

  const tema = l.tema || 'lo que nos consultaste';
  const ok = await enviarPlantilla({
    clave: 'seguimiento',
    destino: l.telefono,
    variables: {
      nombre: primerNombre(l.nombre) || 'de nuevo',
      // La plantilla lleva el tema en el medio de la frase: si no lo detectamos,
      // se pone algo que encaje en la oración y no quede un hueco.
      tema,
      link: `${baseUrl()}/reservar`,
    },
  });

  // La plantilla sale por la API de Meta y no pasa por el buzón, así que en el
  // panel la conversación se ve muerta mientras al paciente ya le escribimos.
  // Queda como nota interna: no se le reenvía nada, pero el consultorio lo ve.
  if (ok) {
    await fetch(`${ODI}/conversations/${l.conversacion_id}/messages`, {
      method: 'POST',
      headers: { api_access_token: TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `Se le envió el seguimiento automático por plantilla (tema: ${tema}).`,
        message_type: 'outgoing',
        private: true,
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => { /* que falle la nota no invalida el envío */ });
  }
  return ok;
}

/** Para saber si esto sirve, en vez de opinar dentro de una semana. */
export function metricasLeads() {
  const f = db.prepare(
    `SELECT COUNT(*) total,
            SUM(estado = 'agendo')    agendaron,
            SUM(estado = 'respondio') respondieron,
            SUM(estado = 'agotado')   agotados,
            SUM(estado = 'humano')    humano,
            SUM(estado = 'abierto')   abiertos,
            SUM(seg1_at IS NOT NULL)  con_seg1,
            SUM(seg2_at IS NOT NULL)  con_seg2
       FROM leads_wa`
  ).get() as Record<string, number>;
  return f;
}
