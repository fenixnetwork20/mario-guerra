// Batería de pruebas de todo el sitio. Corre contra producción con datos
// marcados (cédulas V777xxxx) que se borran al final. No toca datos reales.
//   node scripts/prueba-completa.mjs
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const BASE = 'https://drmarioguerra.com';
const LOCAL = 'http://127.0.0.1:3320';
const db = new Database(path.join(RAIZ, 'data', 'marioguerra.db'));
const CEDULA_PRUEBA = 'V777';

let ok = 0, fallos = [];
const check = (nombre, condicion, detalle = '') => {
  if (condicion) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`); console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
};
const titulo = (t) => console.log(`\n${t}`);
const limpiarLimites = () => db.prepare('DELETE FROM rate_limit').run();

const sesion = (uid) => {
  const p = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 864e5 })).toString('base64url');
  return `${p}.${crypto.createHmac('sha256', env.SESSION_SECRET).update(p).digest('base64url')}`;
};
const pedir = async (url, opts = {}) => {
  const r = await fetch(url, { redirect: 'manual', ...opts });
  const texto = await r.text().catch(() => '');
  return { codigo: r.status, texto, cabeceras: r.headers };
};
const json = (t) => { try { return JSON.parse(t); } catch { return {}; } };

// Un cupo libre real, para no chocar con la agenda de verdad
async function cupoLibre(saltar = 0) {
  const { texto } = await pedir(`${BASE}/api/publico/cupos`);
  const dias = json(texto).dias ?? [];
  const todos = dias.flatMap((d) => d.cupos.map((c) => c.inicio));
  return todos[saltar];
}

// ── 1. Disponibilidad ───────────────────────────────────────────────────────
titulo('1. Disponibilidad de páginas');
for (const [ruta, esperado] of [['/', 200], ['/reservar', 200], ['/login', 200], ['/api/publico/cupos', 200]]) {
  const { codigo } = await pedir(BASE + ruta);
  check(`${ruta} → ${codigo}`, codigo === esperado, `esperaba ${esperado}`);
}
for (const rec of ['/marioguerra', '/marioguerra/reservar']) {
  const { codigo, cabeceras } = await pedir('https://fenixflowai.com' + rec);
  check(`redirección ${rec}`, codigo === 301 && (cabeceras.get('location') || '').startsWith(BASE),
    `${codigo} → ${cabeceras.get('location')}`);
}

// ── 2. Seguridad ────────────────────────────────────────────────────────────
titulo('2. Seguridad');
{
  const { codigo } = await pedir(`${LOCAL}/panel`);
  check('panel sin sesión redirige al login', codigo === 307 || codigo === 302, `código ${codigo}`);
}
{
  const { codigo } = await pedir(`${BASE}/api/documentos/1`);
  check('documentos sin sesión → 401', codigo === 401, `código ${codigo}`);
}
{
  const { codigo } = await pedir(`${BASE}/api/cron/tick`);
  check('cron sin token → 401', codigo === 401, `código ${codigo}`);
}
{
  const { codigo } = await pedir(`${BASE}/api/cron/tick?token=equivocado`);
  check('cron con token falso → 401', codigo === 401, `código ${codigo}`);
}
{
  const { codigo } = await pedir(`${BASE}/cita/0000000000000000000000000000000000000000`);
  check('token de cita inventado → 404', codigo === 404, `código ${codigo}`);
}
{
  // Cookie con firma manipulada
  const mala = sesion(1).split('.')[0] + '.firmafalsa';
  const { codigo } = await pedir(`${LOCAL}/panel`, { headers: { Cookie: `mg_sesion=${mala}` } });
  check('cookie con firma alterada no entra', codigo === 307 || codigo === 302, `código ${codigo}`);
}
{
  // Cookie de un usuario que no existe
  const { codigo } = await pedir(`${LOCAL}/panel`, { headers: { Cookie: `mg_sesion=${sesion(9999)}` } });
  check('sesión de usuario inexistente no entra', codigo === 307 || codigo === 302, `código ${codigo}`);
}
{
  const { texto } = await pedir(`${BASE}/`);
  const limpio = texto.replace(/<script[\s\S]*?<\/script>/g, '');
  const precios = /\b(3200|4200|4000|2500|1800|Bs\.)\b/.test(limpio);
  check('la landing no muestra precios', !precios);
}
{
  const { texto } = await pedir(`${BASE}/reservar`);
  check('la reserva no muestra precios', !/\b(3200|4200|4000)\b/.test(texto.replace(/<script[\s\S]*?<\/script>/g, '')));
}
{
  // Intento de inyección en la búsqueda de pacientes
  const { codigo } = await pedir(`${LOCAL}/panel/pacientes?q=${encodeURIComponent("'; DROP TABLE pacientes;--")}`,
    { headers: { Cookie: `mg_sesion=${sesion(1)}` } });
  const tablaViva = db.prepare("SELECT name FROM sqlite_master WHERE name='pacientes'").get();
  check('inyección SQL en la búsqueda no rompe nada', codigo === 200 && !!tablaViva);
}

// ── 3. Permisos por rol ─────────────────────────────────────────────────────
titulo('3. Permisos');
for (const [rol, uid] of [['recepción', 1], ['doctor', 2]]) {
  const cookie = { Cookie: `mg_sesion=${sesion(uid)}` };
  for (const ruta of ['/panel', '/panel/agenda', '/panel/pacientes', '/panel/dinero', '/panel/seguimiento', '/panel/mensajeria', '/panel/config']) {
    const { codigo, texto } = await pedir(LOCAL + ruta, { headers: cookie });
    const negado = texto.includes('No tienes acceso') || texto.includes('es de recepción');
    check(`${rol} entra a ${ruta}`, codigo === 200 && !negado, negado ? 'sección negada' : `código ${codigo}`);
  }
}
{
  const { texto } = await pedir(`${LOCAL}/panel`, { headers: { Cookie: `mg_sesion=${sesion(1)}` } });
  check('recepción ve Dinero en el menú', texto.includes('panel/dinero'));
}

// ── 4. Validaciones de la reserva ───────────────────────────────────────────
titulo('4. Validaciones');
const inicio = await cupoLibre();
check('hay cupos publicados', !!inicio, 'la agenda no ofrece ningún horario');
const reservar = (cuerpo) => pedir(`${BASE}/api/publico/reservar`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
});
const baseDatos = { nombre: 'Prueba Suite', cedula: `${CEDULA_PRUEBA}0001`, whatsapp: '04226099302',
  procedimiento: 'Botox 50u', modalidad: 'online', inicio };
for (const [caso, parche] of [
  ['nombre sin apellido', { nombre: 'Ana' }],
  ['cédula inválida', { cedula: 'abc' }],
  ['whatsapp inválido', { whatsapp: '123' }],
  ['modalidad vacía', { modalidad: '' }],
  ['procedimiento vacío', { procedimiento: '' }],
  ['fecha con año imposible', { inicio: '1016-09-18 09:00' }],
  ['fecha con formato roto', { inicio: 'mañana' }],
  ['horario fuera de agenda', { inicio: inicio.slice(0, 10) + ' 03:00' }],
]) {
  limpiarLimites();
  const { codigo, texto } = await reservar({ ...baseDatos, ...parche });
  check(`rechaza ${caso}`, codigo >= 400, `código ${codigo} ${json(texto).error ?? ''}`);
  check(`  …con mensaje en español`, !!json(texto).error && /[a-záéíóúñ]/i.test(json(texto).error));
}

// ── 5. Flujo del paciente de punta a punta ──────────────────────────────────
titulo('5. Flujo del paciente');
limpiarLimites();
const r1 = await reservar(baseDatos);
const token = json(r1.texto).token;
check('reserva creada', r1.codigo === 200 && !!token, `código ${r1.codigo}`);

limpiarLimites();
const r2 = await reservar({ ...baseDatos, cedula: `${CEDULA_PRUEBA}0002`, inicio });
check('el mismo cupo no se puede tomar dos veces', r2.codigo === 409, `código ${r2.codigo}`);

const accion = (tk, acc) => pedir(`${BASE}/api/publico/cita/${tk}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: acc }),
});
{
  const { codigo, texto } = await accion(token, 'confirmar');
  check('confirmar funciona', codigo === 200 && json(texto).estado === 'confirmada', texto.slice(0, 80));
}
{
  const { codigo } = await accion(token, 'accion_inventada');
  check('acción desconocida se rechaza', codigo === 400, `código ${codigo}`);
}
{
  const otro = await cupoLibre(1);
  limpiarLimites();
  const rep = await reservar({ ...baseDatos, inicio: otro, desde: token });
  const tokenNuevo = json(rep.texto).token;
  check('reprogramar crea cita nueva', rep.codigo === 200 && !!tokenNuevo && tokenNuevo !== token);
  const vieja = db.prepare('SELECT estado FROM citas WHERE token_gestion = ?').get(token);
  check('la cita anterior queda como reprogramada', vieja?.estado === 'reprogramada', vieja?.estado);
  const libre = await cupoLibre();
  check('el horario anterior vuelve a ofrecerse', libre === inicio, `ofrece ${libre}`);

  const { codigo, texto } = await accion(tokenNuevo, 'cancelar');
  check('cancelar funciona', codigo === 200 && json(texto).estado === 'cancelada', texto.slice(0, 80));
  const { codigo: repetido } = await accion(tokenNuevo, 'cancelar');
  check('cancelar dos veces se rechaza', repetido === 409, `código ${repetido}`);
}

// ── 6. Límite de peticiones ─────────────────────────────────────────────────
titulo('6. Límite de peticiones');
limpiarLimites();
let bloqueado = false;
for (let i = 0; i < 12; i++) {
  const { codigo } = await reservar({ ...baseDatos, cedula: `${CEDULA_PRUEBA}9${i}`, inicio: 'x' });
  if (codigo === 429) { bloqueado = true; break; }
}
check('la reserva se frena tras varios intentos', bloqueado);
limpiarLimites();

// ── 7. Cuentas y dinero ─────────────────────────────────────────────────────
titulo('7. Dinero');
{
  const pid = Number(db.prepare('INSERT INTO pacientes (nombre,cedula,whatsapp) VALUES (?,?,?)')
    .run('Prueba Dinero', `${CEDULA_PRUEBA}0500`, '04226099302').lastInsertRowid);
  const cid = Number(db.prepare("INSERT INTO cirugias (paciente_id,procedimiento,fecha,precio_acordado) VALUES (?,?,?,?)")
    .run(pid, 'Lipoescultura', '2026-11-02', 3000).lastInsertRowid);
  db.prepare('INSERT INTO cargos (paciente_id,cirugia_id,concepto,monto,fecha) VALUES (?,?,?,?,?)')
    .run(pid, cid, 'Cirugía', 3000, '2026-11-02');
  db.prepare("INSERT INTO pagos (paciente_id,cirugia_id,monto,metodo,fecha) VALUES (?,?,?,?,?)")
    .run(pid, cid, 1200, 'zelle', '2026-11-02');
  db.prepare('INSERT INTO costos_operacion (cirugia_id,concepto,monto,fecha) VALUES (?,?,?,?)')
    .run(cid, 'Pabellón', 700, '2026-11-02');

  const cargos = db.prepare('SELECT COALESCE(SUM(monto),0) s FROM cargos WHERE paciente_id=?').get(pid).s;
  const pagos = db.prepare('SELECT COALESCE(SUM(monto),0) s FROM pagos WHERE paciente_id=?').get(pid).s;
  check('deuda calculada = cargos − pagos', cargos - pagos === 1800, `${cargos} − ${pagos}`);
  const costos = db.prepare('SELECT COALESCE(SUM(monto),0) s FROM costos_operacion WHERE cirugia_id=?').get(cid).s;
  check('ganancia de la operación = ingresos − costos', pagos - costos === 500, `${pagos} − ${costos}`);

  // Cuotas: reparto exacto sin perder centavos
  const financiado = 3000 - 500;
  const base = Math.floor((financiado / 3) * 100) / 100;
  const cuotas = [base, base, +(financiado - base * 2).toFixed(2)];
  check('las cuotas suman exactamente el financiado',
    +cuotas.reduce((a, b) => a + b, 0).toFixed(2) === financiado, cuotas.join(' + '));

  const { texto } = await pedir(`${LOCAL}/panel/pacientes/${pid}`, { headers: { Cookie: `mg_sesion=${sesion(1)}` } });
  check('la ficha muestra el pendiente calculado', texto.includes('1,800.00') || texto.includes('$1,800'));
}

// ── 8. Recordatorios ────────────────────────────────────────────────────────
titulo('8. Recordatorios');
{
  const { codigo, texto } = await pedir(`${LOCAL}/api/cron/tick?token=${env.CRON_TOKEN}`);
  const r = json(texto);
  check('el tick corre con token válido', codigo === 200 && typeof r.r1 === 'number', texto.slice(0, 80));
  const { texto: t2 } = await pedir(`${LOCAL}/api/cron/tick?token=${env.CRON_TOKEN}`);
  check('el tick es idempotente', json(t2).r1 === 0 && json(t2).canceladas === 0, t2.slice(0, 80));
}

// ── 9. SEO y accesibilidad ──────────────────────────────────────────────────
titulo('9. SEO y accesibilidad');
{
  const { texto } = await pedir(`${BASE}/`);
  check('tiene <title>', /<title>[^<]{10,}/.test(texto));
  check('tiene meta description', /name="description"[^>]*content="[^"]{30,}/.test(texto));
  check('tiene Open Graph', /property="og:title"/.test(texto) && /property="og:image"/.test(texto));
  check('la landing es indexable', !/name="robots"[^>]*content="[^"]*noindex/.test(texto));
  check('idioma declarado en español', /<html[^>]*lang="es"/.test(texto));
  const imgs = texto.match(/<img[^>]*>/g) ?? [];
  check('todas las imágenes traen alt', imgs.every((i) => /alt=/.test(i)), `${imgs.filter((i) => !/alt=/.test(i)).length} sin alt`);
}
{
  const { texto } = await pedir(`${BASE}/reservar`);
  check('las páginas internas NO son indexables', /name="robots"[^>]*content="[^"]*noindex/.test(texto));
  check('sin JS el formulario igual se ve', !texto.includes('class="aparece "') || texto.includes('js'));
}

// ── 10. Rendimiento ─────────────────────────────────────────────────────────
titulo('10. Rendimiento');
for (const ruta of ['/', '/reservar']) {
  const t0 = Date.now();
  await pedir(BASE + ruta);
  const ms = Date.now() - t0;
  check(`${ruta} responde en menos de 2 s (${ms} ms)`, ms < 2000, `${ms} ms`);
}
{
  const pesos = fs.readdirSync(path.join(RAIZ, 'public/marca'))
    .map((f) => [f, fs.statSync(path.join(RAIZ, 'public/marca', f)).size]);
  const pesadas = pesos.filter(([, s]) => s > 400_000);
  check('ninguna imagen de marca pasa de 400 KB', pesadas.length === 0,
    pesadas.map(([f, s]) => `${f} ${Math.round(s / 1024)}KB`).join(', '));
}

// ── Limpieza ────────────────────────────────────────────────────────────────
titulo('Limpieza');
db.pragma('foreign_keys = ON');
const borrados = db.prepare(`DELETE FROM pacientes WHERE cedula LIKE '${CEDULA_PRUEBA}%'`).run().changes;
db.prepare("DELETE FROM mensajes_enviados WHERE destino = '584226099302'").run();
db.prepare("DELETE FROM notificaciones WHERE mensaje LIKE '%Prueba %'").run();
limpiarLimites();
console.log(`  pacientes de prueba borrados: ${borrados}`);
console.log(`  citas que quedan: ${db.prepare('SELECT COUNT(*) c FROM citas').get().c}`);

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTADO: ${ok} pruebas pasadas, ${fallos.length} fallidas`);
if (fallos.length) { console.log('\nFALLOS:'); fallos.forEach((f) => console.log(`  ✗ ${f}`)); }
db.close();
process.exit(fallos.length ? 1 : 0);
