'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/rutas';
import { fechaCorta, fechaLarga, hora12 } from '@/lib/fechas';
import { primerError, validarCedula, validarNombre, validarWhatsapp } from '@/lib/validar';

type Cupo = { fecha: string; hora: string; inicio: string };
export type DiaCupos = { fecha: string; cupos: Cupo[] };

export type Reprogramando = {
  token: string; nombre: string; cedula: string; whatsapp: string;
  procedimiento: string; modalidad: 'presencial' | 'online'; fechaActual: string;
  /** Lo que ya pagó por esta consulta: mover la fecha no se cobra otra vez. */
  yaPagoUsd: number | null;
};

type CitaHallada = {
  token: string; estado: string; modalidad: string; cuando: string;
  /** La confirmación se abre el día anterior, cuando sale el recordatorio. */
  puedeConfirmar: boolean;
};
type Modo = 'menu' | 'agendar' | 'confirmar' | 'gestionar';

type Cobro = {
  usd: number; bs: string | null; tasa: number | null;
  pagoMovil: { banco: string; telefono: string; cedula: string; titular: string; qr: string } | null;
  binance: { usuario: string; qr: string } | null;
  zelle: { correo: string; titular: string } | null;
  efectivo: boolean;
};

const PASOS_AGENDAR = 6;

/** ¿Hay con qué cobrar? Sin datos cargados, el paso de pago no aporta nada. */
const hayComoPagar = (c: Cobro | null) => Boolean(c && (c.pagoMovil || c.binance || c.zelle || c.efectivo));
const DIAS_VISIBLES = 12;

/**
 * Menú guiado de citas: agendar, confirmar y cancelar/reprogramar, todo dentro
 * de la misma tarjeta. Un paso por pantalla — el paciente nunca ve el
 * formulario completo de golpe, que es lo que hace que la gente abandone.
 */
export function AsistenteCitas({
  dias, procedimientos, reprogramando, whatsapp: whatsappConsultorio, children,
}: {
  dias: DiaCupos[];
  procedimientos: string[];
  reprogramando: Reprogramando | null;
  whatsapp: string;
  /** Lo que se muestra debajo de la tarjeta solo en el menú (qué incluye la consulta). */
  children?: React.ReactNode;
}) {
  const [modo, setModo] = useState<Modo>(reprogramando ? 'agendar' : 'menu');

  return (
    <>
      <div className="mx-auto w-full max-w-[34rem]">
        {modo === 'menu' && <Menu ir={setModo} hayCupos={dias.length > 0} />}
        {modo === 'agendar' && (
          <Agendar
            dias={dias}
            procedimientos={procedimientos}
            reprogramando={reprogramando}
            whatsapp={whatsappConsultorio}
            volver={() => setModo('menu')}
          />
        )}
        {(modo === 'confirmar' || modo === 'gestionar') && (
          <PorCedula
            modo={modo}
            whatsapp={whatsappConsultorio}
            volver={() => setModo('menu')}
            agendar={() => setModo('agendar')}
          />
        )}
      </div>
      {modo === 'menu' && children}
    </>
  );
}

/* ── Piezas compartidas ─────────────────────────────────────────────────── */

function Tarjeta({ children }: { children: React.ReactNode }) {
  return <div className="vidrio p-5 sm:p-7">{children}</div>;
}

function Cabecera({
  titulo, sub, volver, paso,
}: {
  titulo: string; sub?: string; volver?: () => void; paso?: number;
}) {
  return (
    <div className="mb-5">
      {(volver || paso) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          {volver ? (
            <button type="button" onClick={volver}
              className="text-[13px] font-medium text-[var(--color-nude)]/60 hover:text-white transition-colors">
              ← Volver
            </button>
          ) : <span />}
          {paso && (
            <span className="etiqueta">Paso {paso} de {PASOS_AGENDAR}</span>
          )}
        </div>
      )}
      {paso && (
        <div className="h-[3px] rounded-full bg-white/12 mb-5 overflow-hidden">
          <div className="h-full bg-[var(--color-cobre-luz)] transition-[width] duration-300 ease-out"
            style={{ width: `${(paso / PASOS_AGENDAR) * 100}%` }} />
        </div>
      )}
      <h2 className="titulo text-[21px] sm:text-[23px] leading-snug">{titulo}</h2>
      {sub && <p className="text-[14px] text-[var(--color-nude)]/70 mt-2 leading-relaxed">{sub}</p>}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-[rgba(154,61,46,.5)] bg-[rgba(154,61,46,.16)] px-4 py-3 text-[14px] text-[#f3c9c0]">
      {texto}
    </div>
  );
}

function Ayuda({ whatsapp }: { whatsapp: string }) {
  if (!whatsapp) return null;
  return (
    <p className="text-[12.5px] text-[var(--color-nude)]/55 mt-5 text-center">
      ¿Necesitas ayuda? Escríbenos por WhatsApp al {whatsapp}
    </p>
  );
}

/* ── Menú ───────────────────────────────────────────────────────────────── */

function Menu({ ir, hayCupos }: { ir: (m: Modo) => void; hayCupos: boolean }) {
  const opciones: [Modo, string, string, string][] = [
    ['agendar', '→', 'Agendar mi cita', 'Escoge el día y la hora'],
    ['confirmar', '✓', 'Confirmar mi cita', 'Avísanos que sí vas a asistir'],
    ['gestionar', '↻', 'Cancelar o reprogramar', 'Cambia la fecha o libera tu cupo'],
  ];

  return (
    <Tarjeta>
      <p className="etiqueta">Consulta de valoración</p>
      <h1 className="display text-[26px] sm:text-[32px] mt-3">Tu cita,<br />en un minuto</h1>
      <span className="block h-px w-14 bg-[var(--color-cobre-luz)] mt-4" />
      <p className="text-[14.5px] text-[var(--color-nude)]/75 mt-4 leading-relaxed">
        Escoge el día y la hora que te sirva. Al terminar recibes un enlace privado
        para cambiar o cancelar tu cita cuando quieras.
      </p>

      <div className="mt-6 space-y-2.5">
        {opciones.map(([m, icono, titulo, pie]) => (
          <button
            key={m}
            type="button"
            onClick={() => ir(m)}
            className={`opcion flex items-center gap-4 px-4 py-4 ${m === 'agendar' ? 'opcion-agendar' : ''}`}
          >
            <span className={`shrink-0 grid place-items-center h-9 w-9 rounded-full text-[15px] ${
              m === 'agendar'
                ? 'bg-[var(--color-cobre)] text-white'
                : 'bg-white/10 text-[var(--color-cobre-luz)]'
            }`}>
              {icono}
            </span>
            <span className="min-w-0">
              <span className="block text-[15.5px] font-semibold">{titulo}</span>
              <span className="block text-[13px] text-[var(--color-nude)]/60 mt-0.5">{pie}</span>
            </span>
          </button>
        ))}
      </div>

      {!hayCupos && (
        <p className="text-[13px] text-[var(--color-nude)]/60 mt-5">
          En este momento la agenda no tiene cupos abiertos para nuevas citas.
        </p>
      )}
    </Tarjeta>
  );
}

/* ── Agendar ────────────────────────────────────────────────────────────── */

function Agendar({
  dias, procedimientos, reprogramando, whatsapp: whatsappConsultorio, volver,
}: {
  dias: DiaCupos[];
  procedimientos: string[];
  reprogramando: Reprogramando | null;
  whatsapp: string;
  volver: () => void;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [fecha, setFecha] = useState('');
  const [inicio, setInicio] = useState('');
  const [modalidad, setModalidad] = useState<'presencial' | 'online'>(reprogramando?.modalidad ?? 'presencial');
  const [nombre, setNombre] = useState(reprogramando?.nombre ?? '');
  const [cedula, setCedula] = useState(reprogramando?.cedula ?? '');
  const [whatsapp, setWhatsapp] = useState(reprogramando?.whatsapp ?? '');
  const [procedimiento, setProcedimiento] = useState(reprogramando?.procedimiento ?? '');
  // Ya pagó su consulta: el paso del pago se salta y se le dice que su pago sigue en pie.
  const yaPago = reprogramando?.yaPagoUsd != null;
  const [verTodos, setVerTodos] = useState(false);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [referencia, setReferencia] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horas = useMemo(() => dias.find((d) => d.fecha === fecha)?.cupos ?? [], [dias, fecha]);

  /** Los datos de cobro se piden al llegar al paso del pago, no antes: el monto
   *  depende de la modalidad y la tasa cambia durante el día. */
  useEffect(() => {
    if (paso !== 4) return;
    fetch(api(`/api/publico/cobro?modalidad=${modalidad}`))
      .then((r) => r.json())
      .then((c) => {
        setCobro(c);
        // Sin datos de cobro cargados no hay nada que enseñar: se salta al resumen.
        if (!hayComoPagar(c) || yaPago) setPaso(5);
      })
      .catch(() => { setCobro(null); setPaso(5); });
  }, [paso, modalidad]);
  const atras = () => {
    if (paso === 0) return volver();
    // El paso de pago se salta en los dos sentidos si no hay con qué cobrar.
    if (paso === 5 && (!hayComoPagar(cobro) || yaPago)) return setPaso(3);
    setPaso(paso - 1);
  };

  if (!dias.length) {
    return (
      <Tarjeta>
        <Cabecera
          titulo="No hay horarios disponibles"
          sub="En este momento la agenda no tiene cupos abiertos. Escríbenos por WhatsApp y te ayudamos a conseguir un espacio."
          volver={volver}
        />
        <Ayuda whatsapp={whatsappConsultorio} />
      </Tarjeta>
    );
  }

  function validarDatos(): boolean {
    const e = primerError(validarNombre(nombre), validarCedula(cedula), validarWhatsapp(whatsapp));
    if (e) { setError(e); return false; }
    if (!procedimiento) { setError('Escoge el procedimiento que te interesa.'); return false; }
    setError(null);
    return true;
  }

  async function reservar() {
    setError(null);
    setEnviando(true);
    try {
      const cuerpo = new FormData();
      Object.entries({ nombre, cedula, whatsapp, procedimiento, modalidad, inicio, referencia,
                       desde: reprogramando?.token ?? '' }).forEach(([k, v]) => cuerpo.append(k, v));
      if (comprobante) cuerpo.append('comprobante', comprobante);
      const r = await fetch(api('/api/publico/reservar'), { method: 'POST', body: cuerpo });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos.error ?? 'No se pudo guardar la reserva.');
        if (datos.recargar) { setInicio(''); setPaso(0); setTimeout(() => router.refresh(), 1500); }
        return;
      }
      router.push(`/cita/${datos.token}?nueva=1`);
    } catch {
      setError('Falló la conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const visibles = verTodos ? dias : dias.slice(0, DIAS_VISIBLES);

  return (
    <Tarjeta>
      <div key={paso} className="paso-entra">
        {paso === 0 && (
          <>
            <Cabecera titulo="¿Qué día te sirve?" volver={atras} paso={1} />
            {reprogramando && (
              <p className="rounded-lg border border-[var(--color-cobre-luz)]/40 bg-[var(--color-cobre)]/20 px-4 py-3 text-[13.5px] mb-4">
                Estás cambiando tu cita del {fechaLarga(reprogramando.fechaActual.slice(0, 10))} a las{' '}
                {hora12(reprogramando.fechaActual.slice(11, 16))}. Al terminar, esa se libera.
                {yaPago && ` Tu pago de ${reprogramando.yaPagoUsd} $ sigue en pie: cambiar la fecha no se cobra otra vez.`}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visibles.map((d) => (
                <button
                  key={d.fecha}
                  type="button"
                  onClick={() => { setFecha(d.fecha); setInicio(''); setPaso(1); }}
                  className="opcion px-3 py-3"
                >
                  <span className="block text-[14px] font-medium">{fechaCorta(d.fecha)}</span>
                  <span className="block text-[12px] text-[var(--color-nude)]/55 mt-0.5">
                    {d.cupos.length} {d.cupos.length === 1 ? 'cupo' : 'cupos'}
                  </span>
                </button>
              ))}
            </div>
            {!verTodos && dias.length > DIAS_VISIBLES && (
              <button type="button" onClick={() => setVerTodos(true)}
                className="btn btn-vidrio w-full mt-3">
                Ver más días
              </button>
            )}
          </>
        )}

        {paso === 1 && (
          <>
            <Cabecera titulo="¿A qué hora?" sub={fechaLarga(fecha)} volver={atras} paso={2} />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {horas.map((c) => (
                <button
                  key={c.inicio}
                  type="button"
                  onClick={() => { setInicio(c.inicio); setPaso(2); }}
                  className="opcion px-2 py-3 text-center text-[14px] font-medium"
                >
                  {hora12(c.hora)}
                </button>
              ))}
            </div>
          </>
        )}

        {paso === 2 && (
          <>
            <Cabecera titulo="¿Cómo prefieres la consulta?" volver={atras} paso={3} />
            <div className="space-y-3">
              {([
                ['presencial', 'En el consultorio', 'Nos vemos en Bella Vista, Maracaibo. Dura alrededor de una hora.'],
                ['online', 'Por videollamada', 'Desde donde estés, ideal si no vives en Maracaibo.'],
              ] as const).map(([m, titulo, pie]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setModalidad(m); setPaso(3); }}
                  className={`opcion px-4 py-4 ${modalidad === m ? 'opcion-activa' : ''}`}
                >
                  <span className="block text-[15.5px] font-semibold">{titulo}</span>
                  <span className="block text-[13px] text-[var(--color-nude)]/60 mt-1 leading-relaxed">{pie}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            <Cabecera titulo="Tus datos" sub="Ya casi." volver={atras} paso={4} />
            <div className="space-y-4">
              <label className="block">
                <span className="text-[13px] font-medium">Nombre y apellido</span>
                <input className="campo-oscuro mt-1" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name" placeholder="María Pérez" />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Cédula</span>
                <input className="campo-oscuro mt-1" value={cedula} onChange={(e) => setCedula(e.target.value)}
                  inputMode="text" placeholder="V12345678" />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">WhatsApp</span>
                <input className="campo-oscuro mt-1" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                  inputMode="tel" autoComplete="tel" placeholder="04121234567" />
                <span className="block text-[11.5px] text-[var(--color-nude)]/50 mt-1.5">
                  ¿Estás fuera de Venezuela? Escríbelo con el código del país: +573001234567
                </span>
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">Procedimiento de interés</span>
                <select className="campo-oscuro mt-1" value={procedimiento} onChange={(e) => setProcedimiento(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {procedimientos.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
            {error && <div className="mt-4"><Aviso texto={error} /></div>}
            <button className="btn btn-cobre w-full py-3 text-[15px] mt-5"
              onClick={() => { if (validarDatos()) setPaso(4); }}>
              Continuar
            </button>
          </>
        )}

        {paso === 4 && (
          <>
            <Cabecera titulo="El pago de la consulta" sub="La consulta se paga al reservar." volver={atras} paso={5} />
            {!cobro ? (
              <p className="text-[14px] text-[var(--color-nude)]/70">Buscando los datos de pago…</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--color-cobre-luz)]/40 bg-[var(--color-cobre)]/15 p-4">
                  <p className="etiqueta">Monto a pagar</p>
                  <p className="text-[24px] font-semibold text-white mt-1 tabular-nums">{cobro.usd} $</p>
                  {cobro.bs && (
                    <p className="text-[14px] text-[var(--color-nude)]/75 mt-1 tabular-nums">
                      {cobro.bs} Bs · a la tasa del día
                    </p>
                  )}
                </div>

                {cobro.pagoMovil && (
                  <DatosPago titulo="Pago móvil" qr={cobro.pagoMovil.qr} filas={[
                    ['Banco', cobro.pagoMovil.banco], ['Teléfono', cobro.pagoMovil.telefono],
                    ['Cédula o RIF', cobro.pagoMovil.cedula], ['A nombre de', cobro.pagoMovil.titular],
                  ]} />
                )}
                {cobro.binance && (
                  <DatosPago titulo="Binance" qr={cobro.binance.qr} filas={[['Usuario', cobro.binance.usuario]]} />
                )}
                {cobro.zelle && (
                  <DatosPago titulo="Zelle" filas={[['Correo o teléfono', cobro.zelle.correo], ['A nombre de', cobro.zelle.titular]]} />
                )}
                {cobro.efectivo && (
                  <div className="rounded-lg border border-white/12 bg-white/[.05] p-4">
                    <p className="etiqueta">Efectivo</p>
                    <p className="text-[14px] text-[var(--color-nude)]/75 mt-2 leading-relaxed">
                      Si prefieres pagar en efectivo, lo haces en el consultorio el día de tu cita.
                      Reserva igual y deja el comprobante en blanco.
                    </p>
                  </div>
                )}
                <label className="block">
                  <span className="text-[13px] font-medium">Referencia del pago (opcional)</span>
                  <input className="campo-oscuro mt-1" value={referencia} inputMode="numeric"
                    onChange={(e) => setReferencia(e.target.value)} placeholder="Últimos dígitos" />
                </label>

                <div className="block">
                  <span className="text-[13px] font-medium">Sube tu comprobante</span>
                  {/* El input de archivo nativo se ve en inglés ("Choose File",
                      "No file chosen") y no hay forma de traducirlo: se esconde
                      y se maneja con una etiqueta propia. */}
                  <label className="mt-1 flex items-center gap-3 cursor-pointer rounded-lg border border-white/16 bg-white/[.07] px-3 py-2.5">
                    <span className="btn btn-cobre py-1.5 px-3 text-[13px] shrink-0">
                      {comprobante ? 'Cambiar' : 'Escoger archivo'}
                    </span>
                    <span className="text-[13px] text-[var(--color-nude)]/70 truncate">
                      {comprobante ? comprobante.name : 'Ningún archivo escogido'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  <span className="block text-[12px] text-[var(--color-nude)]/55 mt-1.5">
                    Una foto de la transferencia o el PDF. Si vas a pagar en efectivo, salta este paso.
                    Sin comprobante tu cupo queda apartado igual, pero el consultorio tiene que
                    confirmar el pago antes de la cita.
                  </span>
                </div>
              </div>
            )}
            <button className="btn btn-cobre w-full py-3 text-[15px] mt-5" onClick={() => setPaso(5)}>
              Continuar
            </button>
          </>
        )}

        {paso === 5 && (
          <>
            <Cabecera titulo="¿Todo bien?" sub="Revisa y confirma tu reserva." volver={atras} paso={6} />
            <dl className="rounded-lg border border-white/12 bg-white/[.05] p-4 space-y-3 text-[14px]">
              <Resumen titulo="Cuándo" valor={`${fechaLarga(inicio.slice(0, 10))} a las ${hora12(inicio.slice(11, 16))}`} />
              <Resumen titulo="Modalidad" valor={modalidad === 'presencial' ? 'En el consultorio' : 'Por videollamada'} />
              <Resumen titulo="Paciente" valor={nombre} />
              <Resumen titulo="Procedimiento de interés" valor={procedimiento} />
              {yaPago ? (
                <Resumen titulo="Pago" valor={`${reprogramando!.yaPagoUsd} $ ya pagados · no se cobra de nuevo`} />
              ) : cobro && (
                <Resumen titulo="Pago" valor={comprobante ? `${cobro.usd} $ · comprobante adjunto` : `${cobro.usd} $ · sin comprobante`} />
              )}
            </dl>
            {error && <div className="mt-4"><Aviso texto={error} /></div>}
            <button className="btn btn-cobre w-full py-3 text-[15px] mt-5"
              disabled={enviando} onClick={reservar}>
              {enviando ? 'Guardando…' : reprogramando ? 'Confirmar nueva fecha' : 'Reservar mi cita'}
            </button>
            <p className="text-[12.5px] text-[var(--color-nude)]/70 mt-4 leading-relaxed">
              <strong className="text-[var(--color-cobre-luz)]">Llega puntual.</strong> Si pasan 5 minutos
              de la hora, la valoración se cancela.
            </p>
            <p className="text-[12.5px] text-[var(--color-nude)]/55 mt-2 leading-relaxed">
              Al reservar aceptas que el consultorio use tus datos para gestionar tu cita.
              Un día antes te llega un recordatorio por WhatsApp: confírmalo para que no se libere tu cupo.
            </p>
          </>
        )}
      </div>
    </Tarjeta>
  );
}

/** Un bloque de datos de pago, con su QR si lo cargaron. */
function DatosPago({ titulo, filas, qr }: { titulo: string; filas: [string, string][]; qr?: string }) {
  const utiles = filas.filter(([, v]) => v);
  if (!utiles.length && !qr) return null;
  return (
    <div className="rounded-lg border border-white/12 bg-white/[.05] p-4">
      <p className="etiqueta">{titulo}</p>
      <div className="mt-2 flex flex-wrap gap-4 items-start justify-between">
        <dl className="space-y-1 text-[14px] min-w-0">
          {utiles.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-[var(--color-nude)]/55">{k}:</dt>
              <dd className="font-medium break-all">{v}</dd>
            </div>
          ))}
        </dl>
        {qr && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={qr} alt={`Código QR de ${titulo}`} className="h-28 w-28 rounded-md bg-white p-1 object-contain" />
        )}
      </div>
    </div>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    /* Con etiqueta y valor largos (PROCEDIMIENTO DE INTERÉS + Lipoescultura) no
       caben en una línea: que el valor baje y se siga leyendo a la derecha. */
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="etiqueta pt-0.5">{titulo}</dt>
      <dd className="ml-auto min-w-0 text-right font-medium break-words">{valor}</dd>
    </div>
  );
}

/* ── Confirmar · Cancelar · Reprogramar ─────────────────────────────────── */

function PorCedula({
  modo, whatsapp, volver, agendar,
}: {
  modo: 'confirmar' | 'gestionar';
  whatsapp: string;
  volver: () => void;
  agendar: () => void;
}) {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<CitaHallada[] | null>(null);
  const [elegida, setElegida] = useState<CitaHallada | null>(null);
  const [modal, setModal] = useState<'confirmar' | 'cancelar' | null>(null);
  const [obrando, setObrando] = useState(false);
  const [hecho, setHecho] = useState<'confirmada' | 'cancelada' | null>(null);
  // El diálogo se dibuja en el <body>: la tarjeta usa backdrop-filter, y eso
  // convierte a la tarjeta en el ancla de cualquier `position: fixed` de adentro.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const esConfirmar = modo === 'confirmar';

  async function buscar() {
    setError(null);
    setBuscando(true);
    try {
      const r = await fetch(api('/api/publico/buscar-cita'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula }),
      });
      const datos = await r.json();
      if (!r.ok) { setError(datos.error ?? 'No pudimos buscar tu cita.'); return; }
      setCitas(datos.citas);
      if (datos.citas.length === 1) setElegida(datos.citas[0]);
    } catch {
      setError('Falló la conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setBuscando(false);
    }
  }

  async function ejecutar(accion: 'confirmar' | 'cancelar') {
    if (!elegida) return;
    setObrando(true);
    setError(null);
    try {
      const r = await fetch(api(`/api/publico/cita/${elegida.token}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const datos = await r.json();
      if (!r.ok) { setError(datos.error ?? 'No se pudo completar la acción.'); setModal(null); return; }
      setHecho(accion === 'confirmar' ? 'confirmada' : 'cancelada');
      setModal(null);
    } catch {
      setError('Falló la conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setObrando(false);
    }
  }

  /* Resultado final */
  if (hecho && elegida) {
    return (
      <Tarjeta>
        <div className="paso-entra text-center py-2">
          <span className={`grid place-items-center h-12 w-12 rounded-full mx-auto text-[20px] ${
            hecho === 'confirmada'
              ? 'bg-[var(--color-cobre)] text-white'
              : 'bg-[rgba(154,61,46,.25)] text-[#f3c9c0]'
          }`}>
            {hecho === 'confirmada' ? '✓' : '×'}
          </span>
          <h2 className="titulo text-[21px] mt-4">
            {hecho === 'confirmada' ? 'Cita confirmada' : 'Cita cancelada'}
          </h2>
          <p className="text-[14px] text-[var(--color-nude)]/75 mt-2 leading-relaxed">
            {hecho === 'confirmada'
              ? `Te esperamos el ${elegida.cuando}. Si algo cambia, puedes reprogramar desde aquí mismo.`
              : 'Tu cupo quedó libre. Cuando quieras puedes agendar una nueva cita.'}
          </p>
          <div className="mt-6 grid gap-2">
            {hecho === 'confirmada' ? (
              <Link className="btn btn-vidrio" href={`/cita/${elegida.token}`}>Ver los detalles de mi cita</Link>
            ) : (
              <button className="btn btn-cobre" onClick={agendar}>Agendar una nueva cita</button>
            )}
            <button className="btn btn-vidrio" onClick={volver}>Volver al inicio</button>
          </div>
        </div>
      </Tarjeta>
    );
  }

  /* Pedir cédula */
  if (!citas) {
    return (
      <Tarjeta>
        <div className="paso-entra">
          <Cabecera
            titulo={esConfirmar ? 'Confirmar mi cita' : 'Cancelar o reprogramar'}
            sub="Escribe tu cédula y buscamos tu cita."
            volver={volver}
          />
          <label className="block">
            <span className="text-[13px] font-medium">¿Cuál es tu cédula?</span>
            <input
              className="campo-oscuro mt-1"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && cedula.trim()) buscar(); }}
              inputMode="text"
              placeholder="V12345678"
              autoFocus
            />
          </label>
          {error && <div className="mt-4"><Aviso texto={error} /></div>}
          <button className="btn btn-cobre w-full py-3 text-[15px] mt-5"
            disabled={!cedula.trim() || buscando} onClick={buscar}>
            {buscando ? 'Buscando…' : 'Buscar mi cita'}
          </button>
          <Ayuda whatsapp={whatsapp} />
        </div>
      </Tarjeta>
    );
  }

  /* Varias citas activas: que escoja */
  if (!elegida) {
    return (
      <Tarjeta>
        <div className="paso-entra">
          <Cabecera titulo="¿Cuál de tus citas?" volver={() => { setCitas(null); setError(null); }} />
          <div className="space-y-2">
            {citas.map((c) => (
              <button key={c.token} type="button" onClick={() => setElegida(c)}
                className="opcion px-4 py-3">
                <span className="block text-[14.5px] font-medium">{c.cuando}</span>
                <span className="block text-[12.5px] text-[var(--color-nude)]/55 mt-0.5">
                  {c.modalidad === 'online' ? 'Por videollamada' : 'En el consultorio'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Tarjeta>
    );
  }

  /* La cita, con sus acciones */
  const yaConfirmada = elegida.estado === 'confirmada';

  return (
    <Tarjeta>
      <div className="paso-entra">
        <Cabecera
          titulo="Esta es tu cita"
          volver={() => { setError(null); setElegida(null); if (citas.length <= 1) setCitas(null); }}
        />
        <div className="rounded-lg border border-white/12 bg-white/[.05] p-4">
          <p className="text-[16px] font-semibold leading-snug text-white">{elegida.cuando}</p>
          <p className="text-[13px] text-[var(--color-nude)]/60 mt-1">
            {elegida.modalidad === 'online' ? 'Por videollamada' : 'En el consultorio'} ·{' '}
            {yaConfirmada ? 'Confirmada' : 'Falta confirmar'}
          </p>
        </div>

        {error && <div className="mt-4"><Aviso texto={error} /></div>}

        {esConfirmar ? (
          yaConfirmada ? (
            <>
              <p className="text-[14px] text-[var(--color-nude)]/75 mt-4 leading-relaxed">
                Tu asistencia ya estaba confirmada. No tienes que hacer nada más.
              </p>
              <button className="btn btn-vidrio w-full mt-5" onClick={volver}>Volver al inicio</button>
            </>
          ) : !elegida.puedeConfirmar ? (
            <>
              <p className="text-[14px] text-[var(--color-nude)]/75 mt-4 leading-relaxed">
                Todavía no hace falta confirmar. Un día antes te escribimos por WhatsApp y desde
                ese mensaje confirmas con un toque.
              </p>
              <button className="btn btn-vidrio w-full mt-5" onClick={volver}>Volver al inicio</button>
            </>
          ) : (
            <button className="btn btn-cobre w-full py-3 text-[15px] mt-5" onClick={() => setModal('confirmar')}>
              Sí, voy a asistir
            </button>
          )
        ) : (
          <div className="mt-5 grid gap-2">
            <button className="btn btn-cobre py-3 text-[15px]"
              onClick={() => router.push(`/reservar?desde=${elegida.token}`)}>
              Reprogramar para otro día
            </button>
            <button className="btn btn-peligro-vidrio py-3 text-[15px]" onClick={() => setModal('cancelar')}>
              Cancelar mi cita
            </button>
          </div>
        )}

        <Ayuda whatsapp={whatsapp} />
      </div>

      {modal && montado && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(6,23,32,.72)] px-4"
          role="dialog" aria-modal="true">
          <div className="tarjeta p-5 sm:p-6 w-full max-w-sm">
            <h3 className="titulo text-[17px]">
              {modal === 'confirmar' ? '¿Confirmas que vas a asistir?' : '¿Seguro que quieres cancelar?'}
            </h3>
            <p className="text-[14px] text-[var(--color-tinta-2)] mt-2 leading-relaxed">
              {modal === 'confirmar'
                ? `Le avisamos al consultorio que te esperan el ${elegida.cuando}.`
                : 'Tu cupo queda libre para otra persona. Si lo que quieres es otro día, mejor reprograma.'}
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button className="btn btn-borde" disabled={obrando} onClick={() => setModal(null)}>
                Volver
              </button>
              <button
                className={`btn ${modal === 'confirmar' ? 'btn-principal' : 'btn-peligro'}`}
                disabled={obrando}
                onClick={() => ejecutar(modal)}
              >
                {obrando ? 'Un momento…' : modal === 'confirmar' ? 'Sí, confirmo' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Tarjeta>
  );
}
