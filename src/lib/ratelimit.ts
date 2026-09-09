import 'server-only';
import { db } from './db';

/**
 * Límite por ventana de tiempo, guardado en SQLite (un solo proceso PM2).
 * Devuelve true si la petición se permite.
 */
export function permitido(clave: string, maximo: number, ventanaSegundos: number): boolean {
  const ventana = Math.floor(Date.now() / 1000 / ventanaSegundos);
  const id = `${clave}:${ventana}`;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO rate_limit (clave, contador, ventana) VALUES (?, 1, ?)
       ON CONFLICT(clave) DO UPDATE SET contador = contador + 1`
    ).run(id, ventana);
    return (db.prepare('SELECT contador FROM rate_limit WHERE clave = ?').get(id) as { contador: number }).contador;
  });
  const n = tx();
  // Limpieza barata de ventanas viejas.
  if (n === 1) db.prepare('DELETE FROM rate_limit WHERE ventana < ?').run(ventana - 2);
  return n <= maximo;
}

export function ipDe(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'desconocida'
  );
}
