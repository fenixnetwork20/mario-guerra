import { NextResponse } from 'next/server';
import { cfg, cfgNum } from '@/lib/db';
import { tasaDelDia, enBolivares } from '@/lib/tasa';

export const dynamic = 'force-dynamic';

/**
 * Lo que hay que mostrarle al paciente para pagar: el monto en dólares y su
 * equivalente en bolívares del día, y los datos de cobro que estén cargados.
 * Solo devuelve las formas de pago que tienen datos: una sección vacía en la
 * pantalla de pago es peor que no mostrarla.
 */
export async function GET(req: Request) {
  const modalidad = new URL(req.url).searchParams.get('modalidad') === 'online' ? 'online' : 'presencial';
  const usd = cfgNum(modalidad === 'online' ? 'precio_consulta_online' : 'precio_consulta_presencial', 0);
  const t = await tasaDelDia();

  const pagoMovil = {
    banco: cfg('pm_banco', ''), telefono: cfg('pm_telefono', ''),
    cedula: cfg('pm_cedula', ''), titular: cfg('pm_titular', ''),
    qr: cfg('pm_qr', '') ? '/api/publico/qr/pm' : '',
  };
  const binance = { usuario: cfg('binance_usuario', ''), qr: cfg('binance_qr', '') ? '/api/publico/qr/binance' : '' };
  const zelle = { correo: cfg('zelle_correo', ''), titular: cfg('zelle_titular', '') };

  return NextResponse.json({
    usd,
    bs: t.valor ? enBolivares(usd, t.valor) : null,
    tasa: t.valor || null,
    pagoMovil: pagoMovil.telefono || pagoMovil.qr ? pagoMovil : null,
    binance: binance.usuario || binance.qr ? binance : null,
    zelle: zelle.correo ? zelle : null,
  });
}
