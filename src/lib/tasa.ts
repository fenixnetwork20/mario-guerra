import 'server-only';
import { db, cfg } from './db';

/**
 * La tasa con la que se muestra el precio en bolívares.
 *
 * Sale del mismo sheet central que usan los otros clientes —N8N lo publica cada
 * hora en punto— y se cachea hasta las hh:05 siguientes, que es cuando ya está
 * el valor nuevo con margen. Si el sheet no responde se usa el último valor
 * bueno, y si tampoco hay, la tasa manual de Configuración.
 *
 * Al paciente NUNCA se le dice de dónde sale: en pantalla es "la tasa del día".
 */
const SHEET = '1inNV6mihzV4lcNtvDCjEDzSf_kpmzm5Fw9NRpmcrALk';
const GID_PARALELO = '1090092221';

export type Tasa = { valor: number; fuente: 'en linea' | 'guardada' | 'manual'; fecha: string };

function guardar(valor: number) {
  db.prepare("INSERT INTO config (clave,valor) VALUES ('tasa_cache',?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor")
    .run(String(valor));
  db.prepare("INSERT INTO config (clave,valor) VALUES ('tasa_cache_at',datetime('now')) ON CONFLICT(clave) DO UPDATE SET valor=datetime('now')")
    .run();
}

/** El caché vale hasta las hh:05 de la hora siguiente a cuando se guardó. */
function cacheVigente(): number | null {
  const at = cfg('tasa_cache_at', '');
  const v = Number(cfg('tasa_cache', ''));
  if (!at || !v) return null;
  const guardadoMs = Date.parse(at.replace(' ', 'T') + 'Z');
  const vence = new Date(guardadoMs);
  vence.setUTCHours(vence.getUTCHours() + 1, 5, 0, 0);
  return Date.now() < vence.getTime() ? v : null;
}

export async function tasaDelDia(): Promise<Tasa> {
  const manual = Number(cfg('tasa_manual', ''));
  const enCache = cacheVigente();
  if (enCache) return { valor: enCache, fuente: 'guardada', fecha: cfg('tasa_cache_at', '') };

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&gid=${GID_PARALELO}`;
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const csv = await r.text();
    // La fila 2 trae la fecha y la tasa. Ojo: la fecha lleva comas dentro de
    // las comillas ("lunes, 14 de septiembre..."), así que partir por coma
    // rompe la línea. Se sacan los campos entrecomillados y se toma el último.
    const fila = csv.split('\n')[1] || '';
    const campos = [...fila.matchAll(/"([^"]*)"/g)].map((m) => m[1].trim());
    const valor = aNumero(campos[campos.length - 1] ?? '');
    if (valor > 0) {
      guardar(valor);
      return { valor, fuente: 'en linea', fecha: new Date().toISOString() };
    }
  } catch { /* se cae al último valor bueno */ }

  const viejo = Number(cfg('tasa_cache', ''));
  if (viejo > 0) return { valor: viejo, fuente: 'guardada', fecha: cfg('tasa_cache_at', '') };
  if (manual > 0) return { valor: manual, fuente: 'manual', fecha: '' };
  return { valor: 0, fuente: 'manual', fecha: '' };
}

/**
 * El sheet publica la tasa a veces como "955", a veces como "958.68" y a veces
 * como "1.234,56". Borrar los puntos a ciegas convirtió 958.68 en 95868 y el
 * paciente vio un monto cien veces mayor. La regla: manda el ÚLTIMO separador,
 * que es siempre el decimal; lo que quede antes son miles.
 */
export function aNumero(crudo: string): number {
  const t = crudo.trim().replace(/[^\d.,]/g, '');
  if (!t) return 0;
  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');
  const corte = Math.max(coma, punto);
  if (corte === -1) return Number(t);
  const entero = t.slice(0, corte).replace(/[.,]/g, '');
  const decimal = t.slice(corte + 1);
  // Tres dígitos después del separador y sin otro separador antes: son miles
  // ("1.500" son mil quinientos, no uno coma cinco).
  if (decimal.length === 3 && !/[.,]/.test(t.slice(0, corte))) return Number(entero + decimal);
  return Number(`${entero}.${decimal}`);
}

/** 50 USD a 963,9 → "48.195,00 Bs". Sin decimales de más: son bolívares. */
export function enBolivares(usd: number, tasa: number): string {
  return (usd * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
