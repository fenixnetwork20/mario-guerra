import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { cfg, cfgNum } from './db';

/**
 * Lo que el bot de WhatsApp (n8n) tiene que saber del sistema y que cambia
 * desde el panel: los datos de pago y si hay video del doctor sobre precios.
 *
 * Va como un bloque marcado dentro de config_clientes.system_prompt (Supabase),
 * que es lo único que n8n le pasa al modelo. Antes los datos de pago no se
 * daban por chat y el paciente tenía que llegar al último paso de la reserva
 * para verlos; el doctor pidió que se los den por mensaje. Escritos a mano en
 * el prompt se quedaban viejos al cambiar la cuenta en Configuración (pasó con
 * Zelle), así que se reescriben solos cada vez que se guarda.
 */
const INICIO = '=== DATOS QUE ESCRIBE EL SISTEMA (no editar a mano: salen de Configuración) ===';
const FIN = '=== FIN DE LOS DATOS DEL SISTEMA ===';
const PREFIJO = 'dr_mario_guerra';

export const carpetaUploads = () => process.env.UPLOADS_PATH || path.join(process.cwd(), 'data', 'uploads');

/** Archivo del video de precios, si está cargado y existe en disco. */
export function videoPrecios(): string | null {
  const nombre = cfg('video_precios', '');
  if (!nombre) return null;
  const ruta = path.join(carpetaUploads(), path.basename(nombre));
  return fs.existsSync(ruta) ? ruta : null;
}

export function bloqueDatosBot(): string {
  const l: string[] = [INICIO, '', 'DATOS DE PAGO DE LA CONSULTA. Son los unicos que existen: copialos tal cual, sin cambiar un digito, y no agregues titulares ni bancos que no esten aqui.'];
  const pm = [cfg('pm_banco', ''), cfg('pm_telefono', '') && `telefono ${cfg('pm_telefono', '')}`,
    cfg('pm_cedula', '') && `cedula ${cfg('pm_cedula', '')}`, cfg('pm_titular', '') && `a nombre de ${cfg('pm_titular', '')}`].filter(Boolean);
  if (cfg('pm_telefono', '')) l.push(`Pago movil: ${pm.join(', ')}`);
  if (cfg('zelle_correo', '')) l.push(`Zelle: ${cfg('zelle_correo', '')}${cfg('zelle_titular', '') ? `, a nombre de ${cfg('zelle_titular', '')}` : ''}`);
  if (cfg('binance_usuario', '')) l.push(`Binance: ID ${cfg('binance_usuario', '')}`);
  if (cfg('efectivo_activo', '0') === '1') l.push('Efectivo: en el consultorio el dia de la cita, solo para la consulta presencial.');
  const formas = l.slice(3);
  l.push('', 'Asi se lo escribes cuando pregunta como se paga (si pregunta por una sola forma, das solo esa):',
    'Puedes pagar por cualquiera de estas:',
    ...formas.filter((f) => !f.startsWith('Efectivo')),
    ...(cfg('efectivo_activo', '0') === '1' ? ['O en efectivo en el consultorio el dia de la cita, si es presencial.'] : []),
    '', 'Al reservar en la pagina pones la referencia y subes la captura.', '');
  l.push(`Monto: ${cfgNum('precio_consulta_presencial', 0)}$ la presencial y ${cfgNum('precio_consulta_online', 0)}$ la online. En bolivares es a la tasa del dia: el monto exacto en Bs se lo muestra la pagina al reservar, tu no lo calcules.`);
  l.push('', `VIDEO DEL DOCTOR SOBRE PRECIOS: ${videoPrecios() ? 'DISPONIBLE' : 'NO DISPONIBLE'}`, '', FIN);
  return l.join('\n');
}

/** Reemplaza (o agrega al final) el bloque dentro de un prompt. */
export function conBloque(prompt: string, bloque = bloqueDatosBot()): string {
  const i = prompt.indexOf(INICIO);
  const j = prompt.indexOf(FIN);
  if (i >= 0 && j > i) return prompt.slice(0, i) + bloque + prompt.slice(j + FIN.length);
  return `${prompt.trimEnd()}\n\n${bloque}\n`;
}

/** Reescribe el bloque en el prompt que usa el bot. No toca nada más del prompt. */
export async function sincronizarBot(): Promise<{ ok: boolean; motivo?: string }> {
  const url = process.env.MEMORIA_SUPABASE_URL;
  const llave = process.env.MEMORIA_SUPABASE_KEY;
  if (!url || !llave) return { ok: false, motivo: 'faltan credenciales' };
  const h = { apikey: llave, Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' };
  const fila = `${url}/rest/v1/config_clientes?tabla_prefijo=eq.${PREFIJO}`;
  const r = await fetch(`${fila}&select=system_prompt`, { headers: h, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { ok: false, motivo: `lectura ${r.status}` };
  const actual = ((await r.json()) as Array<{ system_prompt: string }>)[0]?.system_prompt;
  // Sin prompt no se escribe: un bloque solo, sin el resto, dejaría al bot mudo.
  if (!actual || actual.length < 1000) return { ok: false, motivo: 'prompt vacío' };
  const nuevo = conBloque(actual);
  if (nuevo === actual) return { ok: true };
  const w = await fetch(fila, {
    method: 'PATCH', headers: h, body: JSON.stringify({ system_prompt: nuevo }), signal: AbortSignal.timeout(15000),
  });
  return w.ok ? { ok: true } : { ok: false, motivo: `escritura ${w.status}` };
}
