'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/rutas';

type Cobro = {
  usd: number; bs: string | null;
  pagoMovil: { banco: string; telefono: string; cedula: string; titular: string } | null;
  binance: { usuario: string } | null;
  zelle: { correo: string; titular: string } | null;
};

/**
 * Subir el pago desde el enlace de la cita, para quien reservó con efectivo y
 * terminó pagando por transferencia, o a quien se le rechazó el comprobante.
 */
export function SubirPago({ token, modalidad, efectivo, rechazado, enRevision = false }: {
  token: string; modalidad: string; efectivo: boolean; rechazado: boolean;
  /** Ya hay un comprobante esperando revisión. */
  enRevision?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(!efectivo);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [referencia, setReferencia] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!abierto || cobro) return;
    fetch(api(`/api/publico/cobro?modalidad=${modalidad}`)).then((r) => r.json()).then(setCobro).catch(() => {});
  }, [abierto, cobro, modalidad]);

  async function enviar() {
    if (!referencia.trim() || !archivo) { setError('Hacen falta las dos cosas: la referencia del pago y la captura.'); return; }
    setEnviando(true); setError(null);
    try {
      const f = new FormData();
      f.append('referencia', referencia.trim());
      f.append('comprobante', archivo);
      const r = await fetch(api(`/api/publico/cita/${token}/pago`), { method: 'POST', body: f });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo enviar. Intenta de nuevo.'); return; }
      setListo(true);
      router.refresh();
    } catch {
      setError('No se pudo enviar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo || enRevision) {
    return (
      <div className="tarjeta p-5">
        <p className="titulo text-lg">Recibimos tu pago</p>
        <p className="text-[14px] text-[var(--color-tinta-2)] mt-1">
          El consultorio lo verifica y queda registrado en tu cita. No tienes que hacer nada más.
        </p>
      </div>
    );
  }

  return (
    <div className="tarjeta p-5 space-y-4">
      <div>
        <p className="titulo text-lg">{rechazado ? 'Vuelve a subir tu pago' : efectivo ? '¿Ya pagaste por transferencia?' : 'Sube tu pago'}</p>
        <p className="text-[14px] text-[var(--color-tinta-2)] mt-1">
          {rechazado
            ? 'El consultorio no pudo verificar el comprobante anterior. Sube la captura correcta con su referencia.'
            : efectivo
              ? 'Reservaste para pagar en efectivo en el consultorio. Si ya pagaste por pago móvil, Binance o Zelle, sube aquí la captura.'
              : 'Sube la captura del pago con su referencia para que el consultorio lo verifique.'}
        </p>
      </div>

      {!abierto ? (
        <button className="btn btn-borde" onClick={() => setAbierto(true)}>Subir comprobante</button>
      ) : (
        <>
          {cobro && (
            <div className="rounded-lg bg-[var(--color-papel-2)] p-4 text-[14px] space-y-2">
              <p><span className="etiqueta">Monto</span> <span className="font-semibold tabular-nums ml-1">{cobro.usd} $</span>
                {cobro.bs && <span className="text-[var(--color-tinta-2)] tabular-nums"> · {cobro.bs} Bs a la tasa del día</span>}</p>
              {cobro.pagoMovil && <p><span className="etiqueta">Pago móvil</span> {[cobro.pagoMovil.banco, cobro.pagoMovil.telefono, cobro.pagoMovil.cedula, cobro.pagoMovil.titular].filter(Boolean).join(' · ')}</p>}
              {cobro.binance && <p><span className="etiqueta">Binance</span> {cobro.binance.usuario}</p>}
              {cobro.zelle && <p><span className="etiqueta">Zelle</span> {[cobro.zelle.correo, cobro.zelle.titular].filter(Boolean).join(' · ')}</p>}
            </div>
          )}

          <label className="block">
            <span className="text-[13px] font-medium">Referencia del pago</span>
            <input className="campo mt-1" value={referencia} onChange={(e) => setReferencia(e.target.value)}
              placeholder="Número de referencia o ID de la transacción" />
          </label>

          <div>
            <span className="text-[13px] font-medium">Captura del pago</span>
            {/* El input nativo se ve en inglés: se esconde y se usa una etiqueta propia. */}
            <label className="mt-1 flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--color-linea)] px-3 py-2.5">
              <span className="btn btn-borde py-1.5 px-3 text-[13px] shrink-0">{archivo ? 'Cambiar' : 'Escoger archivo'}</span>
              <span className="text-[13px] text-[var(--color-tinta-2)] truncate">{archivo ? archivo.name : 'Ningún archivo escogido'}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-[var(--color-alerta-luz)] px-4 py-3 text-[14px] text-[var(--color-alerta)]">{error}</div>
          )}
          <button className="btn btn-principal" disabled={enviando} onClick={enviar}>
            {enviando ? 'Enviando…' : 'Enviar comprobante'}
          </button>
        </>
      )}
    </div>
  );
}
