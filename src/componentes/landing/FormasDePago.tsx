import { cfg } from '@/lib/db';
import { api } from '@/lib/rutas';

/**
 * Formas de pago a la vista en la portada. El doctor pidió que se vean sin
 * tener que llegar al último paso de la reserva: la gente preguntaba por chat
 * cómo se paga antes de decidirse. Sale de los mismos datos de Configuración
 * que usa el paso de pago, y solo muestra las formas que tienen datos.
 */
export function FormasDePago() {
  const pm = {
    banco: cfg('pm_banco', ''), telefono: cfg('pm_telefono', ''),
    cedula: cfg('pm_cedula', ''), titular: cfg('pm_titular', ''),
  };
  const binance = { usuario: cfg('binance_usuario', ''), qr: cfg('binance_qr', '') };
  const zelle = { correo: cfg('zelle_correo', ''), titular: cfg('zelle_titular', '') };
  const efectivo = cfg('efectivo_activo', '0') === '1';

  const formas: Array<{ nombre: string; lineas: string[]; qr?: string }> = [];
  if (pm.telefono) {
    formas.push({
      nombre: 'Pago móvil',
      lineas: [pm.banco, `Teléfono ${pm.telefono}`, pm.cedula && `C.I. ${pm.cedula}`, pm.titular].filter(Boolean) as string[],
    });
  }
  if (zelle.correo) formas.push({ nombre: 'Zelle', lineas: [zelle.correo, zelle.titular].filter(Boolean) });
  if (binance.usuario || binance.qr) {
    formas.push({
      nombre: 'Binance',
      lineas: binance.usuario ? [`ID ${binance.usuario}`] : [],
      qr: binance.qr ? api('/api/publico/qr/binance') : undefined,
    });
  }
  if (efectivo) formas.push({ nombre: 'Efectivo', lineas: ['En el consultorio, el día de tu cita', 'Solo consulta presencial'] });
  if (!formas.length) return null;

  return (
    <div id="pagos" className="scroll-mt-24">
      <p className="marca text-[9.5px] text-[var(--color-cobre-luz)]">Formas de pago</p>
      <p className="text-[14px] text-[var(--color-nude)]/70 mt-4 leading-relaxed max-w-md">
        La consulta se paga al reservar: el monto exacto en dólares y en bolívares a la tasa
        del día te aparece en el último paso, junto con el sitio para subir tu comprobante.
      </p>
      <ul className="mt-6 grid sm:grid-cols-2 gap-3">
        {formas.map((f) => (
          <li key={f.nombre} className="rounded-lg border border-white/15 bg-white/[0.04] p-4">
            <p className="text-[15px] font-semibold text-[var(--color-nude)]">{f.nombre}</p>
            {f.lineas.map((l) => (
              <p key={l} className="text-[14px] text-[var(--color-nude)]/80 mt-1 tabular-nums break-words select-all">{l}</p>
            ))}
            {f.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.qr} alt="Código QR de Binance" className="mt-3 w-28 h-28 rounded bg-white p-1" loading="lazy" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
