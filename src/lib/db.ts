import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// Una sola conexión por proceso. En dev Next recarga los módulos, así que la
// guardamos en globalThis para no abrir un handle por recarga.
const g = globalThis as unknown as { __mgDb?: Database.Database };

function abrir(): Database.Database {
  const ruta = process.env.DB_PATH || path.join(process.cwd(), 'data', 'marioguerra.db');
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export const db: Database.Database = g.__mgDb ?? (g.__mgDb = abrir());

/** Lee toda la tabla config como objeto. */
export function leerConfig(): Record<string, string> {
  const filas = db.prepare('SELECT clave, valor FROM config').all() as { clave: string; valor: string }[];
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

export function cfg(clave: string, porDefecto = ''): string {
  const f = db.prepare('SELECT valor FROM config WHERE clave = ?').get(clave) as { valor: string } | undefined;
  return f?.valor ?? porDefecto;
}

export function cfgNum(clave: string, porDefecto: number): number {
  const v = Number(cfg(clave, ''));
  return Number.isFinite(v) && cfg(clave, '') !== '' ? v : porDefecto;
}

export function guardarConfig(clave: string, valor: string) {
  db.prepare('INSERT INTO config (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
    .run(clave, valor);
}
