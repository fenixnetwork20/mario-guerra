import 'server-only';
import { db } from './db';
import { sumarMeses, hoyVET, mesDe } from './fechas';

// Todo en USD. La deuda del paciente SIEMPRE se calcula (cargos − pagos),
// nunca se escribe a mano.

export type EstadoCuenta = {
  total: number;      // suma de cargos
  pagado: number;     // suma de pagos
  pendiente: number;  // total − pagado
};

export function estadoCuenta(pacienteId: number): EstadoCuenta {
  const total = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM cargos WHERE paciente_id = ?')
    .get(pacienteId) as { s: number }).s;
  const pagado = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM pagos WHERE paciente_id = ?')
    .get(pacienteId) as { s: number }).s;
  return { total, pagado, pendiente: +(total - pagado).toFixed(2) };
}

export function estadoCuentaCirugia(cirugiaId: number): EstadoCuenta {
  const total = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM cargos WHERE cirugia_id = ?')
    .get(cirugiaId) as { s: number }).s;
  const pagado = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM pagos WHERE cirugia_id = ?')
    .get(cirugiaId) as { s: number }).s;
  return { total, pagado, pendiente: +(total - pagado).toFixed(2) };
}

/** Ingresos − costos de esa operación = ganancia de la operación. */
export function resumenCirugia(cirugiaId: number) {
  const ingresos = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM pagos WHERE cirugia_id = ?')
    .get(cirugiaId) as { s: number }).s;
  const costos = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM costos_operacion WHERE cirugia_id = ?')
    .get(cirugiaId) as { s: number }).s;
  return { ingresos, costos, ganancia: +(ingresos - costos).toFixed(2) };
}

/**
 * Crea el plan y genera las cuotas: (total − inicial) / meses, con vencimientos
 * mensuales a partir de fecha_inicio. El redondeo sobrante va a la última cuota.
 */
export function crearPlan(opts: {
  cirugiaId: number; total: number; inicial: number; meses: 1 | 3 | 6; fechaInicio: string;
}): number {
  const { cirugiaId, total, inicial, meses, fechaInicio } = opts;
  const financiado = Math.max(0, +(total - inicial).toFixed(2));
  const base = Math.floor((financiado / meses) * 100) / 100;

  return db.transaction(() => {
    const planId = Number(
      db.prepare(
        'INSERT INTO planes_financiamiento (cirugia_id, total, inicial, meses, fecha_inicio) VALUES (?,?,?,?,?)'
      ).run(cirugiaId, total, inicial, meses, fechaInicio).lastInsertRowid
    );
    const ins = db.prepare(
      'INSERT INTO cuotas (plan_id, numero, monto, fecha_vencimiento) VALUES (?,?,?,?)'
    );
    for (let i = 1; i <= meses; i++) {
      const monto = i === meses ? +(financiado - base * (meses - 1)).toFixed(2) : base;
      ins.run(planId, i, monto, sumarMeses(fechaInicio, i));
    }
    return planId;
  })();
}

export function cuotasDePlan(planId: number) {
  return db.prepare('SELECT * FROM cuotas WHERE plan_id = ? ORDER BY numero').all(planId) as
    { id: number; numero: number; monto: number; fecha_vencimiento: string; estado: string; pago_id: number | null }[];
}

export function planesDeCirugia(cirugiaId: number) {
  return db.prepare('SELECT * FROM planes_financiamiento WHERE cirugia_id = ? ORDER BY id DESC')
    .all(cirugiaId) as { id: number; total: number; inicial: number; meses: number; fecha_inicio: string }[];
}

/** Σ ingresos del mes − (Σ costos de operaciones + Σ gastos fijos) = ganancia neta. */
export function resumenMensual(mes: string) {
  const ingresos = (db.prepare("SELECT COALESCE(SUM(monto),0) s FROM pagos WHERE substr(fecha,1,7) = ?")
    .get(mes) as { s: number }).s;
  const costosOp = (db.prepare("SELECT COALESCE(SUM(monto),0) s FROM costos_operacion WHERE substr(fecha,1,7) = ?")
    .get(mes) as { s: number }).s;
  const gastos = (db.prepare('SELECT COALESCE(SUM(monto),0) s FROM gastos_fijos WHERE mes = ?')
    .get(mes) as { s: number }).s;
  const porMetodo = db.prepare(
    "SELECT metodo, COALESCE(SUM(monto),0) s FROM pagos WHERE substr(fecha,1,7) = ? GROUP BY metodo"
  ).all(mes) as { metodo: string; s: number }[];
  return {
    mes, ingresos, costosOp, gastos,
    neto: +(ingresos - costosOp - gastos).toFixed(2),
    porMetodo,
  };
}

export function mesActual(): string {
  return mesDe(hoyVET());
}

/** Cuotas vencidas y aún pendientes. */
export function cuotasVencidas(hasta = hoyVET()) {
  return db.prepare(
    `SELECT cu.*, p.cirugia_id, ci.procedimiento, pa.id AS paciente_id, pa.nombre AS paciente
       FROM cuotas cu
       JOIN planes_financiamiento p ON p.id = cu.plan_id
       JOIN cirugias ci ON ci.id = p.cirugia_id
       JOIN pacientes pa ON pa.id = ci.paciente_id
      WHERE cu.estado = 'pendiente' AND cu.fecha_vencimiento <= ?
      ORDER BY cu.fecha_vencimiento`
  ).all(hasta) as Array<{
    id: number; numero: number; monto: number; fecha_vencimiento: string; avisada: number;
    cirugia_id: number; procedimiento: string; paciente_id: number; paciente: string;
  }>;
}

/**
 * Consultas canceladas cuya plata hay que devolver. Se quedan aquí hasta que
 * alguien registre la devolución: una cita cancelada desaparece de la agenda,
 * pero el dinero del paciente no puede desaparecer con ella.
 */
export function devolucionesPendientes() {
  return db.prepare(
    `SELECT c.id, c.fecha_hora, c.pago_monto_usd, c.pago_monto_bs, c.pago_referencia,
            c.pago_verificado_at, c.motivo_cancelacion,
            p.id AS paciente_id, p.nombre AS paciente, p.whatsapp
       FROM citas c JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.pago_estado = 'por_devolver'
      ORDER BY c.fecha_hora`
  ).all() as Array<{
    id: number; fecha_hora: string; pago_monto_usd: number | null; pago_monto_bs: number | null;
    pago_referencia: string | null; pago_verificado_at: string | null; motivo_cancelacion: string | null;
    paciente_id: number; paciente: string; whatsapp: string;
  }>;
}

export const usd = (n: number) =>
  `$${(Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
