export type Resultado = { ok: true } | { ok: false; error: string };

export function validarNombre(v: string): Resultado {
  const n = (v || '').trim();
  if (n.length < 5) return { ok: false, error: 'Escribe tu nombre y apellido completos.' };
  if (n.length > 80) return { ok: false, error: 'El nombre es demasiado largo.' };
  if (!/\s/.test(n)) return { ok: false, error: 'Falta el apellido.' };
  return { ok: true };
}

/** Cédula venezolana: 6 a 9 dígitos, con V/E opcional adelante. */
export function normalizarCedula(v: string): string {
  return (v || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function validarCedula(v: string): Resultado {
  const c = normalizarCedula(v);
  if (!/^[VE]?\d{6,9}$/.test(c)) return { ok: false, error: 'Cédula inválida. Ejemplo: V12345678' };
  return { ok: true };
}

/** WhatsApp venezolano: 04XXXXXXXXX, +584XXXXXXXXX o 584XXXXXXXXX. */
export function validarWhatsapp(v: string): Resultado {
  const d = (v || '').replace(/\D/g, '');
  const ok = /^04\d{9}$/.test(d) || /^584\d{9}$/.test(d) || /^4\d{9}$/.test(d);
  if (!ok) return { ok: false, error: 'Número inválido. Ejemplo: 04121234567' };
  return { ok: true };
}

export function validarEdad(v: unknown): Resultado {
  if (v === null || v === undefined || v === '') return { ok: true };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 120) return { ok: false, error: 'Edad inválida.' };
  return { ok: true };
}

// Los campos <input type="date"> dejan escribir cualquier año: sin este tope,
// un dedazo como "1016" en vez de "2026" entra a la base y arrastra las
// revisiones postoperatorias y los vencimientos de cuotas con él.
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

function anioRazonable(fecha: string): boolean {
  const anio = Number(fecha.slice(0, 4));
  return anio >= ANIO_MIN && anio <= ANIO_MAX;
}

/** 'YYYY-MM-DD' */
export function validarFecha(v: string, obligatoria = true): Resultado {
  if (!v) return obligatoria ? { ok: false, error: 'Falta la fecha.' } : { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: 'Fecha inválida.' };
  if (!anioRazonable(v)) return { ok: false, error: `Revisa el año: debe estar entre ${ANIO_MIN} y ${ANIO_MAX}.` };
  return { ok: true };
}

/** 'YYYY-MM-DD HH:MM' */
export function validarMomento(v: string): Resultado {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v || '')) return { ok: false, error: 'Fecha u hora inválida.' };
  if (!anioRazonable(v)) return { ok: false, error: `Revisa el año: debe estar entre ${ANIO_MIN} y ${ANIO_MAX}.` };
  return { ok: true };
}

/** 'YYYY-MM' */
export function validarMes(v: string): Resultado {
  if (!/^\d{4}-\d{2}$/.test(v || '')) return { ok: false, error: 'Mes inválido.' };
  if (!anioRazonable(v)) return { ok: false, error: `Revisa el año: debe estar entre ${ANIO_MIN} y ${ANIO_MAX}.` };
  return { ok: true };
}

export function primerError(...rs: Resultado[]): string | null {
  for (const r of rs) if (!r.ok) return r.error;
  return null;
}
