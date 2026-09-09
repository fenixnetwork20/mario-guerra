'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { exigirPermiso } from '@/lib/permisos';
import { crearPlan } from '@/lib/dinero';
import { crearCirugia, programarRevisiones } from '@/lib/cirugias';
import { hoyVET, mesDe } from '@/lib/fechas';
import { validarFecha, validarMes } from '@/lib/validar';
import type { Respuesta } from '@/componentes/FormAccion';

const METODOS = ['zelle', 'efectivo', 'binance'];

function monto(datos: FormData, campo = 'monto'): number | null {
  const n = Number(datos.get(campo));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export async function registrarPago(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  const usuario = await exigirPermiso('pagos');
  const pacienteId = Number(datos.get('paciente_id'));
  const m = monto(datos);
  const metodo = String(datos.get('metodo') ?? '');
  if (!pacienteId) return { ok: false, error: 'Falta el paciente.' };
  if (!m) return { ok: false, error: 'El monto debe ser mayor que cero.' };
  if (!METODOS.includes(metodo)) return { ok: false, error: 'Elige el método de pago.' };

  const fecha = String(datos.get('fecha') || hoyVET());
  const vf = validarFecha(fecha);
  if (!vf.ok) return { ok: false, error: vf.error };

  const cuotaId = Number(datos.get('cuota_id') || 0);
  const cirugiaId = Number(datos.get('cirugia_id') || 0) || null;

  db.transaction(() => {
    const pagoId = Number(
      db.prepare(
        `INSERT INTO pagos (paciente_id, cirugia_id, cita_id, monto, metodo, fecha, concepto, created_by)
         VALUES (?,?,?,?,?,?,?,?)`
      ).run(
        pacienteId, cirugiaId, Number(datos.get('cita_id') || 0) || null,
        m, metodo, fecha,
        String(datos.get('concepto') || ''), usuario.id
      ).lastInsertRowid
    );
    if (cuotaId) {
      db.prepare("UPDATE cuotas SET estado = 'pagada', pago_id = ? WHERE id = ?").run(pagoId, cuotaId);
    }
  })();

  revalidatePath(`/panel/pacientes/${pacienteId}`);
  revalidatePath('/panel/dinero');
  return { ok: true, aviso: 'Pago registrado.' };
}

export async function registrarCargo(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('financiamiento');
  const pacienteId = Number(datos.get('paciente_id'));
  const m = monto(datos);
  const concepto = String(datos.get('concepto') ?? '').trim();
  if (!m) return { ok: false, error: 'El monto debe ser mayor que cero.' };
  if (!concepto) return { ok: false, error: 'Escribe el concepto.' };
  const fechaCargo = String(datos.get('fecha') || hoyVET());
  const vc = validarFecha(fechaCargo);
  if (!vc.ok) return { ok: false, error: vc.error };

  db.prepare('INSERT INTO cargos (paciente_id, cirugia_id, concepto, monto, fecha) VALUES (?,?,?,?,?)')
    .run(pacienteId, Number(datos.get('cirugia_id') || 0) || null, concepto, m, fechaCargo);
  revalidatePath(`/panel/pacientes/${pacienteId}`);
  return { ok: true, aviso: 'Cargo agregado.' };
}

export async function guardarCirugia(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('financiamiento');
  const id = Number(datos.get('cirugia_id') || 0);
  const pacienteId = Number(datos.get('paciente_id'));
  const procedimiento = String(datos.get('procedimiento') ?? '').trim();
  const fecha = String(datos.get('fecha') || '') || null;
  const precio = Number(datos.get('precio_acordado') || 0);
  if (!procedimiento) return { ok: false, error: 'Elige el procedimiento.' };
  if (!(precio >= 0)) return { ok: false, error: 'Precio inválido.' };
  const vfc = validarFecha(fecha ?? '', false);
  if (!vfc.ok) return { ok: false, error: vfc.error };

  if (id) {
    const antes = db.prepare('SELECT fecha FROM cirugias WHERE id = ?').get(id) as { fecha: string | null };
    db.prepare('UPDATE cirugias SET procedimiento=?, fecha=?, precio_acordado=?, estado=?, notas=? WHERE id=?')
      .run(procedimiento, fecha, precio, String(datos.get('estado') || 'programada'),
           String(datos.get('notas') || ''), id);
    // Si cambió la fecha, se reprograman las revisiones automáticas.
    if (fecha && fecha !== antes?.fecha) programarRevisiones(id, fecha);
  } else {
    crearCirugia({
      pacienteId, procedimiento, fecha, precioAcordado: precio,
      notas: String(datos.get('notas') || ''),
    });
  }
  revalidatePath(`/panel/pacientes/${pacienteId}`);
  revalidatePath('/panel/dinero');
  return { ok: true, aviso: id ? 'Cirugía actualizada.' : 'Cirugía registrada. Revisiones programadas.' };
}

export async function registrarCosto(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('contabilidad_ver');
  const cirugiaId = Number(datos.get('cirugia_id'));
  const m = monto(datos);
  const concepto = String(datos.get('concepto') ?? '').trim();
  if (!cirugiaId) return { ok: false, error: 'Falta la cirugía.' };
  if (!m) return { ok: false, error: 'El monto debe ser mayor que cero.' };
  if (!concepto) return { ok: false, error: 'Escribe el concepto (pabellón, anestesia, materiales…).' };
  const fechaCosto = String(datos.get('fecha') || hoyVET());
  const vk = validarFecha(fechaCosto);
  if (!vk.ok) return { ok: false, error: vk.error };

  db.prepare('INSERT INTO costos_operacion (cirugia_id, concepto, monto, fecha) VALUES (?,?,?,?)')
    .run(cirugiaId, concepto, m, fechaCosto);
  const c = db.prepare('SELECT paciente_id FROM cirugias WHERE id = ?').get(cirugiaId) as { paciente_id: number };
  revalidatePath(`/panel/pacientes/${c.paciente_id}`);
  revalidatePath('/panel/dinero');
  return { ok: true, aviso: 'Costo registrado.' };
}

export async function guardarPlan(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('financiamiento');
  const cirugiaId = Number(datos.get('cirugia_id'));
  const total = Number(datos.get('total'));
  const inicial = Number(datos.get('inicial') || 0);
  const meses = Number(datos.get('meses'));
  const fechaInicio = String(datos.get('fecha_inicio') || hoyVET());

  if (!cirugiaId) return { ok: false, error: 'Falta la cirugía.' };
  if (!(total > 0)) return { ok: false, error: 'El total debe ser mayor que cero.' };
  if (inicial < 0 || inicial > total) return { ok: false, error: 'La inicial no puede pasar del total.' };
  if (![1, 3, 6].includes(meses)) return { ok: false, error: 'El plan es a 1, 3 o 6 meses.' };
  const vp = validarFecha(fechaInicio);
  if (!vp.ok) return { ok: false, error: vp.error };

  crearPlan({ cirugiaId, total, inicial, meses: meses as 1 | 3 | 6, fechaInicio });
  const c = db.prepare('SELECT paciente_id FROM cirugias WHERE id = ?').get(cirugiaId) as { paciente_id: number };
  revalidatePath(`/panel/pacientes/${c.paciente_id}`);
  return { ok: true, aviso: `Plan creado: ${meses} cuota(s).` };
}

export async function eliminarPlan(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('financiamiento');
  const id = Number(datos.get('plan_id'));
  const plan = db.prepare('SELECT cirugia_id FROM planes_financiamiento WHERE id = ?').get(id) as
    { cirugia_id: number } | undefined;
  if (!plan) return { ok: false, error: 'Plan no encontrado.' };
  const pagadas = db.prepare("SELECT COUNT(*) c FROM cuotas WHERE plan_id = ? AND estado = 'pagada'")
    .get(id) as { c: number };
  if (pagadas.c) return { ok: false, error: 'Ese plan ya tiene cuotas pagadas; no se puede borrar.' };

  db.prepare('DELETE FROM planes_financiamiento WHERE id = ?').run(id);
  const c = db.prepare('SELECT paciente_id FROM cirugias WHERE id = ?').get(plan.cirugia_id) as { paciente_id: number };
  revalidatePath(`/panel/pacientes/${c.paciente_id}`);
  return { ok: true, aviso: 'Plan eliminado.' };
}

export async function guardarGastoFijo(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('gastos_fijos');
  const m = monto(datos);
  const concepto = String(datos.get('concepto') ?? '').trim();
  const mes = String(datos.get('mes') || mesDe(hoyVET()));
  if (!m) return { ok: false, error: 'El monto debe ser mayor que cero.' };
  if (!concepto) return { ok: false, error: 'Escribe el concepto.' };
  const vm = validarMes(mes);
  if (!vm.ok) return { ok: false, error: vm.error };

  db.prepare('INSERT INTO gastos_fijos (concepto, categoria, monto, mes) VALUES (?,?,?,?)')
    .run(concepto, String(datos.get('categoria') || ''), m, mes);
  revalidatePath('/panel/dinero');
  return { ok: true, aviso: 'Gasto cargado.' };
}

export async function eliminarGastoFijo(_prev: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirPermiso('gastos_fijos');
  db.prepare('DELETE FROM gastos_fijos WHERE id = ?').run(Number(datos.get('gasto_id')));
  revalidatePath('/panel/dinero');
  return { ok: true, aviso: 'Gasto eliminado.' };
}
