// Crea la base SQLite, aplica el esquema y siembra los datos del consultorio.
// Es idempotente: se puede correr las veces que haga falta.
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rutaDb = process.env.DB_PATH || path.join(raiz, 'data', 'marioguerra.db');
fs.mkdirSync(path.dirname(rutaDb), { recursive: true });

const db = new Database(rutaDb);
db.exec(fs.readFileSync(path.join(raiz, 'db', 'schema.sql'), 'utf8'));

const ponerConfig = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO NOTHING');
const CONFIG = {
  duracion_cita: '60',
  precio_consulta_presencial: '50',
  precio_consulta_online: '30',
  // Ventana del recordatorio 1 (un día antes)
  r1_hora_inicio: '08:00',
  r1_hora_fin: '17:00',
  // Hora de corte que decide la rama del recordatorio 2
  hora_corte: '11:00',
  // Rama "cita después del corte"
  r2_hora_dia: '08:00',
  autocancel_offset_horas: '3',
  // Rama "cita a la hora de corte o antes"
  r2_hora_noche_anterior: '18:00',
  autocancel_hora_noche_anterior: '21:00',
  // Reserva pública
  dias_max_reserva: '60',
  horas_min_anticipacion: '3',
  // Datos del consultorio
  nombre_consultorio: 'Dr. Mario Arturo Guerra Pineda',
  direccion: 'Av. 3H entre calle 70 y 71, sector Bella Vista, Maracaibo, Zulia',
  whatsapp_consultorio: '+1 832 593 0835',
  whatsapp_emergencias: '04246502649',
  // Mensajería
  mensajeria_activa: '0',
};
for (const [k, v] of Object.entries(CONFIG)) ponerConfig.run(k, v);

// Horarios: L–V 8:00–17:00, Sáb 8:00–15:00, Dom cerrado.
if (db.prepare('SELECT COUNT(*) c FROM horarios_atencion').get().c === 0) {
  const ins = db.prepare('INSERT INTO horarios_atencion (dia_semana, hora_inicio, hora_fin) VALUES (?,?,?)');
  for (const d of [1, 2, 3, 4, 5]) ins.run(d, '08:00', '17:00');
  ins.run(6, '08:00', '15:00');
}

// Catálogo de procedimientos (precios de referencia interna, "desde").
const CATALOGO = [
  ['Lipoescultura', 3200], ['Abdominoplastia', 3200], ['Aumento mamario simple', 3200],
  ['Mastopexia con implantes', 4200], ['Mastopexia sin implantes', 4000],
  ['Reducción mamaria', 4000], ['Mela abdominal', 1800], ['Minidermo', 2000],
  ['Lipo papada', 600], ['Blefaroplastia superior', 800], ['Blefaroplastia inferior', 2500],
  ['Armonización facial', 350], ['Botox 50u', 100], ['Botox 100u', 170],
  ['Ácido hialurónico (1 ampolla)', 170], ['Aumento de labios', 180],
  ['Corrección de cicatrices', 300], ['Otro / no estoy seguro', null],
];
const insProc = db.prepare(
  'INSERT INTO procedimientos_catalogo (nombre, precio_referencia, orden) VALUES (?,?,?) ON CONFLICT(nombre) DO NOTHING'
);
CATALOGO.forEach(([n, p], i) => insProc.run(n, p, i));

// Plantillas de WhatsApp (los nombres reales de Meta se cargan luego desde Configuración).
const PLANTILLAS = [
  ['reserva_recibida', 'Reserva recibida (al agendar)', ['nombre', 'fecha', 'hora', 'link'],
   'Hola {{1}}, tu cita de valoración con el Dr. Mario Guerra quedó reservada para el {{2}} a las {{3}}.\n\nGuarda este enlace, es privado y es tuyo: {{4}}\n\nDesde ahí puedes confirmar, reprogramar o cancelar cuando quieras. Un día antes te escribimos para que confirmes tu asistencia.'],
  ['recordatorio_1', 'Recordatorio 1 (un día antes)', ['nombre', 'fecha', 'hora', 'link'],
   'Hola {{1}}, te recordamos tu cita de valoración con el Dr. Mario Guerra: {{2}} a las {{3}}.\n\nConfirma tu asistencia aquí: {{4}}\n\nSi necesitas otro día, desde ese mismo enlace puedes reprogramar.'],
  ['recordatorio_2', 'Recordatorio 2 (sin confirmar)', ['nombre', 'fecha', 'hora', 'link'],
   'Hola {{1}}, todavía no has confirmado tu cita del {{2}} a las {{3}}.\n\nConfírmala aquí: {{4}}\n\nSi no la confirmas, el cupo se libera para otro paciente.'],
  ['cancelacion', 'Aviso de cancelación', ['nombre', 'fecha', 'hora', 'link'],
   'Hola {{1}}, tu cita del {{2}} a las {{3}} quedó cancelada y tu cupo fue liberado.\n\nPuedes ver el estado de tu cita aquí: {{4}}\n\nSi no solicitaste esta cancelación, respóndenos por este mismo chat.'],
  ['bloqueo', 'Cancelación por emergencia del doctor', ['nombre', 'fecha', 'hora', 'link'],
   'Hola {{1}}, por una emergencia del doctor tenemos que mover tu cita del {{2}} a las {{3}}. Lamentamos el cambio.\n\nEscoge el horario que prefieras aquí: {{4}}\n\nNo tienes que pagar nada adicional por reprogramar.'],
  ['libre', 'Mensaje manual', ['nombre', 'fecha', 'hora', 'link'],
   'Hola {{1}}, te escribimos del consultorio del Dr. Mario Guerra por tu cita del {{2}} a las {{3}}.\n\nPuedes ver los detalles aquí: {{4}}\n\nSi tienes cualquier duda, respóndenos por este chat.'],
];
const insPl = db.prepare(
  'INSERT INTO plantillas_mensajes (clave, nombre, variables, cuerpo_ejemplo) VALUES (?,?,?,?) ON CONFLICT(clave) DO NOTHING'
);
for (const [clave, nombre, vars, cuerpo] of PLANTILLAS) insPl.run(clave, nombre, JSON.stringify(vars), cuerpo);

// Las dos cuentas. Si no se pasan contraseñas por env, se generan y se imprimen una sola vez.
function crearUsuario(email, nombre, rol, envVar) {
  const ya = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (ya) return null;
  const clave = process.env[envVar] || crypto.randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (?,?,?,?)')
    .run(email, bcrypt.hashSync(clave, 10), nombre, rol);
  return clave;
}
const c1 = crearUsuario('recepcion@marioguerra.local', 'Recepción', 'recepcion', 'CLAVE_RECEPCION');
const c2 = crearUsuario('doctor@marioguerra.local', 'Dr. Mario Guerra', 'doctor', 'CLAVE_DOCTOR');

console.log('Base lista en', rutaDb);
if (c1) console.log('  recepcion@marioguerra.local →', c1);
if (c2) console.log('  doctor@marioguerra.local    →', c2);
if (!c1 && !c2) console.log('  (usuarios ya existían; contraseñas sin tocar)');
db.close();
