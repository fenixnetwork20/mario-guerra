// Toda la lógica de tiempos del sistema corre en America/Caracas (VET, UTC−4 fijo, sin DST).
// Guardamos y comparamos texto plano: 'YYYY-MM-DD HH:MM' y 'YYYY-MM-DD'.
// El truco: para hacer aritmética tratamos ese texto como si fuera UTC. Al no haber
// horario de verano en Venezuela, sumar minutos/días nunca se corre una hora.

export const ZONA = 'America/Caracas';

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
});
const fmtHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false,
});

/** 'YYYY-MM-DD' de hoy en Venezuela. */
export function hoyVET(): string {
  return fmtFecha.format(new Date());
}

/** 'YYYY-MM-DD HH:MM' de ahora mismo en Venezuela. */
export function ahoraVET(): string {
  const d = new Date();
  return `${fmtFecha.format(d)} ${fmtHora.format(d)}`;
}

/** 'HH:MM' de ahora mismo en Venezuela. */
export function horaVET(): string {
  return fmtHora.format(new Date());
}

function aDate(s: string): Date {
  const txt = s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(' ', 'T')}:00Z`;
  return new Date(txt);
}

function deDate(d: Date, soloFecha = false): string {
  const f = d.toISOString();
  return soloFecha ? f.slice(0, 10) : `${f.slice(0, 10)} ${f.slice(11, 16)}`;
}

export function sumarMinutos(s: string, min: number): string {
  return deDate(new Date(aDate(s).getTime() + min * 60_000), s.length === 10);
}

export function sumarDias(s: string, dias: number): string {
  return deDate(new Date(aDate(s).getTime() + dias * 86_400_000), s.length === 10);
}

/** Suma meses cuidando los meses cortos (31 de enero + 1 mes = 28/29 de febrero). */
export function sumarMeses(fecha: string, meses: number): string {
  const d = aDate(fecha);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return deDate(d, true);
}

/** Diferencia en minutos entre dos marcas 'YYYY-MM-DD HH:MM' (b − a). */
export function minutosEntre(a: string, b: string): number {
  return Math.round((aDate(b).getTime() - aDate(a).getTime()) / 60_000);
}

/** 0 = domingo … 6 = sábado, para 'YYYY-MM-DD'. */
export function diaSemana(fecha: string): number {
  return aDate(fecha).getUTCDay();
}

export const soloFecha = (s: string) => s.slice(0, 10);
export const soloHora = (s: string) => s.slice(11, 16);

/** 'YYYY-MM' de una fecha o marca de tiempo. */
export const mesDe = (s: string) => s.slice(0, 7);

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "lunes 8 de septiembre de 2026" */
export function fechaLarga(s: string): string {
  const d = aDate(s);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "lun 8 sep" */
export function fechaCorta(s: string): string {
  const d = aDate(s);
  return `${DIAS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
}

/** '14:30' → '2:30 pm' */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suf = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suf}`;
}

/** Lunes de la semana que contiene esa fecha. */
export function inicioSemana(fecha: string): string {
  const d = diaSemana(fecha);
  return sumarDias(fecha, d === 0 ? -6 : 1 - d);
}

export const minutosDeHora = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const horaDeMinutos = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
