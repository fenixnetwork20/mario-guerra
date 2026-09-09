'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/rutas';
import { Aparece } from '@/componentes/Aparece';
import { fechaCorta, fechaLarga, hora12 } from '@/lib/fechas';

type Cupo = { fecha: string; hora: string; inicio: string };
type DiaCupos = { fecha: string; cupos: Cupo[] };

type Reprogramando = {
  token: string; nombre: string; cedula: string; whatsapp: string;
  procedimiento: string; modalidad: 'presencial' | 'online'; fechaActual: string;
};

export function FormularioReserva({
  dias, procedimientos, reprogramando, sobreOscuro = false,
}: {
  dias: DiaCupos[];
  procedimientos: string[];
  reprogramando: Reprogramando | null;
  /** El formulario vive sobre el fondo de petróleo: el texto suelto se aclara. */
  sobreOscuro?: boolean;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState<string>(dias[0]?.fecha ?? '');
  const [inicio, setInicio] = useState<string>('');
  const [nombre, setNombre] = useState(reprogramando?.nombre ?? '');
  const [cedula, setCedula] = useState(reprogramando?.cedula ?? '');
  const [whatsapp, setWhatsapp] = useState(reprogramando?.whatsapp ?? '');
  const [procedimiento, setProcedimiento] = useState(reprogramando?.procedimiento ?? '');
  const [modalidad, setModalidad] = useState<'presencial' | 'online'>(reprogramando?.modalidad ?? 'presencial');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horasDelDia = useMemo(
    () => dias.find((d) => d.fecha === fecha)?.cupos ?? [],
    [dias, fecha]
  );

  const listo = inicio && nombre.trim() && cedula.trim() && whatsapp.trim() && procedimiento;

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch(api('/api/publico/reservar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, cedula, whatsapp, procedimiento, modalidad, inicio,
          desde: reprogramando?.token,
        }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos.error ?? 'No se pudo guardar la reserva.');
        if (datos.recargar) setTimeout(() => router.refresh(), 1200);
        return;
      }
      router.push(`/cita/${datos.token}?nueva=1`);
    } catch {
      setError('Falló la conexión. Revisa tu internet e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const textoSuelto = sobreOscuro ? 'text-[var(--color-nude)]/70' : 'text-[var(--color-tinta-3)]';

  if (!dias.length) {
    return (
      <div className="tarjeta p-6">
        <h2 className="titulo text-xl">No hay horarios disponibles</h2>
        <p className="text-[var(--color-tinta-2)] mt-2">
          En este momento la agenda no tiene cupos abiertos. Escríbenos por WhatsApp y te ayudamos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {reprogramando && (
        <div className="rounded-lg border border-[var(--color-linea)] bg-[var(--color-aviso-luz)] px-4 py-3 text-[14px]">
          Estás reprogramando tu cita del{' '}
          <strong>{fechaLarga(reprogramando.fechaActual.slice(0, 10))}</strong> a las{' '}
          <strong>{hora12(reprogramando.fechaActual.slice(11, 16))}</strong>. Al confirmar, esa cita se libera.
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-5 sm:gap-6 items-start">
      {/* Paso 1 — día */}
      <Aparece as="section" className="tarjeta p-5 sm:p-6 min-w-0">
        <p className="etiqueta">Paso 1 · Elige el día</p>
        <div className="scroll-x -mx-1 mt-3">
          <div className="flex gap-2 px-1 pb-1">
            {dias.map((d) => {
              const activo = d.fecha === fecha;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  onClick={() => { setFecha(d.fecha); setInicio(''); }}
                  className={`shrink-0 rounded-lg border px-4 py-2.5 text-left transition-colors ${
                    activo
                      ? 'border-[var(--color-acento)] bg-[var(--color-acento-luz)]'
                      : 'border-[var(--color-linea)] bg-[var(--color-tarjeta)] hover:border-[var(--color-tinta-3)]'
                  }`}
                >
                  <span className="block text-[13px] text-[var(--color-tinta-2)]">{fechaCorta(d.fecha)}</span>
                  <span className="block text-[12px] text-[var(--color-tinta-3)]">
                    {d.cupos.length} {d.cupos.length === 1 ? 'cupo' : 'cupos'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="etiqueta mt-5">Paso 2 · Elige la hora</p>
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {horasDelDia.map((c) => {
            const activo = c.inicio === inicio;
            return (
              <button
                key={c.inicio}
                type="button"
                onClick={() => setInicio(c.inicio)}
                className={`rounded-lg border px-2 py-2.5 text-[14px] font-medium transition-colors ${
                  activo
                    ? 'border-[var(--color-acento)] bg-[var(--color-acento)] text-white'
                    : 'border-[var(--color-linea)] bg-[var(--color-tarjeta)] hover:border-[var(--color-tinta-3)]'
                }`}
              >
                {hora12(c.hora)}
              </button>
            );
          })}
        </div>
      </Aparece>

      {/* Paso 3 — datos */}
      <Aparece as="section" retraso={90} className="tarjeta p-5 sm:p-6 space-y-4 min-w-0">
        <p className="etiqueta">Paso 3 · Tus datos</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[13px] font-medium">Nombre y apellido</span>
            <input className="campo mt-1" value={nombre} onChange={(e) => setNombre(e.target.value)}
              autoComplete="name" placeholder="María Pérez" />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium">Cédula</span>
            <input className="campo mt-1" value={cedula} onChange={(e) => setCedula(e.target.value)}
              inputMode="text" placeholder="V12345678" />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium">WhatsApp</span>
            <input className="campo mt-1" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel" autoComplete="tel" placeholder="04121234567" />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium">Procedimiento de interés</span>
            <select className="campo mt-1" value={procedimiento} onChange={(e) => setProcedimiento(e.target.value)}>
              <option value="">Selecciona…</option>
              {procedimientos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        <div>
          <span className="text-[13px] font-medium">Modalidad de la consulta</span>
          <div className="mt-2 flex gap-2">
            {(['presencial', 'online'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModalidad(m)}
                className={`rounded-lg border px-4 py-2 text-[14px] font-medium capitalize transition-colors ${
                  modalidad === m
                    ? 'border-[var(--color-acento)] bg-[var(--color-acento-luz)]'
                    : 'border-[var(--color-linea)] bg-[var(--color-tarjeta)] hover:border-[var(--color-tinta-3)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </Aparece>
      </div>

      {inicio && (
        <div className="rounded-lg border border-[var(--color-linea)] bg-[var(--color-tarjeta)] px-4 py-3 text-[14px]">
          Tu cita quedaría el <strong>{fechaLarga(inicio.slice(0, 10))}</strong> a las{' '}
          <strong>{hora12(inicio.slice(11, 16))}</strong> · {modalidad}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-alerta)_30%,#fff)] bg-[var(--color-alerta-luz)] px-4 py-3 text-[14px] text-[var(--color-alerta)]">
          {error}
        </div>
      )}

      <button className="btn btn-principal w-full py-3 text-[15px]" disabled={!listo || enviando} onClick={enviar}>
        {enviando ? 'Guardando…' : reprogramando ? 'Confirmar nueva fecha' : 'Reservar mi cita'}
      </button>

      <p className={`text-[12.5px] ${textoSuelto}`}>
        Al reservar aceptas que el consultorio use tus datos para gestionar tu cita.
      </p>
    </div>
  );
}
