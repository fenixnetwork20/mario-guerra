'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/rutas';

type Estado = 'reservada' | 'confirmada' | 'cancelada' | 'reprogramada' | 'completada' | 'no_asistio';

export function AccionesCita({
  token, estadoInicial, cuando, whatsappConsultorio,
}: {
  token: string; estadoInicial: Estado; cuando: string; whatsappConsultorio: string;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [modal, setModal] = useState<'confirmar' | 'cancelar' | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function ejecutar(accion: 'confirmar' | 'cancelar') {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(api(`/api/publico/cita/${token}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const datos = await r.json();
      if (!r.ok) { setError(datos.error ?? 'No se pudo completar la acción.'); return; }
      setEstado(datos.estado);
      setModal(null);
      router.refresh();
    } catch {
      setError('Falló la conexión. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  const activa = estado === 'reservada' || estado === 'confirmada';

  return (
    <div className="space-y-4">
      {estado === 'cancelada' && (
        <section className="tarjeta p-5">
          <h3 className="titulo text-lg">Tu cita fue cancelada</h3>
          <p className="text-[14px] text-[var(--color-tinta-2)] mt-1">
            Si quieres, puedes tomar otro horario ahora mismo.
          </p>
          <Link href={`/reservar?desde=${token}`} className="btn btn-principal mt-4">
            Reagendar mi cita
          </Link>
        </section>
      )}

      {estado === 'reprogramada' && (
        <section className="tarjeta p-5">
          <p className="text-[14px] text-[var(--color-tinta-2)]">
            Esta cita fue reprogramada. Revisa el enlace nuevo que se te mostró al reprogramar.
          </p>
        </section>
      )}

      {activa && (
        <section className="tarjeta p-5 space-y-4">
          <div>
            <h3 className="titulo text-lg">Gestiona tu cita</h3>
            <p className="text-[14px] text-[var(--color-tinta-2)] mt-1">
              {estado === 'reservada'
                ? 'Confirma tu asistencia para que no se libere el cupo.'
                : 'Tu asistencia ya está confirmada. Si algo cambia, puedes reprogramar o cancelar.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {estado === 'reservada' && (
              <button className="btn btn-principal" onClick={() => setModal('confirmar')}>
                Confirmar asistencia
              </button>
            )}
            <Link href={`/reservar?desde=${token}`} className="btn btn-borde">Reprogramar</Link>
            <button className="btn btn-peligro" onClick={() => setModal('cancelar')}>Cancelar cita</button>
          </div>
        </section>
      )}

      <section className="tarjeta p-5">
        <p className="etiqueta">Tu enlace</p>
        <p className="text-[14px] text-[var(--color-tinta-2)] mt-1">
          Guárdalo o agrégalo a favoritos. Es privado: solo quien tenga el enlace ve esta cita.
        </p>
        <button
          className="btn btn-borde mt-3"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href.split('?')[0]);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch { setError('Copia el enlace desde la barra del navegador.'); }
          }}
        >
          {copiado ? 'Enlace copiado' : 'Copiar mi enlace'}
        </button>
        {whatsappConsultorio && (
          <p className="text-[13px] text-[var(--color-tinta-3)] mt-3">
            ¿Dudas? Escríbenos al {whatsappConsultorio}.
          </p>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-alerta)_30%,#fff)] bg-[var(--color-alerta-luz)] px-4 py-3 text-[14px] text-[var(--color-alerta)]">
          {error}
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 p-4"
          onClick={() => !cargando && setModal(null)}
        >
          <div className="tarjeta w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="titulo text-lg">
              {modal === 'confirmar'
                ? '¿Estás seguro de que asistirás a la cita?'
                : '¿Seguro que quieres cancelar tu cita?'}
            </h3>
            <p className="text-[14px] text-[var(--color-tinta-2)] mt-2">
              {modal === 'confirmar'
                ? `Confirmas tu asistencia el ${cuando}.`
                : `Se liberará tu cupo del ${cuando} y quedará disponible para otro paciente.`}
            </p>
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn btn-borde" disabled={cargando} onClick={() => setModal(null)}>
                Volver
              </button>
              <button
                className={`btn ${modal === 'confirmar' ? 'btn-principal' : 'btn-peligro'}`}
                disabled={cargando}
                onClick={() => ejecutar(modal)}
              >
                {cargando ? 'Un momento…' : modal === 'confirmar' ? 'Sí, confirmo' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
