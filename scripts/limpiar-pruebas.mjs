// Borra TODOS los datos de operación (pacientes, citas, dinero, archivos) y deja
// intactos config, horarios, catálogo, plantillas y las cuentas de acceso.
// Uso: npm run limpiar
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rutaDb = process.env.DB_PATH || path.join(raiz, 'data', 'marioguerra.db');
const db = new Database(rutaDb);
db.pragma('foreign_keys = ON');

const TABLAS = [
  'mensajes_enviados', 'notificaciones', 'cuotas', 'planes_financiamiento',
  'costos_operacion', 'pagos', 'cargos', 'documentos', 'revisiones_postop',
  'seguimientos', 'citas', 'cirugias', 'bloqueos', 'pacientes', 'gastos_fijos',
  'rate_limit',
];
db.transaction(() => {
  for (const t of TABLAS) db.prepare(`DELETE FROM ${t}`).run();
  db.prepare(
    `DELETE FROM sqlite_sequence
      WHERE name NOT IN ('usuarios','procedimientos_catalogo','horarios_atencion','plantillas_mensajes')`
  ).run();
})();

const uploads = process.env.UPLOADS_PATH || path.join(raiz, 'data', 'uploads');
for (const f of fs.existsSync(uploads) ? fs.readdirSync(uploads) : []) {
  fs.unlinkSync(path.join(uploads, f));
}

console.log('Datos de prueba borrados. Se conservan config, horarios, catálogo, plantillas y usuarios.');
db.close();
