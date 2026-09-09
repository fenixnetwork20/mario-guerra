import 'server-only';
import { db } from './db';
import { sumarDias, sumarMeses } from './fechas';

// Calendario fijo de revisiones del doctor: 4 en el primer mes, 1 a los 3 meses, 1 al año.
const CALENDARIO: Array<{ etiqueta: string; dias?: number; meses?: number }> = [
  { etiqueta: 'mes1-1', dias: 7 },
  { etiqueta: 'mes1-2', dias: 14 },
  { etiqueta: 'mes1-3', dias: 21 },
  { etiqueta: 'mes1-4', dias: 30 },
  { etiqueta: '3meses', meses: 3 },
  { etiqueta: '1ano', meses: 12 },
];

export const ETIQUETAS: Record<string, string> = {
  'mes1-1': 'Revisión 1 (1ª semana)',
  'mes1-2': 'Revisión 2 (2ª semana)',
  'mes1-3': 'Revisión 3 (3ª semana)',
  'mes1-4': 'Revisión 4 (1 mes)',
  '3meses': 'Revisión a los 3 meses',
  '1ano': 'Revisión al año',
};

/** Al registrar una cirugía con fecha, las revisiones se programan solas. */
export function programarRevisiones(cirugiaId: number, fechaCirugia: string) {
  const ins = db.prepare(
    'INSERT INTO revisiones_postop (cirugia_id, etiqueta, fecha_programada) VALUES (?,?,?)'
  );
  const cirugia = db.prepare('SELECT paciente_id, procedimiento FROM cirugias WHERE id = ?')
    .get(cirugiaId) as { paciente_id: number; procedimiento: string } | undefined;
  if (!cirugia) return;

  const insSeg = db.prepare(
    "INSERT INTO seguimientos (paciente_id, tipo, nota, fecha) VALUES (?,'revision',?,?)"
  );
  db.transaction(() => {
    db.prepare('DELETE FROM revisiones_postop WHERE cirugia_id = ?').run(cirugiaId);
    for (const r of CALENDARIO) {
      const fecha = r.dias ? sumarDias(fechaCirugia, r.dias) : sumarMeses(fechaCirugia, r.meses!);
      ins.run(cirugiaId, r.etiqueta, fecha);
      insSeg.run(cirugia.paciente_id, `${ETIQUETAS[r.etiqueta]} — ${cirugia.procedimiento}`, fecha);
    }
  })();
}

export function crearCirugia(d: {
  pacienteId: number; procedimiento: string; fecha: string | null;
  precioAcordado: number; notas?: string | null;
}): number {
  const id = Number(
    db.prepare(
      'INSERT INTO cirugias (paciente_id, procedimiento, fecha, precio_acordado, notas) VALUES (?,?,?,?,?)'
    ).run(d.pacienteId, d.procedimiento, d.fecha, d.precioAcordado, d.notas ?? null).lastInsertRowid
  );
  // El precio acordado entra como cargo del paciente; la deuda sale de ahí.
  if (d.precioAcordado > 0) {
    db.prepare('INSERT INTO cargos (paciente_id, cirugia_id, concepto, monto, fecha) VALUES (?,?,?,?,?)')
      .run(d.pacienteId, id, `Cirugía: ${d.procedimiento}`, d.precioAcordado, d.fecha ?? new Date().toISOString().slice(0, 10));
  }
  if (d.fecha) programarRevisiones(id, d.fecha);
  return id;
}

export function revisionesDeCirugia(cirugiaId: number) {
  return db.prepare('SELECT * FROM revisiones_postop WHERE cirugia_id = ? ORDER BY fecha_programada')
    .all(cirugiaId) as { id: number; etiqueta: string; fecha_programada: string; estado: string }[];
}

export function revisionesEnFecha(desde: string, hasta: string) {
  return db.prepare(
    `SELECT r.*, c.procedimiento, p.id AS paciente_id, p.nombre AS paciente, p.whatsapp
       FROM revisiones_postop r
       JOIN cirugias c ON c.id = r.cirugia_id
       JOIN pacientes p ON p.id = c.paciente_id
      WHERE r.fecha_programada BETWEEN ? AND ? AND r.estado IN ('pendiente','agendada')
      ORDER BY r.fecha_programada`
  ).all(desde, hasta) as Array<{
    id: number; etiqueta: string; fecha_programada: string; estado: string;
    cirugia_id: number; procedimiento: string; paciente_id: number; paciente: string; whatsapp: string;
  }>;
}

export function cirugiasDePaciente(pacienteId: number) {
  return db.prepare('SELECT * FROM cirugias WHERE paciente_id = ? ORDER BY COALESCE(fecha, created_at) DESC')
    .all(pacienteId) as Array<{
      id: number; procedimiento: string; fecha: string | null; precio_acordado: number;
      estado: string; notas: string | null;
    }>;
}
