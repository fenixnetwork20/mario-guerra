import 'server-only';
import crypto from 'node:crypto';
import { db, cfgNum } from './db';
import {
  ahoraVET, hoyVET, sumarDias, sumarMinutos, diaSemana, minutosDeHora,
  horaDeMinutos, soloFecha, minutosEntre,
} from './fechas';
import { ESTADOS_ACTIVOS } from './tipos';

const ACTIVOS = ESTADOS_ACTIVOS.map(() => '?').join(',');

export type Cupo = { fecha: string; hora: string; inicio: string };
export type DiaCupos = { fecha: string; cupos: Cupo[] };

type Ocupado = { inicio: string; fin: string };

/** Citas que ocupan agenda + bloqueos, dentro de un rango de fechas. */
function ocupados(desde: string, hasta: string, excluirCitaId?: number): Ocupado[] {
  const citas = db
    .prepare(
      `SELECT id, fecha_hora, duracion FROM citas
        WHERE estado IN (${ACTIVOS})
          AND fecha_hora >= ? AND fecha_hora < ?`
    )
    .all(...ESTADOS_ACTIVOS, `${desde} 00:00`, `${hasta} 23:59`) as
    { id: number; fecha_hora: string; duracion: number }[];

  const bloqueos = db
    .prepare('SELECT inicio, fin FROM bloqueos WHERE fin > ? AND inicio < ?')
    .all(`${desde} 00:00`, `${hasta} 23:59`) as { inicio: string; fin: string }[];

  return [
    ...citas
      .filter((c) => c.id !== excluirCitaId)
      .map((c) => ({ inicio: c.fecha_hora, fin: sumarMinutos(c.fecha_hora, c.duracion || 60) })),
    ...bloqueos,
  ];
}

const seSolapan = (aIni: string, aFin: string, bIni: string, bFin: string) =>
  aIni < bFin && bIni < aFin;

/**
 * Cupos libres para la reserva pública: se generan desde los horarios de atención
 * y se descuentan citas activas, bloqueos y lo que ya no cumple la anticipación mínima.
 */
export function cuposLibres(diasAdelante?: number, excluirCitaId?: number): DiaCupos[] {
  const dur = cfgNum('duracion_cita', 60);
  const maxDias = diasAdelante ?? cfgNum('dias_max_reserva', 60);
  const minAnticip = cfgNum('horas_min_anticipacion', 3) * 60;

  const desde = hoyVET();
  const hasta = sumarDias(desde, maxDias);
  const ocupacion = ocupados(desde, hasta, excluirCitaId);

  const horarios = db
    .prepare('SELECT dia_semana, hora_inicio, hora_fin FROM horarios_atencion WHERE activo = 1')
    .all() as { dia_semana: number; hora_inicio: string; hora_fin: string }[];

  const ahora = ahoraVET();
  const resultado: DiaCupos[] = [];

  for (let i = 0; i <= maxDias; i++) {
    const fecha = sumarDias(desde, i);
    const delDia = horarios.filter((h) => h.dia_semana === diaSemana(fecha));
    if (!delDia.length) continue;

    const cupos: Cupo[] = [];
    for (const h of delDia) {
      const ini = minutosDeHora(h.hora_inicio);
      const fin = minutosDeHora(h.hora_fin);
      for (let m = ini; m + dur <= fin; m += dur) {
        const hora = horaDeMinutos(m);
        const inicio = `${fecha} ${hora}`;
        if (minutosEntre(ahora, inicio) < minAnticip) continue;
        const finCupo = sumarMinutos(inicio, dur);
        if (ocupacion.some((o) => seSolapan(inicio, finCupo, o.inicio, o.fin))) continue;
        cupos.push({ fecha, hora, inicio });
      }
    }
    if (cupos.length) resultado.push({ fecha, cupos: cupos.sort((a, b) => a.hora.localeCompare(b.hora)) });
  }
  return resultado;
}

/** ¿Ese momento exacto sigue libre? Se revalida antes de escribir la reserva. */
export function cupoDisponible(inicio: string, duracion?: number, excluirCitaId?: number): boolean {
  const dur = duracion ?? cfgNum('duracion_cita', 60);
  const fecha = soloFecha(inicio);
  const fin = sumarMinutos(inicio, dur);

  const horarios = db
    .prepare('SELECT hora_inicio, hora_fin FROM horarios_atencion WHERE activo = 1 AND dia_semana = ?')
    .all(diaSemana(fecha)) as { hora_inicio: string; hora_fin: string }[];
  const dentro = horarios.some(
    (h) => inicio.slice(11) >= h.hora_inicio && fin.slice(11) <= h.hora_fin && fin.slice(0, 10) === fecha
  );
  if (!dentro) return false;

  return !ocupados(fecha, fecha, excluirCitaId).some((o) => seSolapan(inicio, fin, o.inicio, o.fin));
}

/** Choques para el agendado manual (no bloquea: la recepción decide). */
export function conflictos(inicio: string, duracion: number, excluirCitaId?: number): string[] {
  const fecha = soloFecha(inicio);
  const fin = sumarMinutos(inicio, duracion);
  return ocupados(fecha, fecha, excluirCitaId)
    .filter((o) => seSolapan(inicio, fin, o.inicio, o.fin))
    .map((o) => `${o.inicio} → ${o.fin}`);
}

/** Citas activas que se solapan con un bloqueo (no solo las que empiezan dentro). */
export function citasEnRango(inicio: string, fin: string) {
  const filas = db
    .prepare(
      `SELECT c.*, p.nombre AS paciente_nombre, p.whatsapp
         FROM citas c JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.estado IN ('reservada','confirmada')
          AND c.fecha_hora < ?
          AND c.fecha_hora >= ?
        ORDER BY c.fecha_hora`
    )
    // Se busca desde un día antes para alcanzar citas que empiezan antes del bloqueo
    // pero terminan dentro de él.
    .all(fin, sumarDias(soloFecha(inicio), -1) + ' 00:00') as Array<
      Record<string, unknown> & {
        id: number; fecha_hora: string; duracion: number; token_gestion: string;
        paciente_id: number; paciente_nombre: string; whatsapp: string;
      }
    >;
  return filas.filter((c) => seSolapan(c.fecha_hora, sumarMinutos(c.fecha_hora, c.duracion || 60), inicio, fin));
}

export function tokenNuevo(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().slice(0, 8);
}
